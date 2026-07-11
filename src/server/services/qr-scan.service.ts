import { qrScanEventRepository } from "@/server/repositories/qr-scan-event.repository";
import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { createLogger } from "@/lib/logger";

const log = createLogger("qr-scan");

interface ScanContext {
  advertisementTrackingId: string; // the advertisementId encoded in the QR
  sourcePlatform?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  deviceCategory?: string;
  referrer?: string;
}

interface ScanResolution {
  destinationUrl: string | null;
  agencyName: string | null;
  raLicenseId: string | null;
  verificationStatus: string | null;
}

/**
 * QR Redirect Flow (Sprint 004): "Scan -> KAI Tracking Endpoint -> Record
 * permitted event -> Redirect immediately to official verification
 * destination. No unnecessary intermediate screen." This resolves the
 * destination and records the event in one pass; the API route (see
 * src/app/v/[agencyVerificationId]/route.ts) does the actual HTTP
 * redirect.
 *
 * Privacy-preserving by construction: no candidate identity is ever
 * accepted here, no raw IP address parameter exists on this function at
 * all — only approximate geography the caller may have derived upstream.
 */
export const qrScanService = {
  async resolveAndRecordScan(
    agencyVerificationId: string,
    context: ScanContext,
  ): Promise<ScanResolution> {
    const verification = await agencyVerificationRepository.findById(agencyVerificationId);

    if (!verification) {
      log.warn({ agencyVerificationId }, "QR scan for unknown agency verification ID");
      return { destinationUrl: null, agencyName: null, raLicenseId: null, verificationStatus: null };
    }

    const agency = await agencyRepository.findById(verification.agencyId);
    const advertisement = await advertisementRepository
      .findById(context.advertisementTrackingId, verification.agencyId, true)
      .catch(() => null);

    const destinationUrl =
      verification.status === "VERIFIED" ? verification.officialVerificationUrl : null;

    if (advertisement) {
      await qrScanEventRepository.record({
        advertisement: { connect: { id: advertisement.id } },
        sourcePlatform: context.sourcePlatform,
        countryCode: context.countryCode,
        region: context.region,
        city: context.city,
        deviceCategory: context.deviceCategory,
        referrer: context.referrer,
        destinationUrl,
        redirectSuccess: Boolean(destinationUrl),
      });
    } else {
      log.warn(
        { agencyVerificationId, advertisementTrackingId: context.advertisementTrackingId },
        "QR scan for unknown/cross-tenant advertisement — event not recorded",
      );
    }

    return {
      destinationUrl,
      agencyName: agency?.name ?? null,
      raLicenseId: agency?.registrationNumber ?? null,
      verificationStatus: verification.status,
    };
  },
};
