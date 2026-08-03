import "server-only";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { extractionResultToFormValues } from "@/lib/extraction-to-form";
import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { runTrustCheck } from "@/server/generation/trust-validation.service";
import { classifyDensity, type DensityLevel } from "@/server/generation/density-classification.service";
import { selectBadgeConfig, type BadgeConfig } from "@/server/generation/badge-selection.service";
import { getPlatformFormat } from "@/lib/platform-formats";
import { getOrCreateFatSandboxAgency } from "./sandbox-agency";
import { db } from "@/lib/db";
import type { AdvertisementDraftSourceType } from "@prisma/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("fat-pipeline");

/**
 * Task 006.5 — the Founder Acceptance Testing surface's own orchestration.
 *
 * This file adds ZERO new domain logic. Every stage below calls an
 * existing, unmodified Task 001-006 function and returns its real output.
 * Where the Founder's requested 5-stage pipeline names a stage that has no
 * dedicated engine in this codebase (Campaign Intelligence), that stage's
 * card says so explicitly rather than fabricating a decision.
 *
 * Stage map (left = what the Founder asked for, right = what actually runs):
 *   1. Requirement Intelligence -> KAI Intelligence Engine extraction
 *      (advertisementDraftService.runExtraction), the real per-field
 *      value/confidence/warnings structured-output result.
 *   2. Job Order                -> the saved Advertisement record
 *      (advertisementDraftService.review + .save) — Advertisement IS the
 *      job order in this data model; no new entity is introduced.
 *   3. Compliance Intelligence  -> runTrustCheck + generateAndVerifyQr,
 *      the exact functions advertisementGenerationService.generate() uses
 *      for its own trust gate, called directly here (both are fast, free,
 *      non-AI) so compliance can be inspected without paying for an image.
 *   4. Campaign Intelligence    -> NOT IMPLEMENTED. No such engine exists
 *      in Tasks 001-006. Reported as { implemented: false }, not invented.
 *   5. Layout Intelligence      -> classifyDensity + selectBadgeConfig, the
 *      real pre-render layout decisions (density tier, badge shape/size).
 *      The deeper layout decision (footer/branding selection) only exists
 *      inside the full image-generation call and is exposed separately by
 *      runFatGeneration() below — opt-in, since it costs quota + an AI call.
 */

export interface StageResult<T> {
  stage: string;
  implemented: boolean;
  decision: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "N/A";
  reason: string;
  source: string;
  data: T | null;
  durationMs: number;
}

export interface FatRunInput {
  sourceType: AdvertisementDraftSourceType;
  rawText?: string;
  sourceFileUrl?: string;
  instructions?: string;
  sourceLabel?: string;
}

export interface FatRunResult {
  runId: string;
  draftId: string | null;
  advertisementId: string | null;
  stages: {
    requirementIntelligence: StageResult<ExtractionResult>;
    jobOrder: StageResult<unknown>;
    complianceIntelligence: StageResult<{ status: string; warnings: string[]; qrDecodable: boolean }>;
    campaignIntelligence: StageResult<null>;
    layoutIntelligence: StageResult<{ density: DensityLevel; badge: BadgeConfig }>;
  };
  succeeded: boolean;
}

function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const start = Date.now();
  return fn().then((value) => ({ value, durationMs: Date.now() - start }));
}

