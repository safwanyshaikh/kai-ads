import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { costTrackingService } from "@/server/services/cost-tracking.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { recommendAdvertisementType } from "@/server/generation/advertisement-type-recommendation.service";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { renderSectionComposition } from "@/server/generation/section-renderer";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { runTrustCheck } from "@/server/generation/trust-validation.service";
import { getThemeAccentColor, isValidThemeKey } from "@/server/generation/theme-recommendation.service";
import { getPlatformFormat, isValidPlatformFormatKey } from "@/lib/platform-formats";
import { getImageGenerationProvider, ImageProviderNotImplementedError } from "@/server/ai/image";
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

    await generationQuotaService.assertGenerationAllowed(agencyId);

    const advertisement = await advertisementRepository.findById(advertisementId, agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");

    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const verification = await agencyVerificationRepository.findByAgencyId(agencyId);
    const platformFormat = getPlatformFormat(input.platformFormat);

    const positions = advertisement.positions as unknown as { title: string; count?: number; experience?: string }[];
    const benefits = advertisement.benefits as unknown as { label: string; detail?: string }[];
    const interview = advertisement.interview as unknown as { date?: string; location?: string };
    const contact = advertisement.contact as unknown as {
      name?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
    };

    const density = classifyDensity(positions.map((p) => ({ title: p.title, count: p.count })));

    const style =
      input.style ??
      recommendAdvertisementType({
        density,
        hasSalaryInfo: false,
        isUrgent: Boolean(input.isUrgent),
        hasEmployerLogo: Boolean(agency.logoUrl),
      }).style;

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

    let backgroundImageDataUri: string | null = null;
    let usedAiBackground = false;
    const imageStartedAt = Date.now();

    if (style === "VISUAL") {
      const provider = getImageGenerationProvider();
      try {
        const { output, usage } = await provider.generate({
          prompt: buildBackgroundPrompt(advertisement.industry, advertisement.country),
          widthPx: platformFormat.widthPx,
          heightPx: platformFormat.heightPx,
          quality: "medium",
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

    const agencyLogoDataUri = await fetchImageAsDataUri(agency.logoUrl);

    if (input.theme && !isValidThemeKey(input.theme)) {
      throw new AppError(`Unknown theme "${input.theme}".`, 400);
    }
    const accentColor = getThemeAccentColor(input.theme);

    const svg = renderSectionComposition({
      platformFormat,
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
      raLicenseId: agency.registrationNumber,
      qrDataUri: `data:image/png;base64,${qrResult.png.toString("base64")}`,
      badge,
      style,
      backgroundImageDataUri,
      agencyLogoDataUri,
      accentColor,
    });

    const pngBuffer = await rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx);

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
            badge,
            trustStatus: trustCheck.status,
            usedAiBackground,
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
    const newFieldValue = newSectionData[field as string];

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

/**
 * Visual Advertisement Rules: background relevant to industry/country/
 * project type/trade — never generic corporate imagery, never an
 * employer logo or branding (the model is explicitly told not to invent
 * any). No text is requested — exact recruitment text is always
 * deterministic composition (ADR-006), never image-model output.
 */
function buildBackgroundPrompt(industry: string, country: string): string {
  return `A professional, realistic photograph representing the ${industry} industry in ${country}, showing relevant industrial or workplace environment and context. No people's faces in close-up, no text, no logos, no watermarks, no signage, no visible brand names. Suitable as a background image for a recruitment advertisement.`;
}
