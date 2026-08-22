/**
 * DTP NEWSPAPER RENDER — entry point.
 *
 * A separate rendering MODE, not a variant of the poster renderer. It
 * shares the project's verified facts, tenant identity and brand-role
 * guards, and shares nothing of the poster's composition.
 *
 * Output is rasterized from the composed SVG, so PNG, JPG and PDF all
 * carry the same deterministic geometry — the page is composed, not
 * screenshotted (spec §22).
 */
import "../font-config"; // FONTCONFIG_FILE must be set before rasterization
import sharp from "sharp";

import type { AdvertisementFacts } from "../pipeline/types";
import { brandAsset, type BrandAsset } from "@/lib/brand-identity";
import { renderDtpPageSvg, type DtpPageInput, type DtpPageLayout } from "./dtp-page";
import type { DtpAdvertisement } from "./dtp-ad-block";

export * from "./dtp-typography";
export * from "./dtp-ad-block";
export * from "./dtp-page";
export * from "./dtp-classified";
export * from "./dtp-booking";

export type DtpExportFormat = "png" | "jpg" | "pdf";

export interface DtpRenderResult {
  buffer: Buffer;
  mimeType: string;
  layout: DtpPageLayout;
  svg: string;
}

/**
 * Builds a classified block from the project's own verified facts.
 *
 * This is an adapter, not a schema: every value below already exists on
 * AdvertisementFacts and is copied across unchanged. Nothing is
 * invented, and a fact the requirement does not carry simply does not
 * appear — which is what makes the block collapse around its content.
 */
export function dtpAdvertisementFromFacts(
  facts: AdvertisementFacts,
  options: {
    tenantLogo?: BrandAsset | null;
    verificationQr?: BrandAsset | null;
    clientName?: string | null;
    clientLogo?: BrandAsset | null;
    accent?: string | null;
  } = {},
): DtpAdvertisement {
  const profile = facts.agencyProfile;
  const tenantName = profile?.agencyName ?? facts.agencyName ?? "";
  const registration = profile?.fullRegistrationNumber ?? facts.fullRegistrationNumber ?? null;

  return {
    // The destination leads a classified, as it does on the reference
    // pages; the requirement's own header is the fallback.
    headline: facts.country ?? facts.header,
    subhead: facts.industry ?? null,
    urgency: facts.urgent ? "URGENT REQUIREMENT" : null,
    tenant: {
      name: tenantName,
      registrationText: registration ? `Licence: ${registration}` : null,
      logo: options.tenantLogo ?? null,
    },
    client:
      options.clientName || options.clientLogo
        ? { name: options.clientName ?? null, logo: options.clientLogo ?? null }
        : null,
    positions: facts.positions.map((p) => ({
      title: p.title,
      count: p.count ?? null,
      detail: [p.experience, p.qualification].filter(Boolean).join(" · ") || null,
    })),
    salary: null,
    eligibility: [],
    benefits: facts.benefits.map((b) => b.label),
    interview: facts.interview.length > 0
      ? facts.interview
          .map((i) => [i.date, i.location].filter(Boolean).join(" — "))
          .filter(Boolean)
          .join(" | ") || null
      : null,
    contactPhone: facts.contact.phone ?? null,
    contactEmail: facts.contact.email ?? null,
    website: profile?.website ?? null,
    applicationNote: null,
    verificationQr: options.verificationQr ?? null,
    accent: options.accent ?? null,
  };
}

/** Convenience for callers holding raw PNG buffers rather than assets. */
export function dtpTenantLogo(png: Buffer): BrandAsset<"TENANT_PRIMARY_LOGO"> {
  return brandAsset("TENANT_PRIMARY_LOGO", png);
}
export function dtpVerificationQr(png: Buffer): BrandAsset<"KAI_VERIFICATION_QR"> {
  return brandAsset("KAI_VERIFICATION_QR", png);
}
/** The hiring company's own mark — never interchangeable with the tenant's. */
export function dtpClientLogo(png: Buffer): BrandAsset<"CLIENT_LOGO"> {
  return brandAsset("CLIENT_LOGO", png);
}

/** Composes and rasterizes the newspaper page. */
export async function renderDtpPage(
  input: DtpPageInput,
  format: DtpExportFormat = "png",
): Promise<DtpRenderResult> {
  const { svg, layout } = renderDtpPageSvg(input);
  const source = sharp(Buffer.from(svg));

  switch (format) {
    case "png": {
      return { buffer: await source.png().toBuffer(), mimeType: "image/png", layout, svg };
    }
    case "jpg": {
      // Newsprint is white; flatten so no alpha becomes black.
      return {
        buffer: await source.flatten({ background: "#FFFFFF" }).jpeg({ quality: 92 }).toBuffer(),
        mimeType: "image/jpeg",
        layout,
        svg,
      };
    }
    case "pdf": {
      // The page geometry is preserved because the PDF wraps the same
      // composed raster at the same pixel dimensions, rather than a
      // re-flowed browser layout.
      const png = await source.png().toBuffer();
      return {
        buffer: await wrapPngInPdf(png, layout.widthPx, layout.heightPx),
        mimeType: "application/pdf",
        layout,
        svg,
      };
    }
  }
}

/**
 * Minimal single-page PDF wrapper around the composed raster.
 *
 * Mirrors the approach the existing image-export service already takes
 * for the poster renderer, so DTP does not introduce a second PDF
 * dependency or a second idea of what an exported page is.
 */
async function wrapPngInPdf(png: Buffer, widthPx: number, heightPx: number): Promise<Buffer> {
  const { exportImage } = await import("../image-export.service");
  const result = await exportImage(png, "pdf", { widthPx, heightPx });
  return result.buffer;
}
