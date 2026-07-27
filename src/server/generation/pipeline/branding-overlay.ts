import "../font-config"; // FONTCONFIG_FILE must be set before any rasterization
import sharp from "sharp";

export interface BrandingOverlayInput {
  imagePng: Buffer;
  widthPx: number;
  heightPx: number;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
  footerText?: string | null;
}

/**
 * Minimal Branding Overlay (optional): logo + small QR + a single small
 * footer line. Nothing else. No panel, no white box, no card — each
 * element is composited directly onto the corner of GPT's image.
 */
export async function applyBrandingOverlay(input: BrandingOverlayInput): Promise<Buffer> {
  const pad = Math.round(input.widthPx * 0.03);
  const composites: { input: Buffer; left: number; top: number }[] = [];

  if (input.agencyLogoPng) {
    const size = Math.round(input.widthPx * 0.12);
    const logo = await sharp(input.agencyLogoPng)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    composites.push({ input: logo, left: pad, top: pad });
  }

  if (input.qrPng) {
    const size = Math.round(input.widthPx * 0.12);
    const qr = await sharp(input.qrPng).resize(size, size).png().toBuffer();
    composites.push({ input: qr, left: input.widthPx - size - pad, top: input.heightPx - size - pad });
  }

  if (input.footerText) {
    const fontSize = Math.round(input.widthPx * 0.022);
    const footerHeight = fontSize * 2;
    const bottomTop = input.heightPx - footerHeight - Math.round(pad / 2);

    // Fix 4: if GPT already drew busy content (text/graphics) where the footer
    // would land, reposition to the opposite corner instead of overlapping it.
    // No logo means top-left is free; if both corners are busy, skip the footer
    // rather than render illegible overlapping text.
    const bottomIsBusy = await regionIsBusy(input.imagePng, input.widthPx, input.heightPx, 0, bottomTop, input.widthPx, footerHeight);

    let footerTop = bottomTop;
    let skip = false;
    if (bottomIsBusy) {
      const topLeftFree = !input.agencyLogoPng;
      const topIsBusy = topLeftFree
        ? await regionIsBusy(input.imagePng, input.widthPx, input.heightPx, 0, 0, input.widthPx, footerHeight)
        : true;
      if (topLeftFree && !topIsBusy) {
        footerTop = 0;
      } else {
        skip = true;
      }
    }

    if (!skip) {
      const footerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.widthPx}" height="${footerHeight}">
  <text x="${pad}" y="${fontSize}" font-family="KaiSans, sans-serif" font-size="${fontSize}" fill="#ffffff" stroke="#000000" stroke-width="${Math.max(1, Math.round(fontSize * 0.08))}" paint-order="stroke">${escapeXml(input.footerText)}</text>
</svg>`;
      const footerPng = await sharp(Buffer.from(footerSvg)).png().toBuffer();
      composites.push({ input: footerPng, left: 0, top: footerTop });
    }
  }

  if (composites.length === 0) return input.imagePng;

  return sharp(input.imagePng)
    .resize(input.widthPx, input.heightPx, { fit: "cover" })
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * A flat region (sky, wall, empty margin) has low luminance variance; text,
 * logos, or busy scenery push it up sharply. Used only to decide whether the
 * footer would land on top of existing content — not a general vision system.
 */
async function regionIsBusy(
  imagePng: Buffer,
  imageWidth: number,
  imageHeight: number,
  left: number,
  top: number,
  width: number,
  height: number,
): Promise<boolean> {
  const clampedTop = Math.max(0, Math.min(top, imageHeight - height));
  const stats = await sharp(imagePng)
    .resize(imageWidth, imageHeight, { fit: "cover" })
    .extract({ left, top: clampedTop, width, height })
    .greyscale()
    .stats();
  const stdev = stats.channels[0]?.stdev ?? 0;
  return stdev > 30;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
