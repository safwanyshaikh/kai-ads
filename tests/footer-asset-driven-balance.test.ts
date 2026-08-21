import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";
import { brandAsset } from "@/lib/brand-identity";

/**
 * FOOTER TEXT/ASSET VERTICAL BALANCE.
 *
 * planFooter (5db3a39) already sizes the band from
 * `max(text content, asset floor) + padding`, which is correct: a logo
 * or QR taller than the identity text legitimately grows the band.
 *
 * But the text column was drawn TOP-ALIGNED, while the logo and QR have
 * always been vertically CENTRED. When an asset — not the text — set the
 * band's height, 100% of the resulting slack landed as dead space below
 * the last text line, while the logo sat centred a few rows above it: an
 * asymmetric result even though the container itself was already
 * correctly sized. Not the old fixed-slab defect (that band was wrong
 * regardless of alignment) — a new one, introduced by fixing the first.
 *
 * The fix centres the text column too, floored at the same top
 * separation. Tenant-neutral: invented fixture data only.
 */

async function solidBackground(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 200, b: 200 } } })
    .png()
    .toBuffer();
}

async function tinyLogo(): Promise<Buffer> {
  return sharp({ create: { width: 80, height: 60, channels: 3, background: { r: 20, g: 60, b: 140 } } })
    .png()
    .toBuffer();
}

async function tinyQr(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } } })
    .png()
    .toBuffer();
}

/** Rows in [top, height) containing a bright pixel in the identity column. */
async function textRows(png: Buffer, top: number, height: number): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows: number[] = [];
  for (let y = top; y < top + height; y++) {
    let bright = false;
    for (let x = 40; x < 450; x += 2) {
      const i = (y * info.width + x) * info.channels;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum > 190) {
        bright = true;
        break;
      }
    }
    if (bright) rows.push(y - top);
  }
  return rows;
}

describe("A logo taller than the identity text does not strand the text at the top", () => {
  it("splits the leftover space roughly evenly above and below the text block", async () => {
    const widthPx = 1080;
    const heightPx = 1200;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Novara HR",
      registrationNumber: "B-0101/DEL/PER/1000+/5-2/9/1121/2011",
      agencyLogoPng: brandAsset("TENANT_PRIMARY_LOGO", await tinyLogo()),
    });

    // Detect the band the same way other footer tests do.
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let top = info.height;
    for (let y = info.height - 1; y >= 0; y--) {
      const i = (y * info.width + 4) * info.channels;
      const isNavy = Math.abs(data[i] - 0x0b) < 40 && Math.abs(data[i + 1] - 0x1f) < 40;
      if (!isNavy) break;
      top = y;
    }
    const bandH = info.height - top;

    const rows = await textRows(png, top, bandH);
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0];
    const last = rows[rows.length - 1];
    const above = first;
    const below = bandH - last;

    // Neither margin may be starved by the other — this is the exact
    // asymmetry the bug produced: `above` tiny, `below` consuming nearly
    // all the slack.
    expect(above).toBeGreaterThan(4);
    expect(below).toBeGreaterThan(4);
    const ratio = Math.max(above, below) / Math.max(1, Math.min(above, below));
    expect(ratio).toBeLessThan(2.2);
  }, 60_000);

  it("does the same when a QR sets the floor instead of a logo", async () => {
    const widthPx = 1080;
    const heightPx = 1200;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Novara HR",
      registrationNumber: "B-0101/DEL/PER/1000+/5-2/9/1121/2011",
      qrPng: brandAsset("KAI_VERIFICATION_QR", await tinyQr()),
    });

    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let top = info.height;
    for (let y = info.height - 1; y >= 0; y--) {
      const i = (y * info.width + 4) * info.channels;
      const isNavy = Math.abs(data[i] - 0x0b) < 40 && Math.abs(data[i + 1] - 0x1f) < 40;
      if (!isNavy) break;
      top = y;
    }
    const bandH = info.height - top;
    const rows = await textRows(png, top, bandH);
    expect(rows.length).toBeGreaterThan(0);
    const above = rows[0];
    const below = bandH - rows[rows.length - 1];
    expect(above).toBeGreaterThan(4);
    expect(below).toBeGreaterThan(4);
    const ratio = Math.max(above, below) / Math.max(1, Math.min(above, below));
    expect(ratio).toBeLessThan(2.2);
  }, 60_000);
});

describe("Text-only footers stay tight, not re-centred into a slab", () => {
  it("a short two-line footer with no assets keeps small, near-equal margins", async () => {
    const widthPx = 1080;
    const heightPx = 1200;
    const png = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Novara HR",
      registrationNumber: "B-0101/DEL/PER/1000+/5-2/9/1121/2011",
    });

    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let top = info.height;
    for (let y = info.height - 1; y >= 0; y--) {
      const i = (y * info.width + 4) * info.channels;
      const isNavy = Math.abs(data[i] - 0x0b) < 40 && Math.abs(data[i + 1] - 0x1f) < 40;
      if (!isNavy) break;
      top = y;
    }
    const bandH = info.height - top;
    const rows = await textRows(png, top, bandH);
    const above = rows[0];
    const below = bandH - rows[rows.length - 1];

    // Centring a genuinely tight band produces small margins on both
    // sides — nothing like the old fixed-slab's ~85px each side.
    expect(above).toBeLessThan(40);
    expect(below).toBeLessThan(40);
  }, 60_000);
});
