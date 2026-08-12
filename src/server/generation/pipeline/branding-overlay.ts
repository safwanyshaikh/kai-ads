import "../font-config"; // FONTCONFIG_FILE must be set before any rasterization
import sharp from "sharp";
import { footerTheme, normaliseBadges, type FooterStyle } from "./footer-styles";

export interface BrandingOverlayInput {
  imagePng: Buffer;
  widthPx: number;
  heightPx: number;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
  agencyName?: string | null;
  registrationNumber?: string | null;
  contactLine?: string | null;
  /**
   * Agency office address and/or website, printed as one muted line
   * beneath the registration number. Optional: when absent the band
   * renders exactly as before.
   */
  addressLine?: string | null;
  /**
   * Agency-owned footer style. Brand furniture only — it re-dresses the
   * trust strip and never touches the creative above it.
   */
  footerStyle?: FooterStyle | null;
  /** Up to three permanent branding claims, e.g. "Since 1984". */
  brandBadges?: string[] | null;
  /**
   * Height of the hero/artwork region. The watermark is confined to it.
   * Everything below is the fact layer and the branding band, which must
   * stay clean. Omitted (or 0) means no watermark is painted at all —
   * without a known artwork boundary there is nowhere safe to put it.
   */
  artworkHeightPx?: number | null;
}

/**
 * Branding Overlay v2. GPT still owns 100% of the advertisement's design —
 * this only adds tenant branding on top, and does so in a way that can
 * never collide with GPT's content:
 *
 *  - A repeating, very low-opacity tenant-logo watermark across the whole
 *    canvas (copy-protection / attribution, not a visual distraction).
 *  - One opaque footer band spanning the full width at the bottom. It is
 *    painted over whatever GPT rendered there (the Creative Brief already
 *    asks GPT to keep that strip clean — this makes "clean" a guarantee,
 *    not a hope) and holds the tenant logo, agency name, registration
 *    number, an optional contact line, and the verification QR — laid out
 *    with a fixed structure but every measurement computed as a fraction
 *    of the canvas, so it adapts to portrait, square, or landscape output.
 *
 * No heuristic "is this region busy" guessing (removed) — collision-safety
 * comes from painting an opaque band, not from detecting one.
 */
const BAND_HEIGHT_PCT = 0.13;
const CONTACT_ROW_HEIGHT_PCT = 0.045;

/**
 * The fraction of the canvas this overlay can paint over, rounded up to a
 * round number for headroom (descenders, rounding, a model that lands a
 * baseline slightly low). The Creative Brief imports this to tell the
 * image model how much bottom strip to keep clear.
 *
 * These two numbers MUST stay tied together. When they drifted apart —
 * the brief reserving 12% while the overlay painted 17.5% — the image
 * model composed ad copy into the gap and the band cut it in half, which
 * cost a whole position line ("WELDER (ARC/TIG)") on real output.
 */
/**
 * The band is also capped against WIDTH. Its height was purely a fraction
 * of canvas height, which is correct for a square advertisement and absurd
 * for a tall directory poster — at 1024x3413 it produced a 600px band whose
 * agency name, registration and contact line all overflowed horizontally.
 */
const BAND_MAX_WIDTH_FACTOR = 0.2;
const CONTACT_ROW_MAX_WIDTH_FACTOR = 0.07;

export function brandingBandHeight(widthPx: number, heightPx: number): number {
  return Math.min(Math.round(heightPx * BAND_HEIGHT_PCT), Math.round(widthPx * BAND_MAX_WIDTH_FACTOR));
}

export function brandingContactRowHeight(widthPx: number, heightPx: number, hasContactLine: boolean): number {
  if (!hasContactLine) return 0;
  return Math.min(
    Math.round(heightPx * CONTACT_ROW_HEIGHT_PCT),
    Math.round(widthPx * CONTACT_ROW_MAX_WIDTH_FACTOR),
  );
}

/** Total height the Rendering Engine paints over, for a given canvas. */
export function brandingStripHeight(widthPx: number, heightPx: number, hasContactLine: boolean): number {
  return brandingBandHeight(widthPx, heightPx) + brandingContactRowHeight(widthPx, heightPx, hasContactLine);
}

export const BRANDING_RESERVED_HEIGHT_PCT =
  Math.ceil(((BAND_HEIGHT_PCT + CONTACT_ROW_HEIGHT_PCT) * 100) / 5) * 5;
