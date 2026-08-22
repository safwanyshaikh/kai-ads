/**
 * DTP RENDERING — approved content to a newspaper classified.
 *
 * The whole point of this service is what it does NOT do: it never
 * calls an image model. A classified is set, not illustrated. Routing
 * it through the creative pipeline would spend a photographic
 * generation on an advertisement that prints in one column of newsprint
 * at 300dpi, and would hand the rendering of verified recruitment facts
 * to a model that cannot be trusted with them.
 *
 * It consumes the SAME tenant-approved content the social pipeline
 * consumes. Only the composition differs — that is the entire
 * relationship between the two engines, and the reason the approval
 * gate sits upstream of both.
 */
import type { AdvertisementOutputType } from "@prisma/client";

import { brandAsset, type BrandAsset } from "@/lib/brand-identity";
import {
  DTP_CLASSIFIED_WIDTH_CM,
  renderDtpClassifiedSvg,
  selectDtpBooking,
  type DtpAdHeightCm,
  type DtpAdvertisement,
  type DtpBookingSelection,
  type DtpVariant,
} from "@/server/generation/dtp";

/** The two DTP modes, and the one output that is not DTP at all. */
export function isDtpOutput(
  outputType: AdvertisementOutputType,
): outputType is "DTP_BW" | "DTP_COLOUR" {
  return outputType === "DTP_BW" || outputType === "DTP_COLOUR";
}

export function dtpVariantFor(outputType: "DTP_BW" | "DTP_COLOUR"): DtpVariant {
  return outputType === "DTP_BW" ? "BW" : "COLOUR";
}

export interface DtpRenderRequest {
  outputType: "DTP_BW" | "DTP_COLOUR";
  /** Approved content, already mapped to the compositor's shape. */
  ad: DtpAdvertisement;
  addressLines?: string[];
  established?: string | null;
  interviewVenue?: string | null;
  /**
   * The CLIENT's logo as uploaded by the tenant into its own field.
   *
   * Passed as a raw buffer and tagged here, so the only way a mark
   * reaches the client slot is by having been put in the client field.
   * Nothing extracted from an attachment arrives through this path.
   */
  clientLogoPng?: Buffer | null;
  tenantLogoPng?: Buffer | null;
  /**
   * KAI's verification QR, already generated and decode-verified by
   * qr-renderer. Tagged here with the KAI role, so the only mark that
   * can reach the verification slot is one KAI produced — a tenant's
   * or client's own QR is refused by the identity guard rather than
   * printed as though KAI had verified it.
   *
   * Absent when the tenant has no verification: no placeholder is
   * drawn and nothing is reserved.
   */
  verificationQrPng?: Buffer | null;
  /**
   * The height the tenant has already purchased.
   *
   * Omitted, the compositor recommends one. Supplied, it is honoured:
   * an agency that has bought a 6x8 needs a 6x8, and being handed a
   * 6x10 because the content would sit more comfortably there is not a
   * service — it is a booking they cannot place. Content is fitted into
   * the purchased area, and fails closed if it genuinely cannot be.
   */
  heightCm?: DtpAdHeightCm;
}

export interface DtpRenderResult extends DtpBookingSelection {
  variant: DtpVariant;
  /**
   * Always false, asserted rather than assumed.
   *
   * Carried in the result so the claim "DTP costs no image generation"
   * is verifiable by a caller and by tests, instead of being a property
   * of this file that a future edit could quietly remove.
   */
  usedImageGeneration: false;
}

/**
 * Composes the classified and reports the booking it needs.
 *
 * The height is not an input. A classified is sold by the square
 * centimetre and the content decides how many it needs, so the size is
 * an OUTPUT the tenant is shown — see selectDtpBooking.
 */
export function renderDtpAdvertisement(request: DtpRenderRequest): DtpRenderResult {
  const variant = dtpVariantFor(request.outputType);

  const clientLogo: BrandAsset<"CLIENT_LOGO"> | null = request.clientLogoPng
    ? brandAsset("CLIENT_LOGO", request.clientLogoPng)
    : null;
  const tenantLogo: BrandAsset<"TENANT_PRIMARY_LOGO"> | null = request.tenantLogoPng
    ? brandAsset("TENANT_PRIMARY_LOGO", request.tenantLogoPng)
    : null;
  const verificationQr: BrandAsset<"KAI_VERIFICATION_QR"> | null = request.verificationQrPng
    ? brandAsset("KAI_VERIFICATION_QR", request.verificationQrPng)
    : null;

  const ad: DtpAdvertisement = {
    ...request.ad,
    verificationQr: verificationQr ?? request.ad.verificationQr ?? null,
    tenant: { ...request.ad.tenant, logo: tenantLogo ?? request.ad.tenant.logo ?? null },
    // A client band exists only when the tenant supplied a client. An
    // absent client logo is absent — never substituted with the
    // agency's own mark, which would credit the wrong company.
    client: request.ad.client || clientLogo
      ? {
          name: request.ad.client?.name ?? null,
          logo: clientLogo ?? request.ad.client?.logo ?? null,
        }
      : null,
  };

  const common = {
    ad,
    variant,
    addressLines: request.addressLines,
    established: request.established,
    interviewVenue: request.interviewVenue,
  };

  const booking: DtpBookingSelection = request.heightCm
    ? {
        heightCm: request.heightCm,
        widthCm: DTP_CLASSIFIED_WIDTH_CM,
        render: renderDtpClassifiedSvg({ ...common, heightCm: request.heightCm }),
        rejected: [],
        compressed: false,
      }
    : selectDtpBooking(common);

  return {
    ...booking,
    compressed: booking.render.compressed,
    variant,
    usedImageGeneration: false,
  };
}
