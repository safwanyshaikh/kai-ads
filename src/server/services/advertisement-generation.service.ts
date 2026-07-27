import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { buildAdvertisementFacts } from "@/server/generation/pipeline/requirement-intelligence";
import { generateAdvertisement } from "@/server/generation/pipeline/generate";
import { runTrustCheck } from "@/server/generation/trust-validation.service";
import { isValidThemeKey } from "@/server/generation/theme-recommendation.service";
import { getPlatformFormat, isValidPlatformFormatKey } from "@/lib/platform-formats";
import { ImageProviderNotImplementedError } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { AppError, NotFoundError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import type { GenerateAdvertisementInput } from "@/lib/validations/advertisement-generation";

const log = createLogger("advertisement-generation");

export const advertisementGenerationService = {
  /**
   * The one production advertisement pipeline: Requirement Intelligence ->
   * Creative Brief -> one GPT Image call -> Minimal Branding Overlay ->
   * persist. This is the exact same function the batch/benchmark scripts
   * call — there is no other code path and no flag choosing a different
   * engine.
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
    if (input.theme && !isValidThemeKey(input.theme)) {
      throw new AppError(`Unknown theme "${input.theme}".`, 400);
    }

    await generationQuotaService.assertGenerationAllowed(agencyId);

    const advertisement = await advertisementRepository.findById(advertisementId, agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");

    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const verification = await agencyVerificationRepository.findByAgencyId(agencyId);
    const platformFormat = getPlatformFormat(input.platformFormat);

    // Requirement Intelligence: grounded facts assembled from the
    // Advertisement/Agency records (currency-corrected, never fabricated).
    const facts = buildAdvertisementFacts(advertisement, agency);

    const positions = advertisement.positions as unknown as { title: string; count?: number }[];
    const density = classifyDensity(positions.map((p) => ({ title: p.title, count: p.count })));
    const style = input.style ?? "VISUAL";

    const agencyLogoPng = await fetchImageBuffer(agency.logoUrl);

    const badge = selectBadgeConfig({ style, density, positionCount: positions.length, platformFormat });

    // If the agency has no verification record yet, the QR still
    // generates — it simply points at a verification ID whose status is
    // UNVERIFIED, which the public /v/ page reports honestly rather than
    // claiming a verification that doesn't exist.
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
        model: "branding-overlay",
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

    let pngBuffer: Buffer;
    try {
      const result = await generateAdvertisement({
        facts,
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
        style: input.style ?? undefined,
        theme: input.theme ?? undefined,
        agencyLogoPng,
        qrPng: qrResult.png,
        footerText: agency.name,
      });
      pngBuffer = result.imagePng;

      await costTrackingService.record({
        operationType: "FULL_AD_GENERATION",
        provider: "openai",
        model: result.usage.model,
        inputTokens: null,
        outputTokens: null,
        latencyMs: result.usage.latencyMs,
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
          "The KAI Creative Engine must be configured to generate advertisements — there is no fallback renderer.",
          503,
        );
      }
      await costTrackingService.record({
        operationType: "FULL_AD_GENERATION",
        provider: "openai",
        model: "unknown",
        inputTokens: null,
        outputTokens: null,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Advertisement generation failed",
        agencyId,
        userId: actorId,
        advertisementId,
      });
      log.error({ advertisementId, err: error }, "Advertisement generation failed");
      throw error;
    }

    const trustCheck = runTrustCheck({
      agencyName: agency.name,
      raLicenseId: agency.registrationNumber,
      qrDecodable: qrResult.decodable,
      contactPresent: Boolean(facts.contact.phone || facts.contact.email || facts.contact.whatsapp),
      advertisementTexts: [advertisement.header, advertisement.footer, "MEA REGISTERED AGENCY", "VERIFY AGENCY"],
    });

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
            badge,
            trustStatus: trustCheck.status,
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
};

/**
 * Fetches an image (agency logo, always our own storage's URL) and returns
 * its raw bytes. Failure is non-fatal — a logo that can't be fetched just
 * means no logo on the advertisement, not a broken generation.
 */
async function fetchImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
