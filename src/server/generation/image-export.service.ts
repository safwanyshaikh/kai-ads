import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { UnsupportedDocumentError } from "@/server/ai/openai/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("image-compositor");

export type ExportFormat = "png" | "jpg" | "pdf";

/**
 * Rasterizes the composed SVG into a real PNG buffer.
 *
 * AI-first Visual Hero SVGs embed GPT's full advertisement as a large
 * base64 data URI (~1-3 MB). librsvg (sharp's SVG backend) can fail on
 * these oversized inline images. When detected, this function extracts
 * the base64 image, rasterizes the overlay SVG separately with a
 * transparent background, and composites them with sharp.
 */
export async function rasterizeSvg(svg: string, widthPx: number, heightPx: number): Promise<Buffer> {
  try {
    const extracted = extractAiFirstImage(svg);

    if (extracted) {
      const bgBuffer = Buffer.from(extracted.base64, "base64");
      const overlayBuffer = await sharp(Buffer.from(extracted.overlaySvg), { density: 144 })
        .resize(widthPx, heightPx, { fit: "fill" })
        .png()
        .toBuffer();

      return await sharp(bgBuffer)
        .resize(widthPx, heightPx, { fit: "cover" })
        .composite([{ input: overlayBuffer, blend: "over" }])
        .png()
        .toBuffer();
    }

    return await sharp(Buffer.from(svg), { density: 144 })
      .resize(widthPx, heightPx, { fit: "fill" })
      .png()
      .toBuffer();
  } catch (error) {
    log.error({ err: error }, "SVG rasterization failed");
    throw new UnsupportedDocumentError("Could not render the advertisement image.");
  }
}

const AI_FIRST_MARKER = 'preserveAspectRatio="xMidYMid slice"';
const DATA_URI_PREFIX = "data:image/png;base64,";

function extractAiFirstImage(svg: string): { base64: string; overlaySvg: string } | null {
  const markerIdx = svg.indexOf(AI_FIRST_MARKER);
  if (markerIdx === -1) return null;

  const hrefIdx = svg.lastIndexOf('href="' + DATA_URI_PREFIX, markerIdx);
  if (hrefIdx === -1) return null;

  const b64Start = hrefIdx + 'href="'.length + DATA_URI_PREFIX.length;
  const b64End = svg.indexOf('"', b64Start);
  if (b64End === -1) return null;

  const tagStart = svg.lastIndexOf("<image", hrefIdx);
  const tagEnd = svg.indexOf("/>", markerIdx);
  if (tagStart === -1 || tagEnd === -1) return null;

  const base64 = svg.slice(b64Start, b64End);
  const overlaySvg = svg.slice(0, tagStart) + svg.slice(tagEnd + 2);

  return { base64, overlaySvg };
}

/** Converts an already-rasterized PNG into the requested export format. Real conversion — no placeholder. */
export async function exportImage(
  pngBuffer: Buffer,
  format: ExportFormat,
  dimensions: { widthPx: number; heightPx: number },
): Promise<{ buffer: Buffer; mimeType: string }> {
  switch (format) {
    case "png":
      return { buffer: pngBuffer, mimeType: "image/png" };

    case "jpg": {
      const jpg = await sharp(pngBuffer)
        .flatten({ background: "#ffffff" }) // JPEG has no alpha channel
        .jpeg({ quality: 92 })
        .toBuffer();
      return { buffer: jpg, mimeType: "image/jpeg" };
    }

    case "pdf": {
      const pdfDoc = await PDFDocument.create();
      const embeddedPng = await pdfDoc.embedPng(pngBuffer);
      const page = pdfDoc.addPage([dimensions.widthPx, dimensions.heightPx]);
      page.drawImage(embeddedPng, {
        x: 0,
        y: 0,
        width: dimensions.widthPx,
        height: dimensions.heightPx,
      });
      const pdfBytes = await pdfDoc.save();
      return { buffer: Buffer.from(pdfBytes), mimeType: "application/pdf" };
    }

    default:
      throw new UnsupportedDocumentError(`Unsupported export format "${format}".`);
  }
}

/**
 * Builds a useful, secret-free download filename:
 * "{country}-{industry}-{position}-kai-ads.{ext}" — no advertisement ID,
 * no agency ID, no internal identifiers ever appear in a public filename.
 */
export function buildExportFilename(params: {
  country: string;
  industry: string;
  firstPositionTitle?: string;
  format: ExportFormat;
}): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);

  const parts = [params.country, params.industry, params.firstPositionTitle]
    .filter((v): v is string => Boolean(v && v.length > 0))
    .map(slug)
    .filter(Boolean);

  const ext = params.format === "jpg" ? "jpg" : params.format;
  return `${[...parts, "kai-ads"].join("-")}.${ext}`;
}
