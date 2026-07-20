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
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt } from "@/server/generation/gpt-native/master-prompt-builder";
import { applyTrustLayer } from "@/server/generation/gpt-native/trust-layer";
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

    const positions = advertisement.positions as unknown as { title: string; count?: number; experience?: string }[];
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

    const provider = getImageGenerationProvider();
    const imageStartedAt = Date.now();
    let finalPng: Buffer;
    let usage: { model: string; latencyMs: number; estimatedCostUsd: number | null };

    try {
      const prompt = buildMasterAdvertisementPrompt(brief, facts, {
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
      });
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
      log.error({ advertisementId, err: error }, "GPT-native advertisement generation failed");
      throw error;
    }

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

    // KAI Trust Layer: the ONLY thing composited onto GPT's returned
    // image — QR, agency verification, registration number, metadata.
    finalPng = await applyTrustLayer({
      baseImagePng: finalPng,
      qrPng: qrResult.png,
      agencyName: agency.name,
      raLicenseId: compactRaLicenseId,
      version: nextVersion,
      widthPx: platformFormat.widthPx,
      heightPx: platformFormat.heightPx,
    });

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
