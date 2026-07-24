import type { Prisma } from "@prisma/client";
import { deepStripInvalidChars } from "@/lib/sanitize-text";
import { advertisementDraftRepository } from "@/server/repositories/advertisement-draft.repository";
import { advertisementService } from "@/server/services/advertisement.service";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { runKaiIntelligenceEngine, type DraftAttachment } from "@/server/ai/kai-intelligence-engine";
import { AiProviderNotImplementedError } from "@/server/ai";
import type { AiExtractionToolkit } from "@/server/ai";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { paginate, toSkipTake, type PaginationParams } from "@/lib/pagination";
import { createLogger } from "@/lib/logger";
import type { CreateDraftInput } from "@/lib/validations/advertisement-draft";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

const log = createLogger("advertisement-draft-service");

export const advertisementDraftService = {
  /** Create Advertisement — the ChatGPT-style composer: pasted text, typed instructions, and/or multiple attachments in one draft. */
  async create(agencyId: string, actorId: string, input: CreateDraftInput) {
    const draft = await advertisementDraftRepository.create({
      agency: { connect: { id: agencyId } },
      createdBy: { connect: { id: actorId } },
      sourceType: input.sourceType,
      rawText: input.rawText,
      sourceFileUrl: input.sourceFileUrl,
      instructions: input.instructions,
      // Zod-validated array of { url, sourceType, fileName, mimeType } —
      // stored as-is; runExtraction reads it back for the merged input.
      attachments: input.attachments as unknown as Prisma.InputJsonValue,
      status: "UPLOADED",
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDraftCreated,
      entity: "AdvertisementDraft",
      entityId: draft.id,
      agencyId,
      actorId,
      metadata: { sourceType: input.sourceType, attachmentCount: input.attachments?.length ?? 0 },
    });

    return draft;
  },

  async getById(id: string, agencyId: string) {
    const draft = await advertisementDraftRepository.findById(id, agencyId);
    if (!draft) throw new NotFoundError("Advertisement draft");
    return draft;
  },

  async list(agencyId: string, pagination: PaginationParams, status?: Parameters<typeof advertisementDraftRepository.listByAgency>[1]) {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await Promise.all([
      advertisementDraftRepository.listByAgency(agencyId, status, skip, take),
      advertisementDraftRepository.count(agencyId, status),
    ]);
    return paginate(data, total, pagination);
  },

  /**
   * AI Extraction Review — runs the KAI Intelligence Engine (Sprint 003:
   * a real OpenAI-backed implementation when OPENAI_API_KEY is set,
   * otherwise the Sprint 002 NotImplemented stand-ins) against the
   * draft's pasted text or uploaded file. Every operation is recorded to
   * AiUsageLog regardless of outcome (Cost Tracking / Error Handling:
   * "Record ... Success or failure").
   *
   * On failure — including the everyday "AI not configured" case — the
   * draft moves to EXTRACTION_FAILED with a clear extractionError rather
   * than throwing, so the caller (the API route) always gets a 200 with
   * a draft the review screen can fall back to manual entry on. The
   * recruiter's original input (rawText/sourceFileUrl) is never touched.
   *
   * `toolkit` is a dependency-injection seam: tests pass a deterministic
   * fake toolkit here instead of touching OpenAI at all.
   */
  async runExtraction(id: string, agencyId: string, actorId?: string, toolkit?: AiExtractionToolkit) {
    const draft = await advertisementDraftService.getById(id, agencyId);

    // Composer drafts carry attachments/instructions instead of (or on
    // top of) the legacy single rawText/sourceFileUrl pair — any one of
    // the four is enough to extract from.
    const attachments = Array.isArray(draft.attachments)
      ? (draft.attachments as unknown as DraftAttachment[])
      : [];
    if (!draft.rawText && !draft.sourceFileUrl && !draft.instructions && attachments.length === 0) {
      throw new ConflictError("This draft has no requirement text or file to extract from.");
    }

    const startedAt = Date.now();
    try {
      const outcome = await runKaiIntelligenceEngine({
        sourceType: draft.sourceType,
        rawText: draft.rawText,
        sourceFileUrl: draft.sourceFileUrl,
        instructions: draft.instructions,
        attachments,
        toolkit,
      });

      await costTrackingService.record({
        operationType: "COMPOSITE_EXTRACTION",
        provider: outcome.provider,
        model: outcome.model ?? "unknown",
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        latencyMs: outcome.latencyMs,
        success: true,
        agencyId,
        userId: actorId,
        advertisementDraftId: id,
      });

      return advertisementDraftRepository.update(id, {
        status: "EXTRACTED",
        // Sprint 006 Bug 006: extractedData is a jsonb column, and
        // Postgres hard-rejects a NUL codepoint anywhere inside a jsonb
        // value ("unsupported Unicode escape sequence ... 22P05"). GPT
        // echoes several fields back from the source text verbatim
        // (originalSourceText, position titles, etc.), so any control
        // character in the pasted/extracted input can reach here — strip
        // it before the write, not after the write fails.
        extractedData: deepStripInvalidChars(outcome.result) as unknown as Prisma.InputJsonValue,
        extractionError: null,
      });
    } catch (error) {
      const message =
        error instanceof AiProviderNotImplementedError
          ? error.message
          : error instanceof Error
            ? error.message
            : "AI extraction failed";

      await costTrackingService.record({
        operationType: "COMPOSITE_EXTRACTION",
        provider: "openai",
        model: "unknown",
        inputTokens: null,
        outputTokens: null,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorMessage: message,
        agencyId,
        userId: actorId,
        advertisementDraftId: id,
      });

      log.warn({ draftId: id, err: error }, "AI extraction unavailable");

      return advertisementDraftRepository.update(id, {
        status: "EXTRACTION_FAILED",
        extractionError: message,
      });
    }
  },

  /** AI Extraction Review — the recruiter's edited/approved fields. */
  async review(id: string, agencyId: string, actorId: string, reviewedData: Record<string, unknown>) {
    await advertisementDraftService.getById(id, agencyId);

    // Sprint 006 Bug 006: reviewedData is a jsonb column too — the same
    // NUL-byte hard-rejection applies whether the data came from the
    // auto-publish pipeline (echoing the AI extraction) or a recruiter
    // typing/pasting directly into the manual fallback form.
    const updated = await advertisementDraftRepository.update(id, {
      reviewedData: deepStripInvalidChars(reviewedData) as unknown as Prisma.InputJsonValue,
      status: "REVIEWED",
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDraftReviewed,
      entity: "AdvertisementDraft",
      entityId: id,
      agencyId,
      actorId,
    });

    return updated;
  },

  /** Style Selection — store only, no rendering. */
  async selectStyle(
    id: string,
    agencyId: string,
    actorId: string,
    style: "VISUAL" | "TYPOGRAPHY" | "NEWSPAPER",
  ) {
    await advertisementDraftService.getById(id, agencyId);

    const updated = await advertisementDraftRepository.update(id, {
      selectedStyle: style,
      status: "STYLE_SELECTED",
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDraftStyleSelected,
      entity: "AdvertisementDraft",
      entityId: id,
      agencyId,
      actorId,
      metadata: { style },
    });

    return updated;
  },

  /** Save — Preview -> Save. Converts the reviewed draft into a real Advertisement. */
  async save(id: string, agencyId: string, actorId: string) {
    const draft = await advertisementDraftService.getById(id, agencyId);

    if (draft.status === "SAVED") {
      throw new ConflictError("This draft has already been saved.");
    }
    if (!draft.reviewedData) {
      throw new ConflictError("Review the extracted details before saving.");
    }

    const reviewed = draft.reviewedData as unknown as CreateAdvertisementInput;
    const advertisementInput: CreateAdvertisementInput = {
      ...reviewed,
      style: draft.selectedStyle ?? reviewed.style ?? "VISUAL",
      sourceDraftId: draft.id,
    };

    const advertisement = await advertisementService.create(agencyId, actorId, advertisementInput);

    await advertisementDraftRepository.update(id, { status: "SAVED" });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDraftSaved,
      entity: "AdvertisementDraft",
      entityId: id,
      agencyId,
      actorId,
      metadata: { advertisementId: advertisement.id },
    });

    return advertisement;
  },

  async discard(id: string, agencyId: string, actorId: string) {
    await advertisementDraftService.getById(id, agencyId);
    const updated = await advertisementDraftRepository.update(id, { status: "DISCARDED" });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDraftDiscarded,
      entity: "AdvertisementDraft",
      entityId: id,
      agencyId,
      actorId,
    });

    return updated;
  },
};
