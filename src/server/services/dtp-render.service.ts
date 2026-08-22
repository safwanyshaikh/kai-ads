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
  selectDtpBooking,
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

  const ad: DtpAdvertisement = {
    ...request.ad,
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

  const booking = selectDtpBooking({
    ad,
    variant,
    addressLines: request.addressLines,
    established: request.established,
    interviewVenue: request.interviewVenue,
  });

  return { ...booking, variant, usedImageGeneration: false };
}
