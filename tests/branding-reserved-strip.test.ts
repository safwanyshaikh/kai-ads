import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BRANDING_RESERVED_HEIGHT_PCT,
  brandingStripHeight,
} from "@/server/generation/pipeline/branding-overlay";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * The bottom of the canvas belongs to the branding band, which is painted
 * opaquely — anything drawn beneath it is destroyed, not overlapped. A live
 * run once lost a position line, a phone number and half a benefits list
 * this way, because the brief advertised a 12% reserve while the engine
 * painted 17.5%.
 *
 * Under the Factual Integrity Law that reserve is no longer a sentence in a
 * prompt a model may ignore. The Fact Layer places every fact itself and
 * takes the strip height from the Rendering Engine, so the two cannot drift.
 * This is asserted behaviourally: nothing is drawn in the strip at all.
 */
const facts = (count: number): AdvertisementFacts => ({
  header: "Urgent Requirement — Saudi Arabia",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Halliburton",
  positions: Array.from({ length: count }, (_, i) => ({ title: `Field Professional Level ${i + 1}` })),
  benefits: [{ label: "Free accommodation" }],
  interview: [{ date: "5th August 2026", location: "Mumbai office" }],
  contact: { phone: "+91 22 6666 5353", email: "jobs@alyousufent.com" },
  agencyName: "Al-Yousuf Enterprises L.L.P.",
  fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
});

describe("Reserved branding strip", () => {
  it("reserves at least as much as the overlay actually paints over", () => {
    expect(BRANDING_RESERVED_HEIGHT_PCT).toBeGreaterThanOrEqual(17.5);
  });

  it("stays a sane fraction of the canvas", () => {
    expect(BRANDING_RESERVED_HEIGHT_PCT).toBeLessThanOrEqual(25);
  });

  it("draws nothing at all inside the strip the band will paint over", async () => {
    for (const n of [1, 12, 40, 120]) {
      const { png, heightPx } = await renderFactLayer({
        facts: facts(n),
        widthPx: 1024,
        heightPx: 1024,
      });
      const strip = brandingStripHeight(1024, heightPx, true);
      const { data, info } = await sharp(png)
        .extract({ left: 0, top: heightPx - strip, width: 1024, height: strip })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let opaque = 0;
      for (let i = 3; i < data.length; i += info.channels) if (data[i] !== 0) opaque++;
      expect(opaque, `Fact Layer drew into the branding strip at ${n} positions`).toBe(0);
    }
  });

  it("caps the strip against width so a tall poster keeps a sane band", () => {
    // 1024x3084: a purely height-proportional band would be ~540px tall and
    // its agency name and contact line would overflow horizontally.
    expect(brandingStripHeight(1024, 3084, true)).toBeLessThan(Math.round(3084 * 0.175));
    // On a square canvas the original proportional geometry is unchanged.
    expect(brandingStripHeight(1024, 1024, true)).toBe(
      Math.round(1024 * 0.13) + Math.round(1024 * 0.045),
    );
  });
});
