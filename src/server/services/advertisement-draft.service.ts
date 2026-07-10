import type { Prisma } from "@prisma/client";
import { advertisementDraftRepository } from "@/server/repositories/advertisement-draft.repository";
import { advertisementService } from "@/server/services/advertisement.service";
import { auditLogService } from "@/server/services/audit-log.service";
import { getAiExtractionToolkit, AiProviderNotImplementedError } from "@/server/ai";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { paginate, toSkipTake, type PaginationParams } from "@/lib/pagination";
import { createLogger } from "@/lib/logger";
import type { CreateDraftInput } from "@/lib/validations/advertisement-draft";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

const log = createLogger("advertisement-draft-service");

export const advertisementDraftService = {
  /** Create Advertisement — Paste Requirement / Upload PDF / DOCX / Image / WhatsApp Screenshot. */
  async create(agencyId: string, actorId: string, input: CreateDraftInput) {
    const draft = await advertisementDraftRepository.create({
      agency: { connect: { id: agencyId } },
      createdBy: { connect: { id: actorId } },
      sourceType: input.sourceType,
      rawText: input.rawText,
      sourceFileUrl: input.sourceFileUrl,
      status: "UPLOADED",
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDraftCreated,
      entity: "AdvertisementDraft",
      entityId: draft.id,
      agencyId,
      actorId,
      metadata: { sourceType: input.sourceType },
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
   * AI Extraction Review — runs every configured extraction provider
   * against the draft's raw text. Sprint 002 ships architecture only, so
   * every provider is a NotImplemented stand-in: this method is expected
   * to fail today, and does so onto a clearly-labeled EXTRACTION_FAILED
   * state rather than crashing the request — the review screen falls
   * back to manual entry, which is the whole point of storing
   * `reviewedData` as a separate field from `extractedData`.
   */
  async runExtraction(id: string, agencyId: string) {
    const draft = await advertisementDraftService.getById(id, agencyId);

    if (!draft.rawText) {
      throw new ConflictError(
        "This draft has no extractable text yet. Uploaded files are stored but not yet OCR'd/parsed in this sprint — enter the advertisement details manually.",
      );
    }

    const toolkit = getAiExtractionToolkit();
    const input = { text: draft.rawText, sourceType: draft.sourceType };

    try {
      const [requirements, industry, country, employer, salary, interview] = await Promise.all([
        toolkit.requirementExtraction.extractRequirements(input),
        toolkit.industryDetection.detectIndustry(input),
        toolkit.countryDetection.detectCountry(input),
        toolkit.employerDetection.detectEmployer(input),
        toolkit.salaryDetection.detectSalary(input),
        toolkit.interviewDetection.detectInterview(input),
      ]);

      const extractedData = { requirements, industry, country, employer, salary, interview };

      return advertisementDraftRepository.update(id, {
        status: "EXTRACTED",
        extractedData: extractedData as unknown as Prisma.InputJsonValue,
        extractionError: null,
      });
    } catch (error) {
      const message =
        error instanceof AiProviderNotImplementedError
          ? error.message
          : error instanceof Error
            ? error.message
            : "AI extraction failed";

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

    const updated = await advertisementDraftRepository.update(id, {
      reviewedData: reviewedData as unknown as Prisma.InputJsonValue,
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
