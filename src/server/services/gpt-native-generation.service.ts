/**
 * GPT-Native Advertisement Generation (Sprint 007).
 *
 * New architecture: Requirement -> Truth Brain -> Creative Director Brain
 * -> Commercial Advertisement Brief -> One Master GPT Image Prompt -> GPT
 * Image generates the COMPLETE advertisement -> KAI Trust Layer -> Final
 * Advertisement.
 *
 * Reuses, unchanged: the Creative Director Brain (`runCreativeDirector`),
 * Truth Brain facts assembly, the image generation provider, QR
 * generation/verification, and the trust-validation service. Only the
 * middle of the pipeline is new (commercial-brief.ts,
 * master-prompt-builder.ts, trust-layer.ts) — the renderer
 * (composeAdvertisement) is deliberately NOT called on this path; GPT
 * owns full composition, KAI only composites the trust badge afterward.
 *
 * Persists through the EXACT SAME Prisma write shape as the legacy
 * `advertisementGenerationService.generate()` — no schema changes. This
 * pipeline's identity is recorded in the existing freeform
 * `AdvertisementVersion.snapshot` JSON field (`pipeline: "GPT_NATIVE"`).
 *
 * Only called when `GPT_NATIVE_AD_GENERATION` is ON (see
 * advertisement-generation.service.ts's flag check). Never invoked
 * otherwise — the legacy path is untouched.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { runTrustCheck } from "@/server/generation/trust-validation.service";
import { deriveCompactRegistrationNumber } from "@/lib/registration-number";
import { getPlatformFormat, isValidPlatformFormatKey } from "@/lib/platform-formats";
import { getImageGenerationProvider, ImageProviderNotImplementedError } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { AppError, NotFoundError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { normalizeInterviewEvents } from "@/server/generation/interview-events";
import { runCreativeDirector } from "@/server/generation/creative-director/creative-director";
import { factsToCreativeInput } from "@/server/generation/creative-director/pipeline-adapter";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";
import { resolveAgencyVisualDna } from "@/server/generation/archetypes";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt, type BrandContext } from "@/server/generation/gpt-native/master-prompt-builder";
import { applyTrustLayer, computeImageSha256 } from "@/server/generation/gpt-native/trust-layer";
import { runGptNativeAcceptance } from "@/server/generation/gpt-native/acceptance";
import type { GenerateAdvertisementInput } from "@/lib/validations/advertisement-generation";

const log = createLogger("gpt-native-generation");

export const gptNativeGenerationService = {
  async generate(
    advertisementId: string,
    agencyId: string,
    actorId: string,
    input: GenerateAdvertisementInput,
  ) {
    if (!isValidPlatformFormatKey(input.platformFormat)) {
      throw new AppError(`Unknown platform format "${input.platformFormat}".`, 400);
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
    const interview = normalizeInterviewEvents(advertisement.interview);
    const contact = advertisement.contact as unknown as {
      name?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
    };

    const density = classifyDensity(positions.map((p) => ({ title: p.title, count: p.count })));
    const compactRaLicenseId = deriveCompactRegistrationNumber(agency.registrationNumber);

    const facts: AdvertisementFacts = {
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

    // Truth Brain facts feed the (unchanged) Creative Director Brain, whose
    // output feeds the Commercial Advertisement Brief. No new intelligence.
    const creativeInput = factsToCreativeInput(facts, {
      aspectRatio: platformFormat.widthPx / platformFormat.heightPx,
    });
    const direction = runCreativeDirector(creativeInput);
    const brief = buildCommercialAdvertisementBrief(direction);

    const style = input.style ?? "VISUAL";
    const densityWarnings: string[] = [];

    // Sprint 008 Workstream C / Supreme P10: Agency Visual DNA — the
    // advertisement must belong to THIS agency. Logo fetch is non-fatal.
    const agencyLogoPng = await fetchLogoBuffer(agency.logoUrl);
    const dna = await resolveAgencyVisualDna({ logo: agencyLogoPng });
    const brand: BrandContext | null = dna
      ? { primaryColor: dna.primaryColor, secondaryColor: dna.secondaryColor, accentColor: dna.accentColor }
      : null;

    const badge = selectBadgeConfig({ style, density, positionCount: positions.length, platformFormat });

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
        model: "gpt-native-trust-layer",
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

    const nextVersion = advertisement.currentVersion + 1;
    // Workstream G: the pixel-borne, human-readable ownership identifier —
    // micro-printed in the trust zone AND embedded in metadata, verifiable
    // via the /v/ page even after platforms strip EXIF.
    const generationId = `KAI-${advertisementId.slice(-8).toUpperCase()}-V${nextVersion}`;

    const provider = getImageGenerationProvider();
    const basePrompt = buildMasterAdvertisementPrompt(brief, facts, {
      widthPx: platformFormat.widthPx,
      heightPx: platformFormat.heightPx,
      brand,
    });

    // Sprint 008 Workstream E: bounded generate → trust-layer → verify
    // loop. GPT owns every attempt's composition in full (Supreme P2);
    // KAI's only remedies are regenerate-once-with-feedback or flag for
    // review — never redrawing.
    const MAX_ATTEMPTS = 2;
    let finalPng!: Buffer;
    let usage!: { model: string; latencyMs: number; estimatedCostUsd: number | null };
    let acceptance!: Awaited<ReturnType<typeof runGptNativeAcceptance>>;
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attemptsUsed = attempt;
      const imageStartedAt = Date.now();
      const prompt =
        attempt === 1
          ? basePrompt
          : `${basePrompt}\n\n=== CORRECTIONS FROM THE PREVIOUS ATTEMPT — fix every one ===\n${acceptance.defects.map((d) => `- ${d}`).join("\n")}`;

      try {
        const result = await provider.generate({
          prompt,
          widthPx: platformFormat.widthPx,
          heightPx: platformFormat.heightPx,
          quality: getEnv().KAI_IMAGE_QUALITY,
        });
        finalPng = Buffer.from(result.output.imageBase64, "base64");
        usage = result.usage;

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
          imageQuality: getEnv().KAI_IMAGE_QUALITY,
        });
      } catch (error) {
        if (error instanceof ImageProviderNotImplementedError) {
          throw new AppError(
            "GPT-Native Advertisement Architecture requires the KAI Creative Engine to be configured — there is no deterministic fallback for a GPT-owned composition.",
            503,
          );
        }
        await costTrackingService.record({
          operationType: "FULL_AD_GENERATION",
          provider: "openai",
          model: "unknown",
          inputTokens: null,
          outputTokens: null,
          latencyMs: Date.now() - imageStartedAt,
          success: false,
          errorMessage: error instanceof Error ? error.message : "GPT-native image generation failed",
          agencyId,
          userId: actorId,
          advertisementId,
        });
        log.error({ advertisementId, attempt, err: error }, "GPT-native advertisement generation failed");
        throw error;
      }

      // KAI Trust Layer: the ONLY thing composited onto GPT's returned
      // image — QR, agency logo, verification text, generation ID, metadata.
      finalPng = await applyTrustLayer({
        baseImagePng: finalPng,
        qrPng: qrResult.png,
        agencyName: agency.name,
        raLicenseId: compactRaLicenseId,
        version: nextVersion,
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
        generationId,
        agencyLogoPng,
      });

      acceptance = await runGptNativeAcceptance({
        finalPng,
        facts,
        expectedQrUrl: qrUrl,
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
        platformFormatKey: input.platformFormat,
      });

      // The QR gate is the same absolute law as the legacy pipeline's
      // deterministic gate: an advertisement whose verification QR does
      // not decode from the final pixels must never be accepted.
      if (!acceptance.qrDecodable) {
        throw new AppError(
          "Advertisement generation failed a deterministic acceptance gate: the verification QR could not be decoded from the final image.",
          500,
        );
      }

      if (!acceptance.shouldRegenerate) break;
      log.warn(
        { advertisementId, attempt, defects: acceptance.defects },
        attempt < MAX_ATTEMPTS
          ? "GPT-native acceptance found defects — regenerating with corrections"
          : "GPT-native acceptance defects remain after final attempt — flagging for review",
      );
    }

    if (acceptance.defects.length > 0) {
      densityWarnings.push(
        ...acceptance.defects.map((d) => `KAI verification: ${d}`),
      );
    }

    const trustCheck = runTrustCheck({
      agencyName: agency.name,
      raLicenseId: agency.registrationNumber,
      qrDecodable: qrResult.decodable,
      contactPresent: Boolean(contact.phone || contact.email || contact.whatsapp),
      advertisementTexts: [advertisement.header, advertisement.footer, "MEA REGISTERED AGENCY", "VERIFY AGENCY"],
    });
    trustCheck.warnings = [...trustCheck.warnings, ...densityWarnings];

    if (!direction.truth.pass) {
      trustCheck.warnings = [...trustCheck.warnings, ...direction.truth.violations];
    }

    // Workstream E: an advertisement with unresolved verification defects
    // is never presented as TRUST_READY — the recruiter must look at it.
    if (acceptance.defects.length > 0 && trustCheck.status === "TRUST_READY") {
      trustCheck.status = "REVIEW_RECOMMENDED";
    }

    const imageSha256 = computeImageSha256(finalPng);
    const generatedAssetUrl = `data:image/png;base64,${finalPng.toString("base64")}`;

    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.advertisement.update({
        where: { id: advertisementId },
        data: {
          platformFormat: input.platformFormat,
          density,
          style,
          theme: advertisement.theme as Prisma.InputJsonValue,
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
            pipeline: "GPT_NATIVE",
            platformFormat: input.platformFormat,
            density,
            style,
            badge,
            trustStatus: trustCheck.status,
            commercialBrief: brief,
            commercialScore: direction.commercialScore,
            imageModel: usage.model,
            // Workstream G: the authenticity record — generation ID (also
            // micro-printed on the artwork + in EXIF) and the content hash
            // any re-uploaded copy can be matched against via /v/.
            generationId,
            imageSha256,
            // Workstream E/P16: per-generation verification evidence —
            // the raw material for continuous benchmarking.
            acceptance: {
              attempts: attemptsUsed,
              visionChecksRan: acceptance.visionChecksRan,
              visualQaScore: acceptance.visualQaScore,
              defects: acceptance.defects,
            },
          } as unknown as Prisma.InputJsonValue,
          changeSummary: "Full advertisement generated (GPT-Native pipeline)",
          regenerationMethod: "AI_REGENERATED",
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId,
          action: "generated",
          metadata: {
            platformFormat: input.platformFormat,
            style,
            density,
            trustStatus: trustCheck.status,
            pipeline: "GPT_NATIVE",
          },
          actorId,
        },
      });

      return result;
    });

    await generationQuotaService.recordSuccessfulGeneration(agencyId);

    await costTrackingService.record({
      operationType: "FULL_AD_GENERATION",
      provider: "kai",
      model: "gpt-native-trust-layer",
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
      metadata: { style, density, trustStatus: trustCheck.status, pipeline: "GPT_NATIVE" },
    });

    log.info(
      { advertisementId, style, density, trustStatus: trustCheck.status, pipeline: "GPT_NATIVE" },
      "GPT-Native advertisement generated",
    );

    return updated;
  },
};

/**
 * Fetches the agency's real logo bytes for Trust-Layer compositing and
 * Visual DNA extraction. Always our own storage's URL (set at
 * registration via storageService). Non-fatal: no logo simply means no
 * logo on the badge and industry-default DNA — never a failed generation.
 */
async function fetchLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
