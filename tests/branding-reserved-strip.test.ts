import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BRANDING_RESERVED_HEIGHT_PCT } from "@/server/generation/pipeline/branding-overlay";

/**
 * Regression guard for a defect that reached real generated output: the
 * Creative Brief told the image model to keep the bottom 12% clear while
 * the Branding Overlay actually painted over 17.5%. The image model
 * composed ad copy into the 5.5% gap and the opaque band cut it in half —
 * on live runs this cost an entire position line, a contact phone number,
 * and half a benefits list.
 *
 * The brief now interpolates BRANDING_RESERVED_HEIGHT_PCT, so the two can
 * only drift apart if someone hardcodes a percentage back into the prompt.
 * That is exactly what these tests fail on.
 */
describe("Branding overlay reserved strip", () => {
  const briefSource = readFileSync("src/server/generation/pipeline/creative-brief.ts", "utf8");

  it("reserves at least as much as the overlay actually paints over", () => {
    // Overlay geometry: BAND_HEIGHT_PCT (0.13) + CONTACT_ROW_HEIGHT_PCT (0.045).
    expect(BRANDING_RESERVED_HEIGHT_PCT).toBeGreaterThanOrEqual(17.5);
  });

  it("stays a sane fraction of the canvas", () => {
    expect(BRANDING_RESERVED_HEIGHT_PCT).toBeLessThanOrEqual(25);
  });

  it("is interpolated into the Creative Brief rather than hardcoded", () => {
    expect(briefSource).toContain("BRANDING_RESERVED_HEIGHT_PCT");
  });

  it("leaves no hardcoded bottom-strip percentage in the Creative Brief", () => {
    // e.g. a literal "bottom 12%" creeping back into the prompt text.
    expect(briefSource).not.toMatch(/bottom\s+\d+\s*%/i);
  });
});
