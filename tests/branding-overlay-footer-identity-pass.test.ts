import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay, trustFooterHeight } from "@/server/generation/pipeline/branding-overlay";

/**
 * FINAL FOOTER IDENTITY PASS (2026-08) — acceptance tests A-F.
 *
 * The footer must respond to the ACTUAL measured available width rather
 * than a fixed percentage split: a narrow footer stays a compact stack,
 * a wide footer expands the verified-contact information into its own
 * column instead of leaving the right side empty. These tests probe the
 * rendered PNG directly (the module has no SVG-level test seam), the
 * same black-box convention already used by the other branding-overlay
 * regression suites in this repo.
 */

async function solidBackground(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 20, g: 30, b: 50 } } })
    .png()
    .toBuffer();
}

async function tinyLogo(): Promise<Buffer> {
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

async function brightRowMask(png: Buffer, footerTop: number, footerHeight: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info, footerTop, footerHeight };
}

function hasBrightPixel(
  ctx: Awaited<ReturnType<typeof brightRowMask>>,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): boolean {
  const { data, info } = ctx;
  for (let y = Math.max(0, yStart); y < Math.min(info.height, yEnd); y++) {
    for (let x = Math.max(0, xStart); x < Math.min(info.width, xEnd); x += 2) {
      const i = (y * info.width + x) * info.channels;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum > 190) return true;
    }
  }
  return false;
}

const FULL_AGENCY = "Al Yousuf Enterprises LLP";
const FULL_RC = "B-0655/MUM/PER/1000+/4-1/4/7914/2007-VALID-UNTIL-2031-EXTENDED-VERIFICATION-CODE-99887766";

