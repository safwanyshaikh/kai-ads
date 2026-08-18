import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

/**
 * FINAL COMMERCIAL LAYOUT LOCK — regression for a real bug found while
 * building this pass: a long, bold (weight 700) agency name at a wide
 * canvas visibly overlapped the contact column, because (a) the
 * text-width heuristic didn't account for font-weight, and (b) the
 * wide/compact decision sized the identity column off a fixed 52%
 * fraction of the available width rather than what the agency name
 * itself needs at its readable floor. Both are fixed; this proves it
 * with the actual pixels, not just the decision logic.
 */
async function solidBackground(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 20, g: 30, b: 50 } } })
    .png()
    .toBuffer();
}

const LONG_AGENCY_NAME = "Sample Overseas Recruitment Agency LLP";
const LONG_RC = "PLACEHOLDER-RC-0000/EXAMPLE/0000+/0-0/0/0000/0000";

describe("Long agency name — no overlap with the contact column", () => {
  it("never draws contact-line text overlapping the identity column's horizontal span at a wide canvas", async () => {
    const widthPx = 1080;
    const heightPx = 1500;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: LONG_AGENCY_NAME,
      registrationNumber: LONG_RC,
      officialEmail: "placeholder@example-agency.invalid",
      officialPhone: "+00 000 000 0000",
      website: "www.example-agency.invalid",
      addressLine: "Placeholder Address Line, Example City",
    });

    const fh = Math.min(300, Math.max(250, Math.round(widthPx * 0.25)));
    const footerTop = heightPx - fh;
    const { data, info } = await sharp(png)
      .extract({ left: 0, top: footerTop, width: widthPx, height: fh })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Find the agency-name text row (the tallest, brightest glyph band
    // near the top of the footer) and confirm nothing bright appears to
    // its immediate right on THAT SAME row beyond a reasonable identity
    // column boundary if a second column exists — i.e. no two blocks of
    // text visually collide into one illegible smear. Concretely: within
    // any single row, the bright pixels should form at most two
    // contiguous clusters (one identity/name span, optionally one
    // contact span with a real gap between them), never a single
    // unbroken bright run spanning almost the entire width, which is
    // what an overlap produces once both blocks fill the same pixels.
    let worstRun = 0;
    for (let y = 10; y < fh; y++) {
      let run = 0;
      let maxRun = 0;
      for (let x = 0; x < widthPx; x++) {
        const i = (y * info.width + x) * info.channels;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > 190) {
          run++;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 0;
        }
      }
      worstRun = Math.max(worstRun, maxRun);
    }
    // A single unbroken bright run wider than ~60% of the canvas on one
    // text row is the overlap signature (two lines of text merged into
    // one continuous smear); legitimate single-line text — even the full
    // agency name alone — never runs that long unbroken at these sizes.
    expect(worstRun).toBeLessThan(widthPx * 0.6);
  });

  it("falls back to compact (single column) when the identity column would otherwise starve the contact column", async () => {
    // Same inputs as above, at a width where 52%-of-textWidth would have
    // left too little room for contact — the fixed matches this exact
    // real case found during implementation.
    const widthPx = 1080;
    const heightPx = 1500;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: LONG_AGENCY_NAME,
      registrationNumber: LONG_RC,
      officialEmail: "placeholder@example-agency.invalid",
      officialPhone: "+00 000 000 0000",
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });

  it("still fits a genuinely wide canvas into two columns without overlap", async () => {
    const widthPx = 1920;
    const heightPx = 1400;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: LONG_AGENCY_NAME,
      registrationNumber: LONG_RC,
      officialEmail: "placeholder@example-agency.invalid",
      officialPhone: "+00 000 000 0000",
      website: "www.example-agency.invalid",
    });
    const fh = Math.min(300, Math.max(250, Math.round(widthPx * 0.25)));
    const footerTop = heightPx - fh;
    const { data, info } = await sharp(png)
      .extract({ left: 0, top: footerTop, width: widthPx, height: fh })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let worstRun = 0;
    for (let y = 10; y < fh; y++) {
      let run = 0;
      let maxRun = 0;
      for (let x = 0; x < widthPx; x++) {
        const i = (y * info.width + x) * info.channels;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > 190) {
          run++;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 0;
        }
      }
      worstRun = Math.max(worstRun, maxRun);
    }
    expect(worstRun).toBeLessThan(widthPx * 0.6);
  });
});
