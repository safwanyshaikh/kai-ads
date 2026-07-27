/**
 * KAI Trust Layer (Sprint 007 — GPT-Native Advertisement Architecture).
 *
 * "THE RENDERER ONLY DOES: QR Verification, Agency Verification,
 * Registration Number, Metadata, Version, Safety validation. Nothing
 * else." — this module is that renderer for the GPT-native pipeline. It
 * composites ONLY the verification QR, an agency-verified seal, the
 * registration number, and invisible metadata onto the image GPT already
 * returned. It never redraws typography, layout, headers, positions,
 * benefits, CTAs, icons, colour, whitespace, alignment, composition,
 * hero/background placement, grid, margins, or hierarchy — those are
 * entirely GPT's output, untouched.
 */

import "../font-config"; // side effect: FONTCONFIG_FILE must be set before any rasterization (see Bug 005)
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createLogger } from "@/lib/logger";
import { TRUST_ZONE } from "./master-prompt-builder";
import { fitFontSize } from "../archetypes/composition-shared";

const log = createLogger("gpt-native-trust-layer");

export interface TrustLayerInput {
  /** GPT's complete, already-rendered advertisement PNG. */
  baseImagePng: Buffer;
  /** Real, self-decode-verified QR PNG (see qr-renderer.ts) — never drawn by GPT. */
  qrPng: Buffer;
  agencyName: string;
  raLicenseId?: string | null;
  version: number;
  widthPx: number;
  heightPx: number;
  /**
   * Sprint 008 Workstream G: the pixel-borne ownership carriers. EXIF
   * dies on social-platform re-encode (WhatsApp/Facebook strip metadata),
   * so the generation ID is ALSO micro-printed visibly in the trust zone,
   * and the agency's real logo (never drawn by GPT) is composited beside
   * the verification text — the carriers that actually survive
   * circulation.
   */
  generationId?: string | null;
  /** Agency's real logo bytes (PNG/JPEG/WEBP); compositing is non-fatal — a bad logo never blocks generation. */
  agencyLogoPng?: Buffer | null;
}

/**
 * Workstream G: content hash for the authenticity record. Stored
 * server-side (version snapshot) so any re-uploaded copy of the file can
 * later be matched byte-for-byte against KAI's record via the /v/ page —
 * a provenance check that survives even total metadata stripping when
 * the file itself is unmodified.
 */
