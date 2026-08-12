import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { storageService } from "@/server/services/storage.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { buildAdvertisementFacts } from "@/server/generation/pipeline/requirement-intelligence";
import { buildAdvertisementDocument } from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
import { hasDna } from "@/server/generation/dna/registry";
import { resolveRegionIntelligence } from "@/server/generation/dna/region-intelligence";
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
    if (input.designDnaId && !hasDna(input.designDnaId)) {
      throw new AppError(`Unknown Design DNA "${input.designDnaId}".`, 400);
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

    // Agency DNA: the agency's permanent identity, resolved once from the
    // verified profile. Nothing here is invented — an agency that has not
    // filled in its profile gets fewer printed lines, never a substitute.
    const agencyDna = buildAgencyDna(agency);

    // Objective recruitment intelligence only: candidate supply geography,
    // hiring corridors, language preference, typical project background.
    // No profiling, no behavioural targeting, no inference about people.
    const region = resolveRegionIntelligence({
      country: advertisement.country,
      industry: advertisement.industry,
      positionTitles: positions.map((p) => p.title),
    });

    // The Advertisement JSON. From here on this document IS the
    // advertisement: the renderer converts it to pixels, the Editing
    // Engine edits it, and a re-render reproduces it exactly.
    const document = buildAdvertisementDocument({
      advertisementId,
      facts,
      agency: agencyDna,
      format: {
        key: input.platformFormat,
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
        dpi: null,
        printOrNewspaper: Boolean(input.printOrNewspaper),
      },
      region,
      preferredDnaId: input.designDnaId ?? null,
      preferredPack: input.designPack ?? null,
      footerStyle: agency.footerStyle,
    });

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
    let backgroundBuffer: Buffer;
    let renderedDocument = document;
    try {
      const result = await generateAdvertisement({
        document,
        facts,
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
        style: input.style ?? undefined,
        theme: input.theme ?? undefined,
        agencyLogoPng,
        qrPng: qrResult.png,
      });
      pngBuffer = result.imagePng;
      // Persisted alongside the advertisement so an edit re-renders over
      // this artwork instead of buying new artwork from the image model.
      backgroundBuffer = result.backgroundPng;
      renderedDocument = result.document;

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
      // Profile-supplied contact details are printed on the advertisement
      // too, so an agency that filled in its profile must not be flagged
      // for a missing contact.
      contactPresent: Boolean(
        facts.contact.phone ||
          facts.contact.email ||
          facts.contact.whatsapp ||
          agency.phone ||
          agency.whatsapp ||
          agency.officialEmail,
      ),
      advertisementTexts: [advertisement.header, advertisement.footer, "MEA REGISTERED AGENCY", "VERIFY AGENCY"],
    });

    const nextVersion = advertisement.currentVersion + 1;

    // Production bug fix (2026-08-07): this used to embed the entire
    // rendered PNG as a base64 data: URI directly in the database row —
    // a multi-MB string built and held in memory in the same request that
    // just ran several sharp/libvips compositing passes, then written
    // into the transaction below. Stored via the existing storage
    // abstraction instead (same path uploadAdvertisementSource already
    // uses), exactly like every other file this app persists.
    const uploaded = await storageService.uploadGeneratedAdvertisement({
      name: `${advertisementId}-v${nextVersion}.png`,
      data: pngBuffer,
    });
    const generatedAssetUrl = uploaded.url;

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
          documentJson: renderedDocument as unknown as Prisma.InputJsonValue,
          backgroundAssetUrl: `data:image/png;base64,${backgroundBuffer.toString("base64")}`,
          designDnaId: renderedDocument.design.dnaId,
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
            designDnaId: renderedDocument.design.dnaId,
            document: renderedDocument,
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
      metadata: { style, density, trustStatus: trustCheck.status, designDnaId: renderedDocument.design.dnaId },
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

/**
 * Contact and address lines now come from Agency DNA
 * (`src/server/generation/dna/agency-dna.ts`), which the renderer reads
 * off the document. They were duplicated here, which meant the trust
 * strip could be built from a different source than the one the document
 * recorded.
 */
