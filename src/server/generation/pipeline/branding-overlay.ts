import "../font-config";
import sharp from "sharp";
import { footerTheme, type FooterStyle } from "./footer-styles";

export interface BrandingOverlayInput {
  imagePng: Buffer;
  widthPx: number;
  heightPx: number;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
  agencyName?: string | null;
  registrationNumber?: string | null;
  contactLine?: string | null;
  addressLine?: string | null;
  footerStyle?: FooterStyle | null;
  brandBadges?: string[] | null;
  artworkHeightPx?: number | null;
}

/**
 * KAI BRANDING OVERLAY
 *
 * This layer does NOT design the advertisement.
 *
 * Gemini owns:
 *   - creative concept
 *   - visual composition
 *   - hero imagery
 *   - colour
 *   - atmosphere
 *   - emotional direction
 *
 * KAI owns:
 *   - exact agency identity
 *   - exact registration number
 *   - exact contact information
 *   - QR verification
 *
 * No watermark.
 * No decorative cards.
 * No repeated logos.
 * No creative headline.
 * No redesign of Gemini's artwork.
 */

const BAND_HEIGHT_PCT = 0.095;
const BAND_MAX_WIDTH_FACTOR = 0.12;

const LOGO_PCT = 0.62;
const QR_PCT = 0.62;
const NAME_PCT = 0.22;
const REG_PCT = 0.11;
const CONTACT_PCT = 0.11;

const MIN_FONT = 12;

export function brandingBandHeight(
  widthPx: number,
  heightPx: number,
): number {
  return Math.min(
    Math.round(heightPx * BAND_HEIGHT_PCT),
    Math.round(widthPx * BAND_MAX_WIDTH_FACTOR),
  );
}

export function brandingContactRowHeight(
  _widthPx: number,
  _heightPx: number,
  _hasContactLine: boolean,
): number {
  /**
   * Contact is now part of the same compact footer.
   * No second horizontal band is created.
   */
  return 0;
}

export function brandingStripHeight(
  widthPx: number,
  heightPx: number,
  _hasContactLine: boolean,
): number {
  return brandingBandHeight(widthPx, heightPx);
}

export const BRANDING_RESERVED_HEIGHT_PCT = 10;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textWidth(
  text: string,
  size: number,
): number {
  return text.length * size * 0.58;
}

function fitFont(
  text: string,
  maxWidth: number,
  preferred: number,
  minimum = MIN_FONT,
): number {
  let size = preferred;

  while (
    size > minimum &&
    textWidth(text, size) > maxWidth
  ) {
    size -= 1;
  }

  return Math.max(size, minimum);
}

function toDataUri(
  png: Buffer,
): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function applyBrandingOverlay(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    imagePng,
    widthPx,
    heightPx,
  } = input;

  const hasBranding = Boolean(
    input.agencyLogoPng ||
      input.qrPng ||
      input.agencyName ||
      input.registrationNumber ||
      input.contactLine ||
      input.addressLine,
  );

  if (!hasBranding) {
    return imagePng;
  }

  const footer = await buildCompactFooter(input);

  return sharp(imagePng)
    .composite([
      {
        input: footer,
        left: 0,
        top: heightPx - brandingBandHeight(widthPx, heightPx),
      },
    ])
    .png()
    .toBuffer();
}