export function computeImageSha256(png: Buffer): string {
  return createHash("sha256").update(png).digest("hex");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Composites the trust badge (QR + agency verification text + compact
 * registration number) into the reserved bottom-right zone the master
 * prompt instructed GPT to leave clean, then stamps invisible provenance
 * metadata (agency, version, pipeline marker) via PNG EXIF/tEXt — visible
 * to nothing but forensic inspection, never rendered on canvas.
 */
export async function applyTrustLayer(input: TrustLayerInput): Promise<Buffer> {
  const zoneW = Math.round(input.widthPx * (TRUST_ZONE.widthPct / 100));
  const zoneH = Math.round(input.heightPx * (TRUST_ZONE.heightPct / 100));
  const padding = Math.round(zoneW * 0.06);
  const qrSize = Math.round(Math.min(zoneW * 0.4, zoneH - padding * 2));
  const zoneX = input.widthPx - zoneW;
  const zoneY = input.heightPx - zoneH;

  const qrResized = await sharp(input.qrPng).resize(qrSize, qrSize).png().toBuffer();

  const textX = padding + qrSize + padding;
  // This overlay is rasterized at exactly zoneW x zoneH (sharp renders the
  // SVG's declared width/height as the output raster) — any text extending
  // past that boundary is not "overflow," it is silently cropped out of
  // existence with no error. A fixed font size with no width-fitting
  // routinely overflowed a ~150px-wide text column (QR takes the other
  // ~40%), which is exactly how the entire agency name/trust identity
  // vanished from a real render with nothing in the logs to explain it.
  const textMaxW = Math.max(20, zoneW - textX - padding);
  const baseFontSize = Math.max(11, Math.round(zoneH * 0.11));
  const labelSize = fitFontSize("MEA VERIFIED AGENCY", textMaxW, baseFontSize, 8);
  const nameSize = fitFontSize(input.agencyName, textMaxW, Math.round(baseFontSize * 0.85), 7);
  const raSize = input.raLicenseId ? fitFontSize(`RA ${input.raLicenseId}`, textMaxW, Math.round(baseFontSize * 0.8), 7) : 0;
  const captionText = `${input.generationId ? `${input.generationId} · ` : ""}Scan to verify · kai-ads`;
  const captionSize = fitFontSize(captionText, textMaxW, Math.round(baseFontSize * 0.65), 6);

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${zoneW}" height="${zoneH}">
  <rect x="0" y="0" width="${zoneW}" height="${zoneH}" rx="${Math.round(zoneH * 0.06)}" fill="#ffffff" fill-opacity="0.92" stroke="#1a1a1a" stroke-width="1"/>
  <text x="${textX}" y="${padding + labelSize}" font-family="KaiSans, sans-serif" font-size="${labelSize}" font-weight="700" fill="#111111">MEA VERIFIED AGENCY</text>
  <text x="${textX}" y="${padding + baseFontSize * 2.3}" font-family="KaiSans, sans-serif" font-size="${nameSize}" fill="#333333">${escapeXml(input.agencyName)}</text>
  ${
    input.raLicenseId
      ? `<text x="${textX}" y="${padding + baseFontSize * 3.6}" font-family="KaiSans, sans-serif" font-size="${raSize}" fill="#555555">RA ${escapeXml(input.raLicenseId)}</text>`
      : ""
  }
  <text x="${textX}" y="${zoneH - padding * 0.6}" font-family="KaiSans, sans-serif" font-size="${captionSize}" fill="#777777">${input.generationId ? `${escapeXml(input.generationId)} · ` : ""}Scan to verify · kai-ads</text>
</svg>`;

  // density:144 sharpens the text but ALSO scales the raw raster output
  // (144/72 default = 2x actual pixel dimensions) — with no viewBox on
  // this SVG, sharp does not auto-normalize that back down. Compositing
  // the resulting oversized buffer at the nominal (zoneX, zoneY) offset
  // pushed most of the overlay — everything but the top-left corner —
  // past the base canvas's edge, where sharp.composite() clips it away
  // with no error. This is the actual reason the agency name/trust text
  // was missing from real renders (a font-fitting fix alone could not
  // have solved this — the text was never mispositioned, it was
  // rasterized at 2x and then silently cropped off-canvas). Resizing
  // back to the nominal zone size after rasterizing keeps the sharper
  // anti-aliasing from the higher density while guaranteeing the pixel
  // dimensions actually match what compositing assumes.
  const overlayPng = await sharp(Buffer.from(overlaySvg), { density: 144 })
    .resize(zoneW, zoneH)
    .png()
    .toBuffer();

  const composites: { input: Buffer; left: number; top: number }[] = [
    { input: overlayPng, left: zoneX, top: zoneY },
    { input: qrResized, left: zoneX + padding, top: zoneY + padding },
  ];

  // Agency logo (Workstream G / Supreme P10-P11): the REAL logo, composited
  // by KAI — GPT is explicitly forbidden from drawing/inventing one. Sized
  // to sit above the verification text at the zone's right edge. Non-fatal:
  // an unreadable logo file must never block an otherwise valid generation.
  if (input.agencyLogoPng) {
    try {
      const logoH = Math.round(zoneH * 0.28);
      const logoW = Math.round(zoneW * 0.28);
      const logoResized = await sharp(input.agencyLogoPng)
        .resize(logoW, logoH, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const logoMeta = await sharp(logoResized).metadata();
      composites.push({
        input: logoResized,
        left: zoneX + zoneW - padding - (logoMeta.width ?? logoW),
        top: zoneY + padding,
      });
    } catch (error) {
      log.warn({ err: error }, "Agency logo could not be composited — continuing without it");
    }
  }

  const composited = await sharp(input.baseImagePng)
    .resize(input.widthPx, input.heightPx, { fit: "cover" })
    .composite(composites)
    .png()
    .toBuffer();

  return await sharp(composited)
    .withMetadata({
      exif: {
        IFD0: {
          Copyright: `KAI Ads — ${escapeXml(input.agencyName)}`,
          Software: `kai-ads-gpt-native ${input.generationId ?? `v${input.version}`}`,
        },
      },
    })
    .png()
    .toBuffer();
}