export async function runFounderPipeline(
  input: FatRunInput,
  actorId: string,
  actorEmail: string,
): Promise<FatRunResult> {
  const agency = await getOrCreateFatSandboxAgency();

  let draftId: string | null = null;
  let advertisementId: string | null = null;

  // ---- Stage 1: Requirement Intelligence -------------------------------
  const draft = await advertisementDraftService.create(agency.id, actorId, {
    sourceType: input.sourceType,
    rawText: input.rawText,
    sourceFileUrl: input.sourceFileUrl,
    instructions: input.instructions,
  });
  draftId = draft.id;

  const { value: extractedDraft, durationMs: extractMs } = await timed(() =>
    advertisementDraftService.runExtraction(draft.id, agency.id, actorId),
  );

  const extractedData = extractedDraft.extractedData as unknown as ExtractionResult | null;
  const requirementIntelligence: StageResult<ExtractionResult> = extractedData
    ? {
        stage: "Requirement Intelligence",
        implemented: true,
        decision: summarizeExtraction(extractedData),
        confidence: extractedData.overallConfidence,
        reason:
          extractedData.warnings.length > 0
            ? extractedData.warnings.join(" · ")
            : "No warnings raised by the KAI Intelligence Engine.",
        source: input.sourceLabel ?? input.sourceType,
        data: extractedData,
        durationMs: extractMs,
      }
    : {
        stage: "Requirement Intelligence",
        implemented: true,
        decision: "EXTRACTION_FAILED",
        confidence: "LOW",
        reason: extractedDraft.extractionError ?? "Extraction did not return structured data.",
        source: input.sourceLabel ?? input.sourceType,
        data: null,
        durationMs: extractMs,
      };

  // ---- Stage 2: Job Order (= the saved Advertisement record) -----------
  let jobOrder: StageResult<unknown>;
  if (extractedData) {
    try {
      const formValues = extractionResultToFormValues(extractedData);
      const reviewed = {
        header: formValues.header || `${extractedData.industry.value ?? "Requirement"} — ${extractedData.country.value ?? "Unspecified"}`,
        industry: formValues.industry || "Unspecified",
        country: formValues.country || "Unspecified",
        employer: formValues.employer,
        positions:
          formValues.positions && formValues.positions.length > 0
            ? formValues.positions
            : [{ title: "Unspecified position" }],
        benefits: formValues.benefits ?? [],
        interview: formValues.interview ?? {},
        contact: formValues.contact ?? {},
      };

      const { value: reviewedDraft, durationMs: reviewMs } = await timed(() =>
        advertisementDraftService.review(draft.id, agency.id, actorId, reviewed),
      );
      const { value: advertisement, durationMs: saveMs } = await timed(() =>
        advertisementDraftService.save(reviewedDraft.id, agency.id, actorId),
      );
      advertisementId = advertisement.id;

      jobOrder = {
        stage: "Job Order",
        implemented: true,
        decision: `Advertisement ${advertisement.id} saved (status ${advertisement.status})`,
        confidence: extractedData.overallConfidence,
        reason: "Requirement Intelligence output mapped to the Job Order schema via extractionResultToFormValues (unmodified) and saved through advertisementDraftService.save (unmodified).",
        source: `draft:${draft.id}`,
        data: advertisement,
        durationMs: reviewMs + saveMs,
      };
    } catch (error) {
      jobOrder = {
        stage: "Job Order",
        implemented: true,
        decision: "SAVE_FAILED",
        confidence: "LOW",
        reason: error instanceof Error ? error.message : "Job Order could not be created from the extracted data.",
        source: `draft:${draft.id}`,
        data: null,
        durationMs: 0,
      };
    }
  } else {
    jobOrder = {
      stage: "Job Order",
      implemented: true,
      decision: "SKIPPED",
      confidence: "N/A",
      reason: "Requirement Intelligence produced no extracted data to build a Job Order from.",
      source: `draft:${draft.id}`,
      data: null,
      durationMs: 0,
    };
  }

  // ---- Stage 3: Compliance Intelligence ---------------------------------
  let complianceIntelligence: StageResult<{ status: string; warnings: string[]; qrDecodable: boolean }>;
  if (advertisementId) {
    const { value, durationMs } = await timed(async () => {
      const qrUrl = buildQrTrackingUrl({ agencyVerificationId: agency.id, advertisementId: advertisementId! });
      const qr = await generateAndVerifyQr(qrUrl);
      const advertisement = (await db.advertisement.findUnique({ where: { id: advertisementId! } }))!;
      const contact = advertisement.contact as { phone?: string; email?: string; whatsapp?: string } | null;
      const trust = runTrustCheck({
        agencyName: agency.name,
        raLicenseId: agency.registrationNumber,
        qrDecodable: qr.decodable,
        contactPresent: Boolean(contact?.phone || contact?.email || contact?.whatsapp || agency.phone || agency.whatsapp || agency.officialEmail),
        advertisementTexts: [advertisement.header, advertisement.footer],
      });
      return { trust, qrDecodable: qr.decodable };
    });
    complianceIntelligence = {
      stage: "Compliance Intelligence",
      implemented: true,
      decision: value.trust.status,
      confidence: value.trust.status === "TRUST_READY" ? "HIGH" : value.trust.status === "BLOCKED" ? "LOW" : "MEDIUM",
      reason: value.trust.warnings.length > 0 ? value.trust.warnings.join(" · ") : "No compliance warnings.",
      source: "runTrustCheck + generateAndVerifyQr (unmodified, Task 004)",
      data: { status: value.trust.status, warnings: value.trust.warnings, qrDecodable: value.qrDecodable },
      durationMs,
    };
  } else {
    complianceIntelligence = {
      stage: "Compliance Intelligence",
      implemented: true,
      decision: "SKIPPED",
      confidence: "N/A",
      reason: "No Job Order was saved to run a compliance check against.",
      source: "runTrustCheck (Task 004)",
      data: null,
      durationMs: 0,
    };
  }

  // ---- Stage 4: Campaign Intelligence — genuinely not implemented -------
  const campaignIntelligence: StageResult<null> = {
    stage: "Campaign Intelligence",
    implemented: false,
    decision: "NOT_IMPLEMENTED",
    confidence: "N/A",
    reason: "No Campaign Intelligence engine exists in Tasks 001-006. This card intentionally reports absence rather than a fabricated decision.",
    source: "n/a",
    data: null,
    durationMs: 0,
  };

  // ---- Stage 5: Layout Intelligence (pre-render decisions only) --------
  let layoutIntelligence: StageResult<{ density: DensityLevel; badge: BadgeConfig }>;
  if (advertisementId) {
    const { value, durationMs } = await timed(async () => {
      const advertisement = (await db.advertisement.findUnique({ where: { id: advertisementId! } }))!;
      const positions = advertisement.positions as unknown as { title: string; count?: number }[];
      const density = classifyDensity(positions.map((p) => ({ title: p.title, count: p.count })));
      const platformFormat = getPlatformFormat("generic_square");
      const badge = selectBadgeConfig({ style: advertisement.style, density, positionCount: positions.length, platformFormat });
      return { density, badge };
    });
    layoutIntelligence = {
      stage: "Layout Intelligence",
      implemented: true,
      decision: `density=${value.density}, badge=${value.badge.shape}/${value.badge.size}`,
      confidence: "HIGH",
      reason: "classifyDensity + selectBadgeConfig (unmodified, Task 004) — the pre-render layout decisions. Footer/branding layout selection additionally requires a full image generation; run it separately via Generate Full Advertisement.",
      source: "classifyDensity + selectBadgeConfig (Task 004)",
      data: value,
      durationMs,
    };
  } else {
    layoutIntelligence = {
      stage: "Layout Intelligence",
      implemented: true,
      decision: "SKIPPED",
      confidence: "N/A",
      reason: "No Job Order was saved to classify.",
      source: "classifyDensity (Task 004)",
      data: null,
      durationMs: 0,
    };
  }

  const stages = { requirementIntelligence, jobOrder, complianceIntelligence, campaignIntelligence, layoutIntelligence };
  const succeeded =
    requirementIntelligence.data !== null && jobOrder.data !== null && complianceIntelligence.data !== null;

  const run = await db.fatPipelineRun.create({
    data: {
      actorId,
      actorEmail,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel ?? null,
      draftId,
      advertisementId,
      stages: stages as unknown as object,
      succeeded,
      errorMessage: succeeded ? null : "One or more implemented stages did not complete.",
    },
  });

  log.info({ runId: run.id, succeeded }, "FAT pipeline run complete");

  return { runId: run.id, draftId, advertisementId, stages, succeeded };
}

function summarizeExtraction(extracted: ExtractionResult): string {
  const parts: string[] = [];
  if (extracted.country.value) parts.push(extracted.country.value);
  if (extracted.industry.value) parts.push(extracted.industry.value);
  const positionCount = extracted.positions.length;
  if (positionCount > 0) parts.push(`${positionCount} position${positionCount === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "No fields extracted";
}
