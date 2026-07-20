import type { Prisma } from "@prisma/client";
import { deepStripInvalidChars } from "@/lib/sanitize-text";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { detectCompensationSignal } from "@/server/generation/compensation-signal.service";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import {
  archetypeUsesGeneratedImagery,
  buildAdCopyPlan,
  buildCompositionDirectives,
  buildImageBrief,
  composeAdvertisement,
  recommendArchetype,
  resolveAgencyVisualDna,
  selectArchetype,
  styleForArchetype,
} from "@/server/generation/archetypes";
import {
  generateGptBackgroundBrief,
  toCreativeBrainDecisions,
} from "@/server/generation/background-brief";
import { buildCreativeDirectorBrief } from "@/server/generation/creative-director/pipeline-adapter";
import { getEnv, getFeatureFlags } from "@/lib/env";
import { runAcceptanceLoop } from "@/server/generation/acceptance/acceptance-loop";
import { getVisualQaProvider } from "@/server/ai/visual-qa";
import sharp from "sharp";
import { normalizeInterviewEvents } from "@/server/generation/interview-events";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { runTrustCheck } from "@/server/generation/trust-validation.service";
import { getThemeAccentColor, isValidThemeKey } from "@/server/generation/theme-recommendation.service";
import { deriveCompactRegistrationNumber } from "@/lib/registration-number";
import { getPlatformFormat, isValidPlatformFormatKey } from "@/lib/platform-formats";
import { getImageGenerationProvider, ImageProviderNotImplementedError } from "@/server/ai/image";
import { gptNativeGenerationService } from "@/server/services/gpt-native-generation.service";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import type { GenerateAdvertisementInput } from "@/lib/validations/advertisement-generation";

const log = createLogger("advertisement-generation");