const LOGO_SIZE_PCT_OF_BAND = 0.69; // ~25% larger absolute logo than the original 0.115 * 0.62 band
const QR_SIZE_PCT_OF_BAND = 0.6; // ~12.5% smaller absolute QR than the original 0.115 * 0.78 band
const NAME_SIZE_PCT_OF_BAND = 0.35; // more prominent than the original 0.115 * 0.3 band
const REGISTRATION_SIZE_PCT_OF_BAND = 0.16;
const ADDRESS_SIZE_PCT_OF_BAND = 0.13; // quieter than the registration line
const ADDRESS_REG_Y_PCT = 0.68; // registration lifts to here when an address follows
const ADDRESS_Y_PCT = 0.88; // address sits below it, still inside the band
const LOGO_TEXT_GAP_FACTOR = 1.0; // horizontal whitespace between logo and text, as a multiple of `pad`
/**
 * Barely perceptible. At 0.07, tiled across the whole canvas, the repeating
 * diagonal logo sat over the positions list and read as a pirated document
 * rather than a published advertisement. It is now confined to the artwork
 * and faint enough to survive only as an attribution trace.
 */
const WATERMARK_OPACITY = 0.02;
const WATERMARK_TILE_WIDTH_PCT = 0.16;
const WATERMARK_TILE_SPACING_FACTOR = 1.7;
const WATERMARK_ROTATION_DEGREES = 30;


export async function applyBrandingOverlay(input: BrandingOverlayInput): Promise<Buffer> {
  const { widthPx, heightPx } = input;
  const layers: { input: Buffer; left: number; top: number }[] = [];

  // Confined to the artwork region: never over positions, salary, benefits,
  // contact, the branding band, the QR or the logo.
  const artworkHeight = Math.max(0, Math.min(input.artworkHeightPx ?? 0, heightPx));
  if (input.agencyLogoPng && artworkHeight > 0) {
    layers.push(...(await buildWatermarkTiles(input.agencyLogoPng, widthPx, artworkHeight)));
  }

  const hasFooterContent = Boolean(
    input.agencyLogoPng || input.agencyName || input.registrationNumber || input.contactLine || input.qrPng,
  );
  if (hasFooterContent) {
    const footer = await buildFooterBand(input);
    layers.push({ input: footer.png, left: 0, top: heightPx - footer.height });
  }

  if (layers.length === 0) return input.imagePng;

  return sharp(input.imagePng)
    .resize(widthPx, heightPx, { fit: "cover" })
    .composite(layers)
    .png()
    .toBuffer();
}

/**
 * A faint, repeating, rotated tenant-logo tile across the full canvas —
 * discourages uncredited reposting without fighting readability. Tile
 * size and spacing are fractions of canvas width, so density and scale
 * stay consistent across portrait/square/landscape formats.
 */
