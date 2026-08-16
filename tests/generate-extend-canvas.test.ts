import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { extendCanvasHeight } from "@/server/generation/pipeline/generate";

/** A checkerboard so any crop/rescale is trivially detectable by a pixel diff. */
async function checkerboard(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .composite(
      Array.from({ length: Math.ceil((width * height) / 900) }, (_, i) => ({
        input: Buffer.from(
          `<svg width="30" height="30"><rect width="30" height="30" fill="rgb(${(i * 53) % 255},${(i * 97) % 255},${(i * 31) % 255})"/></svg>`,
        ),
        left: (i * 30) % width,
        top: Math.floor((i * 30) / width) * 30,
      })).filter((c) => c.top < height),
    )
    .png()
    .toBuffer();
}

describe("extendCanvasHeight — grows the canvas without cropping or rescaling the artwork", () => {
  it("returns the image unchanged when the target height is not taller", async () => {
    const image = await checkerboard(200, 300);
    const result = await extendCanvasHeight(image, 200, 300);
    expect(result).toBe(image);

    const smaller = await extendCanvasHeight(image, 200, 250);
    expect(smaller).toBe(image);
  });

  it("grows the canvas to exactly the requested height", async () => {
    const image = await checkerboard(200, 300);
    const result = await extendCanvasHeight(image, 200, 500);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(500);
  });

  it("never crops or rescales a single pixel of the original artwork", async () => {
    // The exact defect this fixes: the previous implementation used a
    // "cover" resize, which scales the whole frame up and crops the sides
    // to fill the new (taller) canvas — measured at ~11% cropped off each
    // horizontal edge for a real dense-requirement growth. Extending must
    // reproduce the source region byte-for-byte.
    const image = await checkerboard(200, 300);
    const result = await extendCanvasHeight(image, 200, 500);

    const original = await sharp(image).raw().toBuffer();
    const preserved = await sharp(result).extract({ left: 0, top: 0, width: 200, height: 300 }).raw().toBuffer();
    expect(preserved.equals(original)).toBe(true);
  });

  it("adds the new region below the existing artwork, not above or beside it", async () => {
    const image = await checkerboard(200, 300);
    const result = await extendCanvasHeight(image, 200, 500);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200); // no horizontal growth
    // The bottom 200px is new — confirm it is NOT identical to the
    // original artwork's own bottom region (i.e. it's genuinely new canvas,
    // not the source image duplicated/wrapped).
    const newRegion = await sharp(result).extract({ left: 0, top: 300, width: 200, height: 200 }).raw().toBuffer();
    const originalBottom = await sharp(image).extract({ left: 0, top: 100, width: 200, height: 200 }).raw().toBuffer();
    expect(newRegion.equals(originalBottom)).toBe(false);
  });
});
