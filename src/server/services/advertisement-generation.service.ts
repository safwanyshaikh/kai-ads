import type { Prisma } from "@prisma/client";
import sharp from "sharp";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { normaliseBadges } from "@/server/generation/pipeline/footer-styles";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { storageService } from "@/server/services/storage.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import {
  buildQrTrackingUrl,
  generateAndVerifyQr,
} from "@/server/generation/qr-renderer";
import { buildAdvertisementFacts } from "@/server/generation/pipeline/requirement-intelligence";
import { generateAdvertisement } from "@/server/generation/pipeline/generate";
import {
  runVisualQaGate,
  VisualQaGateError,
} from "@/server/generation/visual-qa-gate";
import { runTrustCheck } from "@/server/generation/trust-validation.service";
import { isValidThemeKey } from "@/server/generation/theme-recommendation.service";
import {
  getPlatformFormat,
  isValidPlatformFormatKey,
} from "@/lib/platform-formats";
import { ImageProviderNotImplementedError } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import { AUDIT_ACTIONS } from "@/lib/constants";
import {
  AppError,
  NotFoundError,
} from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import type { GenerateAdvertisementInput } from "@/lib/validations/advertisement-generation";

const log = createLogger(
  "advertisement-generation",
);

/**
 * Final delivery image settings.
 *
 * The advertisement is kept as PNG through:
 *
 * Gemini
 *   ↓
 * KAI Rendering Engine
 *   ↓
 * Visual QA
 *
 * Only after the image passes QA do we create the
 * lightweight WEBP delivery asset.
 */
const GENERATED_WEBP_QUALITY = 85;

