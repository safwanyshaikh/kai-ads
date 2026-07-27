import "../generation/font-config"; // FONTCONFIG_FILE must be set before any rasterization
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
 * V2 — Step 6 (optional): logo + small QR + a single small footer line.
 * Nothing else. No panel, no white box, no card — each element is
 * composited directly onto the corner of GPT's image.
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
    const footerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.widthPx}" height="${fontSize * 2}">
  <text x="${pad}" y="${fontSize}" font-family="KaiSans, sans-serif" font-size="${fontSize}" fill="#ffffff" stroke="#000000" stroke-width="${Math.max(1, Math.round(fontSize * 0.08))}" paint-order="stroke">${escapeXml(input.footerText)}</text>
</svg>`;
    const footerPng = await sharp(Buffer.from(footerSvg)).png().toBuffer();
    composites.push({ input: footerPng, left: 0, top: input.heightPx - fontSize * 2 - Math.round(pad / 2) });
  }

  if (composites.length === 0) return input.imagePng;

  return sharp(input.imagePng)
    .resize(input.widthPx, input.heightPx, { fit: "cover" })
    .composite(composites)
    .png()
    .toBuffer();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
