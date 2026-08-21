import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

/**
 * FINAL COMMERCIAL LOCK (2026-08) — footer prominence regression.
 *
 * The footer is the agency's identity/goodwill zone: the logo must read
 * as prominent, the agency name must dominate the footer's text, and a
 * sparse verified profile (few fields present) must not leave the band
 * looking dead/empty. These tests prove the rendered output, not just
 * the source values.
 */
async function solidBackground(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 20, g: 30, b: 50 } } })
    .png()
    .toBuffer();
}

async function tinyLogo(): Promise<Buffer> {
  // A distinct, non-navy, non-white colour so the composited logo pixels
  // are trivially distinguishable from the footer background/text.
  return sharp({
    create: { width: 300, height: 120, channels: 4, background: { r: 220, g: 60, b: 20, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function tinyQr(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
}

describe("Trust footer — prominence and no-dead-space regression", () => {
  const widthPx = 1080;
  const heightPx = 1620;

  it("gives the approved logo a visibly larger footprint than the old 150x82 box", async () => {
    const withLogo = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Al Yousuf Enterprises LLP",
      agencyLogoPng: await tinyLogo(),
    });
    const { data, info } = await sharp(withLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const footerTop = info.height - 300; // widest possible footer band at this width
    let logoPixels = 0;
    for (let y = footerTop; y < info.height; y++) {
      for (let x = 0; x < info.width; x += 2) {
        const i = (y * info.width + x) * info.channels;
        // Our distinct orange logo fill: high R, low G/B.
        if (data[i] > 180 && data[i + 1] < 100 && data[i + 2] < 60) logoPixels++;
      }
    }
    // The old 150x82 box covered at most 12300 source px; sampled at
    // stride 2 that is ~6150 samples. The new box is materially larger —
    // this asserts the rendered logo footprint clears that old ceiling.
    expect(logoPixels).toBeGreaterThan(6150);
  });

  it("agency name renders with a visibly taller glyph band than the registration line — dominant, not same-weight", async () => {
    async function glyphBandHeight(fields: { agencyName?: string; registrationNumber?: string }): Promise<number> {
      const png = await applyBrandingOverlay({
        imagePng: await solidBackground(widthPx, heightPx),
        widthPx,
        heightPx,
        ...fields,
      });
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const footerTop = info.height - 300;
      let first = -1;
      let last = -1;
      for (let y = footerTop; y < info.height; y++) {
        let bright = false;
        for (let x = 40; x < 900; x += 2) {
          const i = (y * info.width + x) * info.channels;
          const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          if (lum > 200) {
            bright = true;
            break;
          }
        }
        if (bright) {
          if (first === -1) first = y;
          last = y;
        }
      }
      return last - first;
    }

    const agencyOnly = await glyphBandHeight({ agencyName: "Al Yousuf Enterprises LLP" });
    const registrationOnly = await glyphBandHeight({
      registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    });
    expect(agencyOnly).toBeGreaterThan(registrationOnly);
  });

  it("does not leave the bottom of the footer visibly empty when only agency name + registration are present", async () => {
    const sparse = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Al Yousuf Enterprises LLP",
      registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    });
    const { data, info } = await sharp(sparse).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // The band is measured from its own content, so it is detected here
    // rather than restated as a constant.
    const footerTop = await footerBandTop(sparse);
    const footerHeightPx = info.height - footerTop;

    // Text is drawn white-on-navy. Count rows within the footer band that
    // contain at least one bright (text) pixel in the identity column.
    let rowsWithText = 0;
    for (let y = footerTop; y < info.height; y++) {
      let hasBrightPixel = false;
      for (let x = 40; x < 700; x += 2) {
        const i = (y * info.width + x) * info.channels;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > 200) {
          hasBrightPixel = true;
          break;
        }
      }
      if (hasBrightPixel) rowsWithText++;
    }
    // The band no longer has a fixed height for content to be centred
    // inside, so "not visibly empty" is now a STRONGER property than the
    // midpoint check this test originally used: the strip is sized to the
    // content it holds, so the content must occupy the large majority of
    // it, leaving only the deliberate breathing space above and below.
    //
    // Centring inside a fixed slab satisfied the old midpoint assertion
    // while still leaving ~85px of dead navy above the agency name and
    // another ~85px below it — the defect this file is named for.
    let firstRow = -1;
    let lastRow = -1;
    for (let y = footerTop; y < info.height; y++) {
      let hasBrightPixel = false;
      for (let x = 40; x < 700; x += 2) {
        const i = (y * info.width + x) * info.channels;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > 200) {
          hasBrightPixel = true;
          break;
        }
      }
      if (hasBrightPixel) {
        if (firstRow === -1) firstRow = y;
        lastRow = y;
      }
    }
    expect(rowsWithText).toBeGreaterThan(0);

    const textExtent = lastRow - firstRow;
    // The identity block spans most of its band.
    expect(textExtent / footerHeightPx).toBeGreaterThan(0.45);
    // Breathing space above the first line is real (the agency name never
    // merges into the advertisement content above it) but bounded — it is
    // deliberate separation, not leftover slab.
    const spaceAbove = firstRow - footerTop;
    expect(spaceAbove).toBeGreaterThan(8);
    expect(spaceAbove).toBeLessThan(footerHeightPx * 0.45);
    // And the band ends shortly after the last line rather than trailing
    // off into empty navy.
    const spaceBelow = info.height - lastRow;
    expect(spaceBelow).toBeLessThan(footerHeightPx * 0.45);
  });

  it("keeps the QR clearly visible and unobstructed alongside a prominent logo", async () => {
    const result = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Al Yousuf Enterprises LLP",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    const { data, info } = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const footerTop = info.height - 300;
    // QR is drawn near the right edge — sample a column there for fully
    // opaque, non-navy-background pixels (the QR itself is pure black on
    // this fixture, so look for solid black distinct from the navy footer).
    let qrPixels = 0;
    for (let y = footerTop; y < info.height; y++) {
      for (let x = info.width - 160; x < info.width - 20; x += 2) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 15 && data[i + 1] < 15 && data[i + 2] < 15) qrPixels++;
      }
    }
    expect(qrPixels).toBeGreaterThan(500);
  });
});

/**
 * Finds the top of the trust footer band by DETECTING it, rather than
 * recomputing a height formula in the test.
 *
 * The band is no longer a fixed slab: it is measured from the footer's
 * own content (see planFooter), so a test that hardcodes
 * `min(300, max(250, W * 0.25))` slices the wrong region and then
 * measures advertisement body pixels as if they were footer pixels.
 * Scanning up from the bottom edge for the contiguous KAI-navy fill
 * finds the real band whatever height it takes.
 */
async function footerBandTop(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let top = info.height;
  for (let y = info.height - 1; y >= 0; y--) {
    const i = (y * info.width + 4) * info.channels;
    const isNavy =
      Math.abs(data[i] - 0x0b) < 26 &&
      Math.abs(data[i + 1] - 0x1f) < 26 &&
      Math.abs(data[i + 2] - 0x33) < 30;
    if (!isNavy) break;
    top = y;
  }
  return top;
}
