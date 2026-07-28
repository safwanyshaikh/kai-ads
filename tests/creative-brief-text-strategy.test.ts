import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Two reliability rules earned from live generation failures in this
 * project. Both live in the Creative Brief prompt, so they are guarded by
 * asserting on the prompt source rather than by burning an image call.
 *
 * 1. Text-rendering strategy. Every unreadable string produced during this
 *    project's live runs — "EXACT POITIOES", "STABLE CULF CARPEDIAATE
 *    CAREER", "advancementes", "case em reliable", "DEPLOYSENY" — was
 *    invented editorial copy, never a grounded fact. Position titles,
 *    counts, salaries, phone numbers and dates rendered correctly. So the
 *    brief must not ask the image model to print marketing prose.
 *
 * 2. Position overflow. Real bulk requirements carry 100+ titles (the
 *    Halliburton reference had 126 across 19 departments). Printing them
 *    all yields illegible type or a silent drop; the ad must instead show
 *    a subset and state the true total.
 */
describe("Creative Brief text-rendering strategy", () => {
  const source = readFileSync("src/server/generation/pipeline/creative-brief.ts", "utf8");

  it("separates visual direction from the text actually rendered", () => {
    expect(source).toContain("VISUAL DIRECTION");
    expect(source).toContain("TEXT TO RENDER");
  });

  it("forbids asking the image model to print marketing prose", () => {
    expect(source).toMatch(/do not ask the image model to print/i);
    expect(source).toMatch(/slogans|taglines/i);
  });

  it("caps how many positions may be printed on one canvas", () => {
    expect(source).toContain("MAX_CANVAS_POSITIONS");
  });

  it("states the true total instead of implying the printed list is complete", () => {
    expect(source).toMatch(/never imply the printed list is the complete list/i);
    expect(source).toMatch(/positions available/i);
  });

  it("still forbids fabrication and placeholder copy", () => {
    expect(source).toMatch(/zero fabrication/i);
    expect(source).toMatch(/no placeholder text/i);
  });
});
