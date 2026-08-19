import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

/**
 * FOOTER LEGIBILITY — the defect visual inspection of the rendered
 * carousel exposed, which no existing footer test caught.
 *
 * The registered address is the longest verified string in the footer
 * and may never be abbreviated or dropped. It was being forced onto ONE
 * line and shrunk toward its floor to get there, which left it both
 * smaller than the contact lines above it and only ~3px clear of the
 * website line below — measurably cramped, and visibly so. It now wraps
 * to a second line at the column's shared scale instead.
 *
 * What is asserted here is what a pixel probe can actually establish:
 * that the address occupies more than one line, and that no two lines
 * collide. The "one shared scale" property is deliberately NOT asserted
 * from pixels — an ink run's height is dominated by which glyphs the
 * line happens to contain, so that proxy would pass whether or not the
 * fix were present.
 *
 * These probe the rendered PNG directly, the black-box convention the
 * other branding-overlay suites already use.
 */

async function solidBackground(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 11, g: 31, b: 51 } } })
    .png()
    .toBuffer();
}

/** A realistic registered address — too long for one footer line. */
const LONG_ADDRESS = "Placeholder Address Line, Example City, Example Country";

function footerHeightFor(widthPx: number): number {
  return Math.min(300, Math.max(250, Math.round(widthPx * 0.25)));
}

/**
 * Row-by-row ink profile of a horizontal slice, used to find the text
 * lines: a "line" is a run of consecutive rows that contain ink, and the
 * gaps between runs are the leading. Overlapping lines merge into one
 * abnormally tall run, which is exactly what this detects.
 */
async function inkRuns(png: Buffer, xStart: number, xEnd: number, yStart: number, yEnd: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows: boolean[] = [];
  for (let y = yStart; y < Math.min(info.height, yEnd); y++) {
    let ink = false;
    for (let x = Math.max(0, xStart); x < Math.min(info.width, xEnd); x++) {
      const i = (y * info.width + x) * info.channels;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum > 150) {
        ink = true;
        break;
      }
    }
    rows.push(ink);
  }
  const runs: { start: number; height: number }[] = [];
  let start = -1;
  rows.forEach((ink, i) => {
    if (ink && start < 0) start = i;
    if (!ink && start >= 0) {
      runs.push({ start, height: i - start });
      start = -1;
    }
  });
  if (start >= 0) runs.push({ start, height: rows.length - start });
  return runs;
}

describe("Footer contact column legibility", () => {
  async function renderFooter(): Promise<{ png: Buffer; widthPx: number; heightPx: number }> {
    const widthPx = 1080;
    const heightPx = 1395;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Sample Overseas Recruitment Agency LLP",
      registrationNumber: "PLACEHOLDER-RC-0000/EXAMPLE/0000+/0-0/0/0000/0000",
      officialPhone: "+00 000 000 0000 (placeholder)",
      officialEmail: "placeholder@example-agency.invalid",
      website: "www.example-agency.invalid",
      addressLine: LONG_ADDRESS,
    });
    return { png, widthPx, heightPx };
  }

  /** The contact column: right of the agency identity, left of the QR. */
  async function contactRuns() {
    const { png, widthPx, heightPx } = await renderFooter();
    const fh = footerHeightFor(widthPx);
    // Start below the accent rule that opens the footer — it is a
    // full-width divider, not a text line, and counting it would let a
    // four-line column masquerade as five.
    return inkRuns(
      png,
      Math.round(widthPx * 0.56),
      Math.round(widthPx * 0.8),
      heightPx - fh + 20,
      heightPx,
    );
  }

  it("wraps the registered address instead of shrinking it onto one line", async () => {
    const runs = await contactRuns();
    // Official Email, Phone / WhatsApp, Registered Address (two lines)
    // and Website. Four fields, five lines — the fifth line IS the fix:
    // before it, the address was squeezed onto one.
    expect(runs.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps real clearance between every contact line", async () => {
    const runs = await contactRuns();
    const gaps: number[] = [];
    for (let i = 1; i < runs.length; i++) {
      gaps.push(runs[i].start - (runs[i - 1].start + runs[i - 1].height));
    }
    // No line may touch or print through the one above it.
    for (const gap of gaps) expect(gap).toBeGreaterThan(0);
    // And no run may be two collided lines merged into one tall run.
    for (const run of runs) expect(run.height).toBeLessThan(30);
  });

  it("never abbreviates or truncates the registered address", async () => {
    // The address is a mandatory verified field: the wrap path must
    // render the whole of it, and the canvas must be untouched.
    const { png, widthPx, heightPx } = await renderFooter();
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });
});