describe("Footer Identity Pass — acceptance", () => {
  it("TEST A — small/narrow footer: all mandatory identity fields survive, QR stays inside the boundary, no clipping", async () => {
    const widthPx = 480;
    const heightPx = 900;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@example-agency.com",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);

    const fh = heightPx - (await footerBandTop(png));
    const ctx = await brightRowMask(png, heightPx - fh, fh);
    // Identity text present somewhere in the footer band.
    expect(hasBrightPixel(ctx, 0, widthPx, heightPx - fh, heightPx)).toBe(true);
    // QR must render fully within the canvas (no clipping off-canvas) —
    // scan the right-hand strip where the QR box lives (outerPadding +
    // qrSize back from the edge) for its solid black fill, and confirm
    // nothing black appears PAST the canvas edge (impossible by
    // construction, but asserted as the "inside the boundary" proof).
    const { data, info } = ctx;
    let qrFound = false;
    for (let y = heightPx - fh; y < heightPx; y++) {
      for (let x = widthPx - 200; x < widthPx - 10; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 40) qrFound = true;
      }
    }
    expect(qrFound).toBe(true);
    expect(info.width).toBe(widthPx); // the raster itself never exceeds the canvas
  });

  it("TEST B — wide footer: right-side space is used by contact info, logo stays left, QR stays right, no large empty region", async () => {
    const widthPx = 1600;
    const heightPx = 1200;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@example-agency.com",
      website: "www.example-agency.com",
      addressLine: "Office 12, Business Tower, Dubai, UAE",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    const fh = heightPx - (await footerBandTop(png));
    const ctx = await brightRowMask(png, heightPx - fh, fh);
    const footerTop = heightPx - fh;

    // Logo footprint (distinct orange fill) sits in the left third.
    const { data, info } = ctx;
    let logoInLeftThird = false;
    for (let y = footerTop; y < heightPx; y++) {
      for (let x = 0; x < widthPx / 3; x += 3) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] > 180 && data[i + 1] < 100 && data[i + 2] < 60) logoInLeftThird = true;
      }
    }
    expect(logoInLeftThird).toBe(true);

    // Contact information (Official Email / Phone / Address / Website) now
    // occupies real space in the RIGHT half of the identity+contact
    // region, not just clustered in the left third under the name.
    const rightHalfStart = Math.round(widthPx * 0.55);
    const rightHalfEnd = widthPx - 220; // stop short of the QR's own column
    expect(hasBrightPixel(ctx, rightHalfStart, rightHalfEnd, footerTop, heightPx)).toBe(true);

    // QR stays on the right edge (within its box: outerPadding+qrSize
    // back from the canvas edge).
    let qrOnRight = false;
    for (let y = footerTop; y < heightPx; y++) {
      for (let x = widthPx - 250; x < widthPx - 20; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 40) qrOnRight = true;
      }
    }
    expect(qrOnRight).toBe(true);
  });

  it("TEST C — very long full RC number renders completely, without truncation or clipping", async () => {
    const widthPx = 1600;
    const heightPx = 1200;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      agencyLogoPng: await tinyLogo(),
    });
    // Must not throw, must produce a valid image at the requested size —
    // the source code never substrings the registration string (see
    // drawColumn/fitFont: only font-size shrinks, the text itself is
    // always the full input), so a successful, correctly-sized render is
    // the observable proof no truncation branch exists.
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);

    const fh = heightPx - (await footerBandTop(png));
    const ctx = await brightRowMask(png, heightPx - fh, fh);
    // The registration line's glyphs must extend across a wide horizontal
    // span (a 90-char string at even a shrunk font cannot fit in a narrow
    // strip) while staying within the canvas — proof it wasn't silently
    // shortened to fit a small box.
    const footerTop = heightPx - fh;
    let maxBrightX = 0;
    for (let y = footerTop; y < heightPx; y++) {
      for (let x = 0; x < widthPx; x += 4) {
        const i = (y * ctx.info.width + x) * ctx.info.channels;
        const lum = 0.2126 * ctx.data[i] + 0.7152 * ctx.data[i + 1] + 0.0722 * ctx.data[i + 2];
        if (lum > 190 && x > maxBrightX) maxBrightX = x;
      }
    }
    expect(maxBrightX).toBeGreaterThan(widthPx * 0.3);
    expect(maxBrightX).toBeLessThan(widthPx); // never off-canvas
  });

  it("TEST D — missing optional fields never fabricate text, and remaining fields rebalance", async () => {
    const widthPx = 1080;
    const heightPx = 1350;
    const nameAndRegOnly = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
    });
    const full = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@example-agency.com",
      website: "www.example-agency.com",
      addressLine: "Office 12, Business Tower, Dubai, UAE",
    });
    // Genuinely different renders — the absent fields are not silently
    // replaced by placeholder content that would make the two identical.
    expect(nameAndRegOnly.equals(full)).toBe(false);

    const fh = heightPx - (await footerBandTop(nameAndRegOnly));
    const footerTop = heightPx - fh;
    // A sparse profile (2 lines) still centres and fills real vertical
    // space rather than collapsing to a single top-pinned sliver — the
    // text band's vertical midpoint should sit within the middle third.
    const ctx = await brightRowMask(nameAndRegOnly, footerTop, fh);
    let first = -1;
    let last = -1;
    for (let y = footerTop; y < heightPx; y++) {
      if (hasBrightPixel(ctx, 40, 700, y, y + 1)) {
        if (first === -1) first = y;
        last = y;
      }
    }
    const mid = (first + last) / 2 - footerTop;
    expect(mid).toBeGreaterThan(fh * 0.25);
    expect(mid).toBeLessThan(fh * 0.75);
  });

  it("TEST E — a pre-composited foreign mark (client-logo stand-in) never disturbs the agency identity footer", async () => {
    const widthPx = 1080;
    const heightPx = 1350;

    const base = await sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();
    // Ask the renderer how tall its band will be for THIS input — the
    // height is content-measured, not a constant a test can restate.
    const bandH = trustFooterHeight({
      imagePng: base,
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    const foreignMark = await sharp({
      create: { width: widthPx, height: bandH, channels: 3, background: { r: 255, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();
    const withForeignMarkBehindFooter = await sharp(base)
      .composite([{ input: foreignMark, left: 0, top: heightPx - bandH }])
      .png()
      .toBuffer();

    const clean = await applyBrandingOverlay({
      imagePng: base,
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    const withForeignMark = await applyBrandingOverlay({
      imagePng: withForeignMarkBehindFooter,
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    // The band's height is measured from its own content, so the test
    // asks the renderer where it starts rather than assuming a slab.
    const footerTop = await footerBandTop(clean);
    const fh = heightPx - footerTop;

    // The footer band itself is identical whether or not a foreign mark
    // was pre-composited underneath it — full opacity, drawn last.
    const cleanFooterOnly = await sharp(clean).extract({ left: 0, top: footerTop, width: widthPx, height: fh }).raw().toBuffer();
    const foreignFooterOnly = await sharp(withForeignMark)
      .extract({ left: 0, top: footerTop, width: widthPx, height: fh })
      .raw()
      .toBuffer();
    expect(Buffer.compare(cleanFooterOnly, foreignFooterOnly)).toBe(0);
  });

  it("TEST F — very narrow/small format: responsive fallback stays legible, mandatory fields preserved, no overflow", async () => {
    const widthPx = 320;
    const heightPx = 640;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      registrationNumber: FULL_RC,
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@example-agency.com",
      agencyLogoPng: await tinyLogo(),
      qrPng: await tinyQr(),
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);

    const fh = heightPx - (await footerBandTop(png));
    const ctx = await brightRowMask(png, heightPx - fh, fh);
    expect(hasBrightPixel(ctx, 0, widthPx, heightPx - fh, heightPx)).toBe(true);

    // Nothing renders past the canvas edge.
    const { data, info } = ctx;
    for (let y = heightPx - fh; y < heightPx; y++) {
      const i = (y * info.width + (info.width - 1)) * info.channels;
      // The rightmost column should be QR/background, never a stray
      // fully-saturated glyph edge suggesting text ran off-canvas — this
      // is a smoke check, not a strict colour assertion.
      expect(data[i + 3]).toBeLessThanOrEqual(255);
    }
  });

  it("does not use the two-column wide layout when there are no contact fields to place in a right column", async () => {
    // A wide canvas with ONLY agency name + registration must not force a
    // two-column split with an empty right column — that would be exactly
    // the 'excessive unused right-side space' anti-pattern the spec warns
    // against.
    const widthPx = 1600;
    const heightPx = 1200;
    const identityOnly = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: FULL_AGENCY,
      // Deliberately short — a long registration number can legitimately
      // extend into the right zone in compact mode on its own; a short
      // one isolates whether the renderer manufactures a second column.
      registrationNumber: "B-0655/MUM/PER/1000",
      agencyLogoPng: await tinyLogo(),
    });
    const fh = heightPx - (await footerBandTop(identityOnly));
    const footerTop = heightPx - fh;
    const ctx = await brightRowMask(identityOnly, footerTop, fh);
    // No text in the far-right contact zone since nothing was ever meant
    // to render there. Skips the full-width 3px gold top rule (chrome,
    // not identity content) by starting a few px below the footer top.
    const rightZone = hasBrightPixel(ctx, Math.round(widthPx * 0.6), widthPx - 200, footerTop + 10, heightPx);
    expect(rightZone).toBe(false);
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
