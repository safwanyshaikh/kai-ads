import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { renderAdvertisement } from "@/server/generation/pipeline/generate";
import {
  parseAdvertisementDocument,
  type AdvertisementDocument,
} from "@/server/generation/pipeline/advertisement-document";
import { applyEdits, type EditOperation } from "@/server/generation/pipeline/editing";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { AppError, NotFoundError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("advertisement-editing");

/**
 * The editing path.
 *
 * This service is the proof of the editing law rather than a restatement
 * of it. Read the imports: there is no text provider, no image provider,
 * no Creative Brief. An edit loads the Advertisement JSON, applies typed
 * operations to it, and re-renders over the artwork the advertisement
 * already has. It cannot call an AI model, because it has no way to.
 *
 * Consequences an agency actually feels:
 *   - correcting a salary is instant and free
 *   - correcting a salary does not change the photograph
 *   - the same edit applied twice produces the same advertisement
 */
export const advertisementEditingService = {
  async edit(advertisementId: string, agencyId: string, actorId: string, operations: EditOperation[]) {
    if (operations.length === 0) throw new AppError("No edit operations supplied.", 400);

    const advertisement = await advertisementRepository.findById(advertisementId, agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");

    if (!advertisement.documentJson) {
      // An advertisement generated before the JSON model existed has no
      // document to edit. Saying so plainly is better than silently
      // rebuilding one and re-rendering something the recruiter did not
      // approve — the design and artwork would both change under them.
      throw new AppError(
        "This advertisement was produced before KAI stored advertisements as structured data. " +
          "Generate it once more to enable editing.",
        409,
        "NO_DOCUMENT",
      );
    }

    const current = parseAdvertisementDocument(advertisement.documentJson);
    const { document, changes, unchanged } = applyEdits(current, operations);
    if (unchanged) {
      // A no-op edit is not history. Writing a version for it would fill
      // the timeline with entries a recruiter cannot tell apart.
      return { advertisement, changes, rerendered: false };
    }

    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const verification = await agencyVerificationRepository.findByAgencyId(agencyId);
    const qrUrl = buildQrTrackingUrl({
      agencyVerificationId: verification?.id ?? agencyId,
      advertisementId,
    });
    const qrResult = await generateAndVerifyQr(qrUrl);

    const rendered = await renderAdvertisement(document, {
      // The artwork the advertisement already has. No image call.
      backgroundPng: decodeDataUrl(advertisement.backgroundAssetUrl),
      agencyLogoPng: await fetchImageBuffer(agency.logoUrl),
      qrPng: qrResult.png,
    });

    const nextVersion = advertisement.currentVersion + 1;
    const generatedAssetUrl = `data:image/png;base64,${rendered.imagePng.toString("base64")}`;

    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.advertisement.update({
        where: { id: advertisementId },
        data: {
          // The document and the advertisement's own columns are written
          // together. Letting them drift would mean the next full
          // generation rebuilt its facts from stale columns and silently
          // undid the recruiter's edit.
          documentJson: document as unknown as Prisma.InputJsonValue,
          designDnaId: document.design.dnaId,
          header: document.facts.header,
          industry: document.facts.industry,
          country: document.facts.country,
          employer: document.facts.employer ?? null,
          positions: document.facts.positions as unknown as Prisma.InputJsonValue,
          benefits: document.facts.benefits as unknown as Prisma.InputJsonValue,
          interview: { events: document.facts.interview } as unknown as Prisma.InputJsonValue,
          contact: document.facts.contact as unknown as Prisma.InputJsonValue,
          footer: document.facts.footer ?? null,
          generatedAssetUrl,
          currentVersion: nextVersion,
        },
      });

      await tx.advertisementVersion.create({
        data: {
          advertisementId,
          versionNumber: nextVersion,
          snapshot: { document } as unknown as Prisma.InputJsonValue,
          changeSummary: changes.map((c) => c.summary).join(" "),
          // The Critical Editing USP: which section changed, proved by the
          // operation that changed it rather than asserted afterwards.
          changedSection: changes[0].section === "DESIGN" ? null : changes[0].section,
          regenerationMethod: "MANUAL_EDIT",
          previousSectionData: current.facts as unknown as Prisma.InputJsonValue,
          newSectionData: document.facts as unknown as Prisma.InputJsonValue,
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId,
          action: "edited",
          metadata: { changes: changes.map((c) => c.summary), revision: document.revision },
          actorId,
        },
      });

      return result;
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementUpdated,
      entity: "Advertisement",
      entityId: advertisementId,
      agencyId,
      actorId,
      metadata: { revision: document.revision, sections: changes.map((c) => c.section) },
    });

    log.info(
      { advertisementId, revision: document.revision, sections: changes.map((c) => c.section) },
      "Advertisement edited and re-rendered without AI",
    );

    return { advertisement: updated, changes, rerendered: true };
  },

  /** The advertisement's current structured document, for the editor UI. */
  async getDocument(advertisementId: string, agencyId: string): Promise<AdvertisementDocument | null> {
    const advertisement = await advertisementRepository.findById(advertisementId, agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");
    if (!advertisement.documentJson) return null;
    return parseAdvertisementDocument(advertisement.documentJson);
  },
};

function decodeDataUrl(value: string | null | undefined): Buffer | null {
  if (!value) return null;
  const comma = value.indexOf(",");
  if (!value.startsWith("data:image/") || comma < 0) return null;
  return Buffer.from(value.slice(comma + 1), "base64");
}

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