async function buildWatermarkTiles(
  logoPng: Buffer,
  widthPx: number,
  regionHeightPx: number,
): Promise<{ input: Buffer; left: number; top: number }[]> {
  const tileSize = Math.round(widthPx * WATERMARK_TILE_WIDTH_PCT);
  const faded = await fadeLogo(logoPng, tileSize, WATERMARK_OPACITY);
  const rotated = await sharp(faded)
    .rotate(WATERMARK_ROTATION_DEGREES, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(rotated).metadata();
  const tw = meta.width ?? tileSize;
  const th = meta.height ?? tileSize;
  const spacingX = Math.round(tw * WATERMARK_TILE_SPACING_FACTOR);
  const spacingY = Math.round(th * WATERMARK_TILE_SPACING_FACTOR);

  const cols = Math.ceil(widthPx / spacingX) + 2;
  const rows = Math.ceil(regionHeightPx / spacingY) + 2;

  const tiles: { input: Buffer; left: number; top: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const rowOffset = r % 2 === 1 ? Math.round(spacingX / 2) : 0;
    for (let c = -1; c < cols; c++) {
      const left = c * spacingX + rowOffset;
      const top = r * spacingY - Math.round(th / 2);
      if (left < 0 || top < 0 || left >= widthPx) continue;
      // A tile must fit entirely inside the artwork — a partially
      // overlapping one would bleed across the boundary onto the facts.
      if (top + th > regionHeightPx) continue;
      tiles.push({ input: rotated, left, top });
    }
  }
  return tiles;
}

/** Multiplies the alpha channel to produce a faint, translucent copy of an opaque/semi-opaque logo. */
async function fadeLogo(logoPng: Buffer, size: number, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(logoPng)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * opacity);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/**
 * The one guaranteed-clean zone: an opaque band painted across the full
 * width at the bottom, covering anything GPT drew there. Logo + agency
 * name + registration on the left, a divider, then the verification QR
 * (scaled to the band, never the other way around) on the right. An
 * optional contact row sits above the band. Every size is a fraction of
 * bandHeight/widthPx — no fixed coordinates.
 */
async function buildFooterBand(input: BrandingOverlayInput): Promise<{ png: Buffer; height: number }> {
  const { widthPx, heightPx } = input;
  const theme = footerTheme(input.footerStyle);
  const badges = normaliseBadges(input.brandBadges);
  const bandHeight = brandingBandHeight(widthPx, heightPx);
  const contactRowHeight = brandingContactRowHeight(widthPx, heightPx, Boolean(input.contactLine));
  const totalHeight = bandHeight + contactRowHeight;
  const pad = Math.round(widthPx * 0.03);

  const qrSize = input.qrPng ? Math.round(bandHeight * QR_SIZE_PCT_OF_BAND) : 0;
  const qrLeft = widthPx - qrSize - pad;
  const qrTop = contactRowHeight + Math.round((bandHeight - qrSize) / 2);

  const logoSize = input.agencyLogoPng ? Math.round(bandHeight * LOGO_SIZE_PCT_OF_BAND) : 0;
  const logoLeft = pad;
  const logoTop = contactRowHeight + Math.round((bandHeight - logoSize) / 2);

  const textLeft = input.agencyLogoPng ? logoLeft + logoSize + Math.round(pad * LOGO_TEXT_GAP_FACTOR) : pad;
  const dividerX = input.qrPng ? qrLeft - Math.round(pad * 0.6) : widthPx - pad;
  const textMaxWidth = Math.max(dividerX - textLeft - Math.round(pad * 0.4), 0);

  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${totalHeight}">`];

  if (input.contactLine) {
    const contactSize = fitFontSize(input.contactLine, widthPx - pad * 2, Math.round(contactRowHeight * 0.5), Math.round(contactRowHeight * 0.28));
    parts.push(`<rect x="0" y="0" width="${widthPx}" height="${contactRowHeight}" fill="${theme.contactRowBackground}"/>`);
    parts.push(
      `<text x="${Math.round(widthPx / 2)}" y="${Math.round(contactRowHeight * 0.66)}" font-family="KaiSans, sans-serif" font-size="${contactSize}" fill="${theme.contactRowText}" text-anchor="middle">${escapeXml(input.contactLine)}</text>`,
    );
  }

  parts.push(`<rect x="0" y="${contactRowHeight}" width="${widthPx}" height="${bandHeight}" fill="${theme.background}"/>`);

  // Style rule across the top of the band (0 for styles that omit it).
  if (theme.topRulePx > 0) {
    parts.push(
      `<rect x="0" y="${contactRowHeight}" width="${widthPx}" height="${theme.topRulePx}" fill="${theme.topRuleColour}"/>`,
    );
  }

  // Brand badges — permanent agency claims ("Since 1984"), never
  // advertisement content, so they live in the trust strip and are drawn
  // from the profile rather than from anything the AI produced.
  if (badges.length > 0) {
    const badgeH = Math.round(bandHeight * 0.14);
    const badgeSize = Math.round(badgeH * 0.62);
    let bx = textLeft;
    const by = contactRowHeight + Math.round(bandHeight * 0.04);
    for (const badge of badges) {
      const bw = Math.round(badge.length * badgeSize * 0.62 + badgeH);
      if (bx + bw > dividerX) break; // never collide with the QR column
      parts.push(
        `<rect x="${bx}" y="${by}" width="${bw}" height="${badgeH}" rx="${Math.round(badgeH / 2)}" fill="${theme.badgeBackground}"/>`,
      );
      parts.push(
        `<text x="${bx + Math.round(bw / 2)}" y="${by + Math.round(badgeH * 0.7)}" font-family="KaiSans, sans-serif" font-size="${badgeSize}" font-weight="700" fill="${theme.badgeText}" text-anchor="middle">${escapeXml(badge.toUpperCase())}</text>`,
      );
      bx += bw + Math.round(pad * 0.4);
    }
  }

  if (input.agencyLogoPng) {
    const logoDataUri = await toPngDataUri(input.agencyLogoPng, logoSize);
    parts.push(
      `<image href="${logoDataUri}" x="${logoLeft}" y="${logoTop}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  if (input.agencyName) {
    // Measure the exact glyphs that get painted: uppercase styles render a
    // materially wider string than the name as stored.
    const paintedName = theme.uppercaseName ? input.agencyName.toUpperCase() : input.agencyName;
    const nameSize = fitFontSize(
      paintedName,
      textMaxWidth,
      Math.round(bandHeight * NAME_SIZE_PCT_OF_BAND),
      Math.round(bandHeight * 0.16),
      true, // font-weight 700
    );
    const hasBadges = badges.length > 0;
    const nameY =
      contactRowHeight +
      Math.round(bandHeight * (hasBadges ? 0.6 : input.registrationNumber ? 0.46 : 0.58));
    parts.push(
      `<text x="${textLeft}" y="${nameY}" font-family="KaiSans, sans-serif" font-size="${nameSize}" font-weight="700" fill="${theme.text}">${escapeXml(paintedName)}</text>`,
    );
  }

  if (input.registrationNumber) {
    const regText = `REG. ${input.registrationNumber}`;
    const regSize = fitFontSize(regText, textMaxWidth, Math.round(bandHeight * REGISTRATION_SIZE_PCT_OF_BAND), Math.round(bandHeight * 0.09));
    // Lift the registration line slightly when an address line follows, so
    // the two share the space below the agency name without colliding.
    const regY =
      contactRowHeight +
      Math.round(bandHeight * (badges.length > 0 ? 0.79 : input.addressLine ? ADDRESS_REG_Y_PCT : 0.76));
    parts.push(
      `<text x="${textLeft}" y="${regY}" font-family="KaiSans, sans-serif" font-size="${regSize}" fill="${theme.mutedText}">${escapeXml(regText)}</text>`,
    );
  }

  if (input.addressLine) {
    const addressSize = fitFontSize(
      input.addressLine,
      textMaxWidth,
      Math.round(bandHeight * ADDRESS_SIZE_PCT_OF_BAND),
      Math.round(bandHeight * 0.08),
    );
    const addressY =
      contactRowHeight + Math.round(bandHeight * (badges.length > 0 ? 0.94 : ADDRESS_Y_PCT));
    parts.push(
      `<text x="${textLeft}" y="${addressY}" font-family="KaiSans, sans-serif" font-size="${addressSize}" fill="${theme.mutedText}">${escapeXml(input.addressLine)}</text>`,
    );
  }

  if (input.qrPng) {
    if (input.agencyLogoPng || input.agencyName || input.registrationNumber) {
      parts.push(
        `<line x1="${dividerX}" y1="${contactRowHeight + Math.round(bandHeight * 0.14)}" x2="${dividerX}" y2="${contactRowHeight + bandHeight - Math.round(bandHeight * 0.14)}" stroke="${theme.divider}" stroke-width="2"/>`,
      );
    }
    const qrDataUri = await toPngDataUri(input.qrPng, qrSize);
    parts.push(`<image href="${qrDataUri}" x="${qrLeft}" y="${qrTop}" width="${qrSize}" height="${qrSize}"/>`);
    const captionSize = Math.round(bandHeight * 0.09);
    parts.push(
      `<text x="${qrLeft + qrSize / 2}" y="${contactRowHeight + bandHeight - Math.round(bandHeight * 0.03)}" font-family="KaiSans, sans-serif" font-size="${captionSize}" fill="${theme.mutedText}" text-anchor="middle">SCAN TO VERIFY</text>`,
    );
  }

  parts.push(`</svg>`);
  const png = await sharp(Buffer.from(parts.join(""))).png().toBuffer();
  return { png, height: totalHeight };
}

/**
 * Average glyph width as a fraction of font size. Regular sentence case is
 * the narrowest case; bold is wider; capitals are wider still, and bold
 * capitals are the widest a footer ever renders.
 *
 * This must be measured against the string that is actually painted. When
 * it was a flat 0.56 the agency name overflowed the QR column on every
 * uppercase footer style: "AL YOUSUF ENTERPRISES LLP" was measured as
 * mixed-case regular, fitted at 51px, then drawn bold and uppercased at a
 * real width ~140px past the divider — clipping the final letter under the
 * QR on live output.
 */
function widthFactor(text: string, bold: boolean): number {
  const upper = text === text.toUpperCase() && /[A-Z]/.test(text);
  if (bold && upper) return 0.68;
  if (bold) return 0.6;
  return upper ? 0.62 : 0.56;
}

/** Shrinks font size (down to minSize) until the text's estimated width fits maxWidth — guarantees no clipped text. */
function fitFontSize(
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
  bold = false,
): number {
  const factor = widthFactor(text, bold);
  const estimateWidth = (size: number) => text.length * size * factor;
  let size = preferredSize;
  while (size > minSize && estimateWidth(size) > maxWidth) size -= 1;
  return Math.max(size, minSize);
}

async function toPngDataUri(png: Buffer, size: number): Promise<string> {
  const resized = await sharp(png)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${resized.toString("base64")}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