export const advertisementGenerationService = {
  /**
   * Production advertisement pipeline:
   *
   * Requirement Intelligence
   *   ->
   * Creative Brief
   *   ->
   * Gemini Creative Engine
   *   ->
   * KAI Rendering Engine
   *   ->
   * FINAL RASTER
   *   ->
   * KAI Visual QA
   *   ->
   * WEBP DELIVERY OPTIMIZATION
   *   ->
   * persist only after QA PASS
   *
   * Gemini owns visual creativity.
   * KAI owns factual precision, identity and publication gating.
   */
  async generate(
    advertisementId: string,
    agencyId: string,
    actorId: string,
    input: GenerateAdvertisementInput,
  ) {
    if (
      !isValidPlatformFormatKey(
        input.platformFormat,
      )
    ) {
      throw new AppError(
        `Unknown platform format "${input.platformFormat}".`,
        400,
      );
    }

    if (
      input.theme &&
      !isValidThemeKey(input.theme)
    ) {
      throw new AppError(
        `Unknown theme "${input.theme}".`,
        400,
      );
    }

    await generationQuotaService.assertGenerationAllowed(
      agencyId,
    );

    const advertisement =
      await advertisementRepository.findById(
        advertisementId,
        agencyId,
      );

    if (!advertisement) {
      throw new NotFoundError(
        "Advertisement",
      );
    }

    const agency =
      await agencyRepository.findById(
        agencyId,
      );

    if (!agency) {
      throw new NotFoundError(
        "Agency",
      );
    }

    const verification =
      await agencyVerificationRepository.findByAgencyId(
        agencyId,
      );

    const platformFormat =
      getPlatformFormat(
        input.platformFormat,
      );

    /**
     * Requirement Intelligence
     *
     * Facts are grounded in the advertisement
     * + agency records.
     */
    const facts =
      buildAdvertisementFacts(
        advertisement,
        agency,
      );

    const positions =
      advertisement.positions as unknown as Array<{
        title: string;
        count?: number;
      }>;

    const density =
      classifyDensity(
        positions.map(
          (position) => ({
            title:
              position.title,
            count:
              position.count,
          }),
        ),
      );

    const style =
      input.style ?? "VISUAL";

    const agencyLogoPng =
      await fetchImageBuffer(
        agency.logoUrl,
      );

    const badge =
      selectBadgeConfig({
        style,
        density,
        positionCount:
          positions.length,
        platformFormat,
      });

    /**
     * QR verification.
     */
    const verificationId =
      verification?.id ??
      agencyId;

    const qrUrl =
      buildQrTrackingUrl({
        agencyVerificationId:
          verificationId,
        advertisementId,
      });

    const startedAt =
      Date.now();

    let qrResult;

    try {
      qrResult =
        await generateAndVerifyQr(
          qrUrl,
        );
    } catch (error) {
      await costTrackingService.record(
        {
          operationType:
            "FULL_AD_GENERATION",
          provider: "kai",
          model:
            "branding-overlay",
          inputTokens: null,
          outputTokens: null,
          latencyMs:
            Date.now() -
            startedAt,
          success: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : "QR generation failed",
          agencyId,
          userId:
            actorId,
        },
      );

      throw error;
    }

    let pngBuffer: Buffer;
    let generationModel =
      "unknown";
    let generationLatencyMs =
      0;

    try {
      /**
       * Gemini creates the complete
       * creative advertisement.
       *
       * KAI applies exact verified facts
       * + identity + QR.
       */
      const result =
        await generateAdvertisement(
          {
            facts,

            widthPx:
              platformFormat.widthPx,

            heightPx:
              platformFormat.heightPx,

            style:
              input.style ??
              undefined,

            theme:
              input.theme ??
              undefined,

            agencyLogoPng,

            qrPng:
              qrResult.png,

            agencyName:
              agency.name,

            registrationNumber:
              agency.registrationNumber,

            contactLine:
              buildContactLine(
                facts.contact,
                agency,
              ),

            addressLine:
              buildAddressLine(
                agency,
              ),

            footerStyle:
              agency.footerStyle,

            brandBadges:
              normaliseBadges(
                agency.brandBadges,
              ),
          },
        );

      pngBuffer =
        result.imagePng;

      generationModel =
        result.usage.model;

      generationLatencyMs =
        result.usage.latencyMs;

      /**
       * FINAL VISUAL QA
       *
       * QA judges the exact PNG that will
       * become the final deliverable — including its ACTUAL height, which
       * can be taller than platformFormat.heightPx when the fact layer
       * grew the canvas for a dense requirement. Describing the image as
       * shorter than it really is misdescribes the exact buffer QA is
       * looking at.
       */
      const visualQa =
        await runVisualQaGate({
          imagePng:
            pngBuffer,

          platformFormatKey:
            input.platformFormat,

          widthPx:
            platformFormat.widthPx,

          heightPx:
            result.heightPx,
        });

      await costTrackingService.record(
        {
          operationType:
            "FULL_AD_GENERATION",

          provider:
            "gemini",

          model:
            generationModel,

          inputTokens:
            null,

          outputTokens:
            null,

          latencyMs:
            generationLatencyMs,

          success:
            true,

          agencyId,

          userId:
            actorId,

          advertisementId,

          imageSize:
            `${platformFormat.widthPx}x${platformFormat.heightPx}`,

          imageQuality:
            getEnv()
              .KAI_IMAGE_QUALITY,
        },
      );

      log.info(
        {
          advertisementId,

          visualQaScore:
            visualQa.overallScore,

          visualQaVerdict:
            visualQa.verdict,

          visualQaDefects:
            visualQa.defects,

          visualQaCatastrophicDefects:
            visualQa.catastrophicDefects,
        },
        "Final advertisement passed KAI Visual QA",
      );
    } catch (error) {
      /**
       * Visual QA rejection.
       */
      if (
        error instanceof
        VisualQaGateError
      ) {
        await costTrackingService.record(
          {
            operationType:
              "FULL_AD_GENERATION",

            provider:
              "gemini",

            model:
              generationModel,

            inputTokens:
              null,

            outputTokens:
              null,

            latencyMs:
              Date.now() -
              startedAt,

            success:
              false,

            errorMessage:
              error.message,

            agencyId,

            userId:
              actorId,

            advertisementId,

            imageSize:
              `${platformFormat.widthPx}x${platformFormat.heightPx}`,

            imageQuality:
              getEnv()
                .KAI_IMAGE_QUALITY,
          },
        );

        const detail =
          error.result
            .catastrophicDefects
            .length > 0
            ? error.result.catastrophicDefects.join(
                "; ",
              )
            : error.result.defects.join(
                "; ",
              );

        log.warn(
          {
            advertisementId,

            visualQaScore:
              error.result
                .overallScore,

            visualQaVerdict:
              error.result
                .verdict,

            defects:
              error.result.defects,

            catastrophicDefects:
              error.result
                .catastrophicDefects,
          },
          "Advertisement blocked by KAI Visual QA",
        );

        throw new AppError(
          `KAI Visual QA rejected this advertisement (${error.result.overallScore}/100). ${detail}`,
          422,
        );
      }

      /**
       * Image provider not configured.
       */
      if (
        error instanceof
        ImageProviderNotImplementedError
      ) {
        throw new AppError(
          "The KAI Creative Engine must be configured to generate advertisements — there is no fallback renderer.",
          503,
        );
      }

      /**
       * Any other generation error.
       */
      await costTrackingService.record(
        {
          operationType:
            "FULL_AD_GENERATION",

          provider:
            "gemini",

          model:
            generationModel ||
            "unknown",

          inputTokens:
            null,

          outputTokens:
            null,

          latencyMs:
            Date.now() -
            startedAt,

          success:
            false,

          errorMessage:
            error instanceof Error
              ? error.message
              : "Advertisement generation failed",

          agencyId,

          userId:
            actorId,

          advertisementId,
        },
      );

      log.error(
        {
          advertisementId,
          err: error,
        },
        "Advertisement generation failed",
      );

      throw error;
    }

    /**
     * Trust validation.
     */
    const trustCheck =
      runTrustCheck({
        agencyName:
          agency.name,

        raLicenseId:
          agency.registrationNumber,

        qrDecodable:
          qrResult.decodable,

        contactPresent:
          Boolean(
            facts.contact.phone ||
              facts.contact.email ||
              facts.contact.whatsapp ||
              agency.phone ||
              agency.whatsapp ||
              agency.officialEmail,
          ),

        advertisementTexts:
          [
            advertisement.header,
            advertisement.footer,
            "MEA REGISTERED AGENCY",
            "VERIFY AGENCY",
          ],
      });

    const nextVersion =
      advertisement.currentVersion +
      1;

    /**
     * IMPORTANT:
     *
     * Do NOT optimize before Visual QA.
     * QA must inspect the original final raster.
     *
     * Only after QA passes do we create
     * the lightweight WEBP delivery asset.
     */
    const optimizedWebp =
      await optimizeGeneratedAdvertisement(
        pngBuffer,
      );

    /**
     * Storage now receives WEBP instead
     * of a multi-megabyte PNG.
     */
    const uploaded =
      await storageService.uploadGeneratedAdvertisement(
        {
          name: `${advertisementId}-v${nextVersion}.webp`,
          data:
            optimizedWebp,
        },
      );

    const generatedAssetUrl =
      uploaded.url;

    /**
     * Persist approved generation.
     */
    const updated =
      await db.$transaction(
        async (
          tx: Prisma.TransactionClient,
        ) => {
          const result =
            await tx.advertisement.update(
              {
                where: {
                  id:
                    advertisementId,
                },

                data: {
                  platformFormat:
                    input.platformFormat,

                  density,

                  style,

                  theme: (
                    input.theme
                      ? {
                          key:
                            input.theme,
                        }
                      : advertisement.theme
                  ) as Prisma.InputJsonValue,

                  generatedAssetUrl,

                  badgeConfig:
                    badge as unknown as Prisma.InputJsonValue,

                  trustStatus:
                    trustCheck.status,

                  trustWarnings:
                    trustCheck.warnings as unknown as Prisma.InputJsonValue,

                  currentVersion:
                    nextVersion,
                },
              },
            );

          await tx.advertisementVersion.create(
            {
              data: {
                advertisementId,

                versionNumber:
                  nextVersion,

                snapshot: {
                  platformFormat:
                    input.platformFormat,

                  density,

                  style,

                  badge,

                  trustStatus:
                    trustCheck.status,
                } as unknown as Prisma.InputJsonValue,

                changeSummary:
                  "Full advertisement generated and passed KAI Visual QA",

                regenerationMethod:
                  "AI_REGENERATED",

                createdById:
                  actorId,
              },
            },
          );

          await tx.advertisementHistory.create(
            {
              data: {
                advertisementId,

                action:
                  "generated",

                metadata: {
                  platformFormat:
                    input.platformFormat,

                  style,

                  density,

                  trustStatus:
                    trustCheck.status,
                },

                actorId,
              },
            },
          );

          return result;
        },
      );

    await generationQuotaService.recordSuccessfulGeneration(
      agencyId,
    );

    await auditLogService.record(
      {
        action:
          AUDIT_ACTIONS.advertisementGenerated,

        entity:
          "Advertisement",

        entityId:
          advertisementId,

        agencyId,

        actorId,

        metadata: {
          style,

          density,

          trustStatus:
            trustCheck.status,
        },
      },
    );

    log.info(
      {
        advertisementId,

        style,

        density,

        trustStatus:
          trustCheck.status,
      },

      "Advertisement generated and published after KAI Visual QA",
    );

    return updated;
  },
};

