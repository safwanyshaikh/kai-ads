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
  const fontSize = Math.max(11, Math.round(zoneH * 0.11));

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${zoneW}" height="${zoneH}">
  <rect x="0" y="0" width="${zoneW}" height="${zoneH}" rx="${Math.round(zoneH * 0.06)}" fill="#ffffff" fill-opacity="0.92" stroke="#1a1a1a" stroke-width="1"/>
  <text x="${textX}" y="${padding + fontSize}" font-family="KaiSans, sans-serif" font-size="${fontSize}" font-weight="700" fill="#111111">MEA VERIFIED AGENCY</text>
  <text x="${textX}" y="${padding + fontSize * 2.3}" font-family="KaiSans, sans-serif" font-size="${Math.round(fontSize * 0.85)}" fill="#333333">${escapeXml(input.agencyName)}</text>
  ${
    input.raLicenseId
      ? `<text x="${textX}" y="${padding + fontSize * 3.6}" font-family="KaiSans, sans-serif" font-size="${Math.round(fontSize * 0.8)}" fill="#555555">RA ${escapeXml(input.raLicenseId)}</text>`
      : ""
  }
  <text x="${textX}" y="${zoneH - padding * 0.6}" font-family="KaiSans, sans-serif" font-size="${Math.round(fontSize * 0.65)}" fill="#777777">${input.generationId ? `${escapeXml(input.generationId)} · ` : ""}Scan to verify · kai-ads</text>
</svg>`;

  const overlayPng = await sharp(Buffer.from(overlaySvg), { density: 144 }).png().toBuffer();

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