export const advertisementGenerationService = {
  /**
   * Advertisement Generation Flow (Sprint 004): Select Platform -> KAI
   * Recommends Type -> (accept/override) -> Generate -> Trust Validation
   * -> QR Decode Validation -> Save Version. Every step reuses Sprint
   * 002/003 infrastructure (Advertisement, AdvertisementVersion,
   * AiUsageLog, AuditLog) rather than a parallel system.
   */
  async generate(
    advertisementId: string,
    agencyId: string,
    actorId: string,
    input: GenerateAdvertisementInput,
  ) {
    if (!isValidPlatformFormatKey(input.platformFormat)) {
      throw new AppError(`Unknown platform format "${input.platformFormat}".`, 400);
    }

    // Sprint 007: GPT-Native Advertisement Architecture. Default OFF —
    // delegates entirely to a separate service so the legacy path below
    // (composeAdvertisement, the acceptance loop, buildImageBrief, etc.)
    // is never touched when this flag is off.
    if (getFeatureFlags().gptNativeAdGeneration) {
      return gptNativeGenerationService.generate(advertisementId, agencyId, actorId, input);
    }

    await generationQuotaService.assertGenerationAllowed(agencyId);

    const advertisement = await advertisementRepository.findById(advertisementId, agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");

    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const verification = await agencyVerificationRepository.findByAgencyId(agencyId);
    const platformFormat = getPlatformFormat(input.platformFormat);

    const positions = advertisement.positions as unknown as { title: string; count?: number; experience?: string; salary?: string | null }[];
    const benefits = advertisement.benefits as unknown as { label: string; detail?: string }[];
    // Decision 3: interview is a schemaless Json column — normalizeInterviewEvents
    // reads either the legacy single {date, location} shape or the current
    // {events: [...]} shape, so existing advertisements need no migration.
    const interview = normalizeInterviewEvents(advertisement.interview);
    const contact = advertisement.contact as unknown as {
      name?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
    };

    const density = classifyDensity(positions.map((p) => ({ title: p.title, count: p.count })));
    const hasSalaryInfo = detectCompensationSignal(benefits);

    // Creative Brain: content-aware archetype suitability. The recruiter's
    // explicit style choice is always honored (manual override); otherwise
    // the recommendation drives both the archetype and the persisted style
    // enum (presentation-layer decision, no schema migration).
    const recommendation = recommendArchetype({
      positionCount: positions.length,
      totalHeadcount: positions.reduce((sum, p) => sum + (p.count ?? 1), 0),
      benefitCount: benefits.length,
      interviewEventCount: interview.length,
      hasSalarySignal: hasSalaryInfo,
      isUrgent: Boolean(input.isUrgent),
      aspectRatio: platformFormat.widthPx / platformFormat.heightPx,
    });
    const archetype = input.style
      ? selectArchetype({ style: input.style, density })
      : recommendation.recommendedArchetype;
    const style = input.style ?? styleForArchetype(archetype);

    // "Never force a high-density requirement into a visual-heavy layout
    // that makes positions unreadable... If Visual style is selected
    // despite excessive density: Warn the recruiter." This is a warning
    // surfaced via the trust check's warnings list, not a block — the
    // recruiter explicitly chose Visual (input.style), so their choice
    // is honored, just flagged.
    const densityWarnings: string[] = [];
    if (style === "VISUAL" && density === "HIGH") {
      densityWarnings.push(
        "This requirement has a high number of positions — Visual style may be harder to read than Typography or Newspaper for this many roles.",
      );
    }

    // Decision 1: the badge is a small, fixed-size "constrained visual
    // area" — it shows the compact core RC number, never the full
    // official string. agency.registrationNumber itself is untouched
    // (still the full value, the source of truth for anywhere it's
    // legally/officially required, e.g. the footer text a recruiter sets).
    const compactRaLicenseId = deriveCompactRegistrationNumber(agency.registrationNumber);

    // Three-Brain closed loop: facts (Truth Brain — every value grounded
    // in the extracted Advertisement record, immutable through the loop)
    // are composed by the archetype engine (Creative Brain), then the
    // final rendered image is inspected by the Visual QA Brain — after
    // the deterministic gates (source fidelity, technical render, QR
    // round-trip) pass. Corrections are bounded, presentation-only, and
    // capped at MAX_ACCEPTANCE_ITERATIONS; the creative canvas is reused
    // across iterations unless Visual QA explicitly requires imagery
    // regeneration.
    const facts = {
      header: advertisement.header,
      industry: advertisement.industry,
      country: advertisement.country,
      employer: advertisement.employer,
      positions,
      benefits,
      interview,
      contact,
      footer: advertisement.footer,
      agencyName: agency.name,
      raLicenseId: compactRaLicenseId,
      fullRegistrationNumber: agency.registrationNumber,
    };

    const agencyLogoDataUri = await fetchImageAsDataUri(agency.logoUrl);
    // Agency Visual DNA: tenant color continuity derived from the
    // agency's own logo (no schema migration — see visual-dna.ts).
    const dna = await resolveAgencyVisualDna({
      logo: agencyLogoDataUri ? dataUriToBuffer(agencyLogoDataUri) : null,
    });
    // Advertisement Intelligence: grounded emphasis (headline core,
    // secondary hook) — decides emphasis, never facts.
    const copy = buildAdCopyPlan(facts, { hasCompensationSignal: hasSalaryInfo });
    // Constitution directives — the same decision composeAdvertisement
    // will make, computed here so the creative brief and the composition
    // share one hook/density/priority decision (traceable end to end).
    const briefContext = {
      copy,
      dna,
      directives: buildCompositionDirectives(facts, { archetype, copy }),
      aspectRatio: platformFormat.widthPx / platformFormat.heightPx,
    };

    // Background prompt source, flag-gated. BOTH flags default OFF → legacy
    // buildImageBrief() verbatim, so production is byte-for-byte identical.
    // Precedence: CREATIVE_DIRECTOR_BRAIN (Sprint 006) → CREATIVE_BRAIN_
    // BACKGROUND_BRIEF → legacy. Each higher path only reroutes the brief
    // string; the renderer/QR/overlay are untouched.
    const flags = getFeatureFlags();
    const buildBackgroundBrief = (): string => {
      if (flags.creativeDirectorBrain) {
        return buildCreativeDirectorBrief(facts, {
          dna,
          aspectRatio: briefContext.aspectRatio,
        }).prompt;
      }
      if (flags.creativeBrainBackgroundBrief) {
        return generateGptBackgroundBrief(
          toCreativeBrainDecisions({
            facts,
            copy,
            directives: briefContext.directives,
            dna,
            aspectRatio: briefContext.aspectRatio,
          }),
        ).prompt;
      }
      return buildImageBrief(facts, briefContext);
    };

    let backgroundImageDataUri: string | null = null;
    let usedAiBackground = false;
    const imageStartedAt = Date.now();

    if (archetypeUsesGeneratedImagery(archetype)) {
      const provider = getImageGenerationProvider();
      try {
        const { output, usage } = await provider.generate({
          prompt: buildBackgroundBrief(),
          widthPx: platformFormat.widthPx,
          heightPx: platformFormat.heightPx,
          quality: getEnv().KAI_IMAGE_QUALITY,
        });
        backgroundImageDataUri = `data:${output.mimeType};base64,${output.imageBase64}`;
        usedAiBackground = true;

        await costTrackingService.record({
          operationType: "FULL_AD_GENERATION",
          provider: provider.name,
          model: usage.model,
          inputTokens: null,
          outputTokens: null,
          latencyMs: usage.latencyMs,
          success: true,
          agencyId,
          userId: actorId,
          advertisementId,
          imageSize: `${platformFormat.widthPx}x${platformFormat.heightPx}`,
          imageQuality: "medium",
        });
      } catch (error) {
        // Honest fallback, not a failure: Visual must always complete.
        // Only a genuinely configured-but-failing provider is logged as
        // a cost-tracking failure; an intentionally unconfigured
        // provider (ImageProviderNotImplementedError) isn't a "failure"
        // worth recording — it's the expected, documented state.
        if (!(error instanceof ImageProviderNotImplementedError)) {
          await costTrackingService.record({
            operationType: "FULL_AD_GENERATION",
            provider: "openai",
            model: "unknown",
            inputTokens: null,
            outputTokens: null,
            latencyMs: Date.now() - imageStartedAt,
            success: false,
            errorMessage: error instanceof Error ? error.message : "Image generation failed",
            agencyId,
            userId: actorId,
            advertisementId,
          });
          log.warn({ advertisementId, err: error }, "KAI Creative Engine failed — using fallback background");
        }
        densityWarnings.push(
          "This advertisement uses a KAI-designed background instead of an AI photo — connect the KAI Creative Engine for photo backgrounds.",
        );
      }
    }

    const badge = selectBadgeConfig({
      style,
      density,
      positionCount: positions.length,
      platformFormat,
    });

    // If the agency has no verification record yet, the badge and QR
    // still generate — they simply point at a verification ID whose
    // status is UNVERIFIED, which the public verify page reports
    // honestly rather than claiming a verification that doesn't exist.
    const verificationId = verification?.id ?? agencyId;
    const qrUrl = buildQrTrackingUrl({ agencyVerificationId: verificationId, advertisementId });

    const startedAt = Date.now();
    let qrResult;
    try {
      qrResult = await generateAndVerifyQr(qrUrl);
    } catch (error) {
      await costTrackingService.record({
        operationType: "FULL_AD_GENERATION",
        provider: "kai",
        model: "section-renderer",
        inputTokens: null,
        outputTokens: null,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorMessage: error instanceof Error ? error.message : "QR generation failed",
        agencyId,
        userId: actorId,
      });
      throw error;
    }

    if (input.theme && !isValidThemeKey(input.theme)) {
      throw new AppError(`Unknown theme "${input.theme}".`, 400);
    }
    const accentColor = getThemeAccentColor(input.theme);

    const basePlan = {
      archetype,
      platformFormat,
      accentColor,
      qrDataUri: `data:image/png;base64,${qrResult.png.toString("base64")}`,
      backgroundImageDataUri,
      agencyLogoDataUri,
      dna,
      copy,
    };

    const acceptance = await runAcceptanceLoop(facts, basePlan, {
      compose: (f, p) => composeAdvertisement({ facts: f, plan: p }),
      rasterize: (composedSvg) => rasterizeSvg(composedSvg, platformFormat.widthPx, platformFormat.heightPx),
      visualQa: getVisualQaProvider(),
      expectedQrUrl: qrUrl,
      cropQrRegion: (png) => cropBottomRightQuadrant(png, platformFormat.widthPx, platformFormat.heightPx),
      regenerateImage: usedAiBackground
        ? async (defectNotes) => {
            try {
              const provider = getImageGenerationProvider();
              const { output } = await provider.generate({
                prompt: `${buildBackgroundBrief()} Address these defects from a previous attempt: ${defectNotes.join("; ")}`,
                widthPx: platformFormat.widthPx,
                heightPx: platformFormat.heightPx,
                quality: getEnv().KAI_IMAGE_QUALITY,
              });
              return `data:${output.mimeType};base64,${output.imageBase64}`;
            } catch (error) {
              log.warn({ advertisementId, err: error }, "Image regeneration failed — reusing previous background");
              return null;
            }
          }
        : undefined,
    });

    if (acceptance.status === "BLOCKED_DETERMINISTIC") {
      throw new AppError(
        `Advertisement generation failed a deterministic acceptance gate: ${acceptance.blockReason}`,
        500,
      );
    }
    if (acceptance.status === "BLOCKED_VISUAL_QA") {
      densityWarnings.push(
        `KAI Visual QA scored this advertisement below the commercial threshold after ${acceptance.iterations.length} attempts (final score: ${acceptance.finalScore}/100). It is saved but not marked commercially accepted — review it before publishing.`,
      );
    }

    const pngBuffer = acceptance.finalPng;

    const trustCheck = runTrustCheck({
      agencyName: agency.name,
      raLicenseId: agency.registrationNumber,
      qrDecodable: qrResult.decodable,
      contactPresent: Boolean(contact.phone || contact.email || contact.whatsapp),
      advertisementTexts: [advertisement.header, advertisement.footer, "MEA REGISTERED AGENCY", "VERIFY AGENCY"],
    });
    trustCheck.warnings = [...trustCheck.warnings, ...densityWarnings];

    const generatedAssetUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const nextVersion = advertisement.currentVersion + 1;

    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.advertisement.update({
        where: { id: advertisementId },
        data: {
          platformFormat: input.platformFormat,
          density,
          style,
          theme: (input.theme ? { key: input.theme } : advertisement.theme) as Prisma.InputJsonValue,
          generatedAssetUrl,
          badgeConfig: badge as unknown as Prisma.InputJsonValue,
          trustStatus: trustCheck.status,
          trustWarnings: trustCheck.warnings as unknown as Prisma.InputJsonValue,
          currentVersion: nextVersion,
        },
      });

      await tx.advertisementVersion.create({
        data: {
          advertisementId,
          versionNumber: nextVersion,
          snapshot: {
            platformFormat: input.platformFormat,
            density,
            style,
            archetype,
            archetypeRecommendation: recommendation,
            badge,
            trustStatus: trustCheck.status,
            usedAiBackground,
            visualQa: {
              status: acceptance.status,
              finalScore: acceptance.finalScore,
              iterations: acceptance.iterations.map((it) => ({
                iteration: it.iteration,
                score: it.visualQa?.overallScore ?? null,
                defects: it.visualQa?.defects ?? [],
                regeneratedImage: it.regeneratedImage,
              })),
            },
          } as unknown as Prisma.InputJsonValue,
          changeSummary: "Full advertisement generated",
          regenerationMethod: "AI_REGENERATED",
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId,
          action: "generated",
          metadata: { platformFormat: input.platformFormat, style, density, trustStatus: trustCheck.status },
          actorId,
        },
      });

      return result;
    });

    await generationQuotaService.recordSuccessfulGeneration(agencyId);

    await costTrackingService.record({
      operationType: "FULL_AD_GENERATION",
      provider: "kai",
      model: "section-renderer",
      inputTokens: null,
      outputTokens: null,
      latencyMs: Date.now() - startedAt,
      success: true,
      agencyId,
      userId: actorId,
      advertisementId,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementGenerated,
      entity: "Advertisement",
      entityId: advertisementId,
      agencyId,
      actorId,
      metadata: { style, density, trustStatus: trustCheck.status },
    });

    log.info({ advertisementId, style, density, trustStatus: trustCheck.status }, "Advertisement generated");

    return updated;
  },

  /**
   * Critical Editing USP: regenerates ONLY the changed section. Every
   * other approved section's content is untouched — this function edits
   * one Json field on the Advertisement (whichever `section` maps to)
   * and re-renders the composition from the full (mostly unchanged)
   * record, rather than re-running the whole generation flow. The new
   * AdvertisementVersion records exactly what changed, previous vs new,
   * and whether it was a manual edit or AI regeneration — never a claim
   * that only one visual region of a raster image was touched, because
   * this build's renderer is deterministic composition (ADR-006), where
   * that claim is actually true.
   */
  async regenerateSection(
    advertisementId: string,
    agencyId: string,
    actorId: string,
    section: "HEADER" | "COUNTRY_INDUSTRY" | "POSITIONS" | "BENEFITS" | "INTERVIEW" | "CONTACT" | "AGENCY_FOOTER",
    newSectionData: Record<string, unknown>,
    method: "AI_REGENERATED" | "MANUAL_EDIT",
    reason?: string,
  ) {
    const advertisement = await advertisementRepository.findById(advertisementId, agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");
    if (!advertisement.generatedAssetUrl) {
      throw new ConflictError("Generate the advertisement before editing an individual section.");
    }

    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const sectionFieldMap: Record<string, keyof typeof advertisement> = {
      HEADER: "header",
      COUNTRY_INDUSTRY: "industry",
      POSITIONS: "positions",
      BENEFITS: "benefits",
      INTERVIEW: "interview",
      CONTACT: "contact",
      AGENCY_FOOTER: "footer",
    };
    const field = sectionFieldMap[section];
    const previousSectionData = { [field]: advertisement[field] };

    if (!(field in newSectionData)) {
      throw new AppError(
        `The updated ${section} section must include a "${String(field)}" value.`,
        400,
      );
    }
    // Sprint 006 Bug 006: this field can be a plain text column (header,
    // footer) or a jsonb column (positions, benefits, ...) — Postgres
    // rejects a NUL codepoint in either, so sanitize before the write
    // regardless of which kind this section's field is.
    const newFieldValue = deepStripInvalidChars(newSectionData[field as string]);

    const nextVersion = advertisement.currentVersion + 1;
    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.advertisement.update({
        where: { id: advertisementId },
        data: {
          [field]: newFieldValue,
          currentVersion: nextVersion,
        },
      });

      await tx.advertisementVersion.create({
        data: {
          advertisementId,
          versionNumber: nextVersion,
          snapshot: { [field]: result[field] } as unknown as Prisma.InputJsonValue,
          changeSummary: reason ?? `${section} section updated`,
          changedSection: section,
          regenerationMethod: method,
          previousSectionData: previousSectionData as unknown as Prisma.InputJsonValue,
          newSectionData: newSectionData as unknown as Prisma.InputJsonValue,
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId,
          action: "section_regenerated",
          metadata: { section, method, reason },
          actorId,
        },
      });

      return result;
    });

    if (method === "AI_REGENERATED") {
      await generationQuotaService.recordSectionRegeneration(agencyId);
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementSectionRegenerated,
      entity: "Advertisement",
      entityId: advertisementId,
      agencyId,
      actorId,
      metadata: { section, method },
    });

    return updated;
  },
};

/**
 * Fetches an image (agency logo, always our own storage's URL, never
 * client-supplied at this point — see storageService/uploads) and
 * inlines it as a base64 data URI. SVG rasterization here does not fetch
 * remote URLs itself (verified: a remote <image href> silently renders
 * blank), so this is required, not an optimization. Failure is
 * non-fatal — a logo that can't be fetched just means no logo on the
 * advertisement, not a broken generation.
 */
function dataUriToBuffer(dataUri: string): Buffer | null {
  const comma = dataUri.indexOf(",");
  if (comma === -1) return null;
  try {
    return Buffer.from(dataUri.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

/** Phone-camera-style fallback region for the QR gate: every archetype anchors its verification panel bottom-right. */
async function cropBottomRightQuadrant(png: Buffer, widthPx: number, heightPx: number): Promise<Buffer> {
  const cropW = Math.round(widthPx * 0.45);
  const cropH = Math.round(heightPx * 0.3);
  return sharp(png)
    .extract({ left: widthPx - cropW, top: heightPx - cropH, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

async function fetchImageAsDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
