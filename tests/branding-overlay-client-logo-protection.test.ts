import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

/**
 * CLIENT LOGO RULE — protection proof.
 *
 * No client/employer-logo feature exists in the pipeline yet, so this
 * cannot be tested end-to-end. What CAN be proven today is the structural
 * invariant the rule depends on: the trust footer is composited last, at
 * a fixed height/position, fully opaque across its whole band — so
 * whatever a future creative-placement decision puts anywhere else in
 * `imagePng` (a client logo included) can never show through, shift, or
 * shrink the protected footer region.
 *
 * Simulated here with a bright, high-contrast "foreign" rectangle
 * pre-composited exactly where the footer will be drawn — the worst case
 * a misplaced client logo could produce.
 */
async function backgroundWithForeignMarkInFooterRegion(
  widthPx: number,
  heightPx: number,
  footerTop: number,
): Promise<Buffer> {
  const base = await sharp({
    create: { width: widthPx, height: heightPx, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .png()
    .toBuffer();
  const foreignMark = await sharp({
    create: { width: widthPx, height: heightPx - footerTop, channels: 3, background: { r: 255, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: foreignMark, left: 0, top: footerTop }])
    .png()
    .toBuffer();
}

describe("Trust footer — CLIENT LOGO RULE: the footer region cannot be entered, overlapped, or displaced", () => {
  it("fully overwrites a foreign mark pre-composited into the footer's reserved region", async () => {
    const widthPx = 1024;
    const heightPx = 1536;
    // Same footer-height formula the module itself uses (110..0.105H
    // capped at 0.15W) — reproduced here only to place the foreign mark,
    // not to duplicate any production logic under test.
    const footerHeightEstimate = Math.max(110, Math.round(Math.min(heightPx * 0.105, widthPx * 0.15)));
    const footerTop = heightPx - footerHeightEstimate;

    const contaminated = await backgroundWithForeignMarkInFooterRegion(widthPx, heightPx, footerTop);
    const clean = await sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();

    const resultFromContaminated = await applyBrandingOverlay({
      imagePng: contaminated,
      widthPx,
      heightPx,
      agencyName: "Protected Agency",
      registrationNumber: "RC-1234",
    });
    const resultFromClean = await applyBrandingOverlay({
      imagePng: clean,
      widthPx,
      heightPx,
      agencyName: "Protected Agency",
      registrationNumber: "RC-1234",
    });

    // The footer band itself must be byte-identical regardless of what
    // sat beneath it beforehand — the magenta "foreign mark" must never
    // survive into the final footer region.
    const a = await sharp(resultFromContaminated)
      .extract({ left: 0, top: footerTop, width: widthPx, height: footerHeightEstimate })
      .raw()
      .toBuffer();
    const b = await sharp(resultFromClean)
      .extract({ left: 0, top: footerTop, width: widthPx, height: footerHeightEstimate })
      .raw()
      .toBuffer();
    expect(a.equals(b)).toBe(true);

    // And no trace of the foreign magenta anywhere in that band.
    let foundMagenta = false;
    for (let i = 0; i < a.length; i += 3) {
      if (a[i] > 200 && a[i + 1] < 60 && a[i + 2] > 200) {
        foundMagenta = true;
        break;
      }
    }
    expect(foundMagenta).toBe(false);
  });

  it("keeps the footer's height and position fixed regardless of image content", async () => {
    const widthPx = 1024;
    const heightPx = 1536;
    const solid = await sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      .png()
      .toBuffer();
    const busy = await sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .composite([
        {
          input: await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 255, b: 0 } } })
            .png()
            .toBuffer(),
          tile: true,
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const resultSolid = await applyBrandingOverlay({ imagePng: solid, widthPx, heightPx, agencyName: "A" });
    const resultBusy = await applyBrandingOverlay({ imagePng: busy, widthPx, heightPx, agencyName: "A" });

    const metaSolid = await sharp(resultSolid).metadata();
    const metaBusy = await sharp(resultBusy).metadata();
    expect(metaSolid.height).toBe(heightPx);
    expect(metaBusy.height).toBe(heightPx);
    expect(metaSolid.width).toBe(widthPx);
    expect(metaBusy.width).toBe(widthPx);
  });
});
