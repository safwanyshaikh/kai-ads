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
    const footerHeightPx = 300;
    const footerTop = info.height - footerHeightPx;

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
    // A top-anchored two-line block (agency name + registration) at these
    // font sizes only occupies ~70-90px of a 300px footer — vertical
    // centring must place that same content so it doesn't cluster entirely
    // in (say) the first third, leaving two-thirds visibly bare. Assert
    // the text band's vertical midpoint sits within the middle third of
    // the footer, which top-anchoring at a fixed small offset would fail.
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
    const textMid = (firstRow + lastRow) / 2 - footerTop;
    expect(textMid).toBeGreaterThan(footerHeightPx * 0.3);
    expect(textMid).toBeLessThan(footerHeightPx * 0.7);
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