async function buildCompactFooter(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    widthPx,
    heightPx,
    agencyLogoPng,
    qrPng,
    agencyName,
    registrationNumber,
    contactLine,
    addressLine,
    footerStyle,
    brandBadges,
  } = input;

  const theme = footerTheme(footerStyle);

  const bandHeight = brandingBandHeight(
    widthPx,
    heightPx,
  );

  const pad = Math.round(
    widthPx * 0.022,
  );

  const qrSize = qrPng
    ? Math.round(
        bandHeight * QR_PCT,
      )
    : 0;

  const logoSize = agencyLogoPng
    ? Math.round(
        bandHeight * LOGO_PCT,
      )
    : 0;

  const qrLeft = qrPng
    ? widthPx - pad - qrSize
    : widthPx - pad;

  const logoLeft = agencyLogoPng
    ? pad
    : 0;

  const logoTop = agencyLogoPng
    ? Math.round(
        (bandHeight - logoSize) / 2,
      )
    : 0;

  const textLeft = agencyLogoPng
    ? logoLeft +
      logoSize +
      Math.round(pad * 0.65)
    : pad;

  const textRight = qrPng
    ? qrLeft -
      Math.round(pad * 0.7)
    : widthPx - pad;

  const textWidthAvailable = Math.max(
    100,
    textRight - textLeft,
  );

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${bandHeight}">`,
  ];

  /**
   * Compact opaque footer.
   *
   * It covers only the bottom verification strip.
   * Gemini remains completely untouched above it.
   */
  svg.push(
    `<rect x="0" y="0" width="${widthPx}" height="${bandHeight}" fill="${theme.background}"/>`,
  );

  if (theme.topRulePx > 0) {
    svg.push(
      `<rect x="0" y="0" width="${widthPx}" height="${theme.topRulePx}" fill="${theme.topRuleColour}"/>`,
    );
  }

  if (agencyLogoPng && logoSize > 0) {
    svg.push(
      `<image href="${toDataUri(
        await normaliseLogo(
          agencyLogoPng,
          logoSize,
        ),
      )}" x="${logoLeft}" y="${logoTop}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  let textY =
    Math.round(
      bandHeight * 0.39,
    );

  if (agencyName) {
    const name =
      theme.uppercaseName
        ? agencyName.toUpperCase()
        : agencyName;

    const size = fitFont(
      name,
      textWidthAvailable,
      Math.round(
        bandHeight * NAME_PCT,
      ),
      14,
    );

    svg.push(
      `<text x="${textLeft}" y="${textY}" font-family="KaiSans, sans-serif" font-size="${size}" font-weight="700" fill="${theme.text}">${esc(
        name,
      )}</text>`,
    );

    textY += Math.round(
      size * 1.1,
    );
  }

  if (registrationNumber) {
    const registration =
      `RA ${registrationNumber}`;

    const size = fitFont(
      registration,
      textWidthAvailable,
      Math.round(
        bandHeight * REG_PCT,
      ),
      12,
    );

    svg.push(
      `<text x="${textLeft}" y="${textY}" font-family="KaiSans, sans-serif" font-size="${size}" fill="${theme.text}" opacity="0.85">${esc(
        registration,
      )}</text>`,
    );

    textY += Math.round(
      size * 1.15,
    );
  }

  const secondary = [
    contactLine,
    addressLine,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (secondary) {
    const size = fitFont(
      secondary,
      textWidthAvailable,
      Math.round(
        bandHeight * CONTACT_PCT,
      ),
      10,
    );

    svg.push(
      `<text x="${textLeft}" y="${Math.min(
        bandHeight - 7,
        textY,
      )}" font-family="KaiSans, sans-serif" font-size="${size}" fill="${theme.text}" opacity="0.72">${esc(
        secondary,
      )}</text>`,
    );
  }

  /**
   * QR is a precision verification element.
   * It is never allowed to dominate the advertisement.
   */
  if (qrPng && qrSize > 0) {
    svg.push(
      `<image href="${toDataUri(
        await normaliseLogo(
          qrPng,
          qrSize,
        ),
      )}" x="${qrLeft}" y="${Math.round(
        (bandHeight - qrSize) / 2,
      )}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  /**
   * Permanent brand claims remain extremely restrained.
   * They are profile data, not campaign content.
   */
  if (
    brandBadges &&
    brandBadges.length > 0
  ) {
    const badge =
      brandBadges[0];

    const badgeSize = fitFont(
      badge,
      textWidthAvailable * 0.45,
      Math.round(
        bandHeight * 0.09,
      ),
      10,
    );

    svg.push(
      `<text x="${textLeft}" y="${bandHeight - 5}" font-family="KaiSans, sans-serif" font-size="${badgeSize}" fill="${theme.text}" opacity="0.62">${esc(
        badge,
      )}</text>`,
    );
  }

  svg.push("</svg>");

  return sharp(
    Buffer.from(
      svg.join(""),
    ),
  )
    .png()
    .toBuffer();
}

async function normaliseLogo(
  png: Buffer,
  size: number,
): Promise<Buffer> {
  return sharp(png)
    .resize(
      size,
      size,
      {
        fit: "inside",
        withoutEnlargement: false,
      },
    )
    .png()
    .toBuffer();
}