/**
 * Convert the already-approved PNG into a
 * lightweight WebP delivery asset.
 *
 * Dimensions are NOT changed.
 *
 * This affects delivery size only.
 */
async function optimizeGeneratedAdvertisement(
  pngBuffer: Buffer,
): Promise<Buffer> {
  return sharp(pngBuffer)
    .webp({
      quality:
        GENERATED_WEBP_QUALITY,
      effort: 4,
    })
    .toBuffer();
}

/**
 * Fetch agency logo.
 *
 * Failure is non-fatal.
 */
async function fetchImageBuffer(
  url:
    | string
    | null
    | undefined,
): Promise<Buffer | null> {
  if (!url) {
    return null;
  }

  try {
    const response =
      await fetch(url);

    if (!response.ok) {
      return null;
    }

    return Buffer.from(
      await response.arrayBuffer(),
    );
  } catch {
    return null;
  }
}

/**
 * Contact details.
 */
function buildContactLine(
  contact: {
    phone?: string;
    email?: string;
    whatsapp?: string;
  },
  agency: {
    phone?: string | null;
    whatsapp?: string | null;
    officialEmail?: string | null;
  },
): string | null {
  const phone =
    contact.phone ??
    agency.phone ??
    agency.whatsapp ??
    undefined;

  const email =
    contact.email ??
    agency.officialEmail ??
    undefined;

  const parts = [
    email,
    phone,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );

  return parts.length > 0
    ? parts.join(
        " | ",
      )
    : null;
}

/**
 * Office address and website.
 */
function buildAddressLine(
  agency: {
    officeAddress?:
      | string
      | null;

    website?:
      | string
      | null;
  },
): string | null {
  const parts = [
    agency.officeAddress,
    agency.website,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );

  return parts.length > 0
    ? parts.join(
        "  ·  ",
      )
    : null;
}
