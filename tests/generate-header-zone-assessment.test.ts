import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { assessHeaderZoneVisualWeight } from "@/server/generation/pipeline/generate";

/**
 * FINAL COMMERCIAL LAYOUT LOCK — reads Gemini's own header band, never
 * guesses. A flat/plain header (e.g. open sky, a plain gradient) must
 * read as having no strong subject; genuine photographic detail
 * (machinery, texture, people, structure) must read as having one.
 */
async function flatArtwork(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 210, g: 220, b: 235 } } })
    .png()
    .toBuffer();
}

async function detailedArtwork(widthPx: number, heightPx: number): Promise<Buffer> {
  // Coarse, high-contrast blocks — large enough to survive the 48x48
  // downsample assessHeaderZoneVisualWeight uses, unlike fine repeating
  // stripes which area-averaging can smooth back down to near-flat.
  const bandH = Math.round(heightPx * 0.34);
  const blocks: string[] = [];
  const cols = 6;
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dark = (r + c) % 2 === 0;
      blocks.push(
        `<rect x="${Math.round((c / cols) * widthPx)}" y="${Math.round((r / rows) * bandH)}" ` +
          `width="${Math.ceil(widthPx / cols)}" height="${Math.ceil(bandH / rows)}" fill="${dark ? "#101010" : "#f0d060"}"/>`,
      );
    }
  }
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 120, g: 120, b: 120 } } })
    .composite([{ input: Buffer.from(`<svg width="${widthPx}" height="${heightPx}">${blocks.join("")}</svg>`) }])
    .png()
    .toBuffer();
}

describe("assessHeaderZoneVisualWeight", () => {
  it("reads a flat, uniform header band as having no strong subject", async () => {
    const artwork = await flatArtwork(1080, 1080);
    expect(await assessHeaderZoneVisualWeight(artwork, 1080)).toBe(false);
  });

  it("reads a detailed, high-contrast header band as having a strong subject", async () => {
    const artwork = await detailedArtwork(1080, 1080);
    expect(await assessHeaderZoneVisualWeight(artwork, 1080)).toBe(true);
  });

  it("defaults to true (minimal treatment) when the artwork is too short to sample a header band", async () => {
    const artwork = await flatArtwork(1080, 3);
    expect(await assessHeaderZoneVisualWeight(artwork, 1080)).toBe(true);
  });
});
