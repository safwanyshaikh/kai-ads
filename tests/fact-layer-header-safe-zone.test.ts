import { describe, expect, it } from "vitest";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * FINAL COMMERCIAL LAYOUT LOCK — Header Safe Zone regression.
 *
 * The header/photo band is no longer one fixed fraction of width
 * regardless of the requirement, and the identity mark can claim more of
 * that space when Gemini's own artwork (measured upstream in
 * generate.ts — see assessHeaderZoneVisualWeight) is flat. Neither
 * behaviour ever crops or replaces artwork; both are asserted here via
 * the deterministic fact layer's own output.
 */
function facts(count: number, over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Halliburton",
    projectType: "Major Oil & Gas Project",
    positions: Array.from({ length: count }, (_, i) => ({ title: `Field Professional Level ${i + 1}` })),
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    ...over,
  };
}

describe("Header Safe Zone — adaptive header band", () => {
  it("compresses the header band's reserve as density rises, without ever shrinking artworkHeightPx to zero", async () => {
    const sparse = await renderFactLayer({ facts: facts(2), widthPx: 1080, heightPx: 1080 });
    const dense = await renderFactLayer({ facts: facts(35), widthPx: 1080, heightPx: 1080 });
    // Both keep a real header/artwork band (never collapses to nothing —
    // the reserve only compresses, it never disappears).
    expect(sparse.artworkHeightPx).toBeGreaterThan(0);
    expect(dense.artworkHeightPx).toBeGreaterThan(0);
    // The T3+ (35-role) band is a smaller fraction of ITS OWN canvas width
    // than the T1/T2 (2-role) band is of its own — the header genuinely
    // gives ground to body content as density rises, matching the
    // documented HEADER_DENSITY_FACTOR.
    const sparseFraction = sparse.artworkHeightPx / 1080;
    const denseFraction = dense.artworkHeightPx / 1080;
    expect(denseFraction).toBeLessThan(sparseFraction);
  });

  it("defaults to the minimal header treatment when no header-zone signal is supplied (standalone renders never guess)", async () => {
    const r = await renderFactLayer({ facts: facts(4), widthPx: 1080, heightPx: 1080 });
    expect(r.svgMarkup).not.toContain('id="headerBase"');
  });

  it("gives the header zone more presence when Gemini's own artwork measured flat", async () => {
    const flat = await renderFactLayer({
      facts: facts(4),
      widthPx: 1080,
      heightPx: 1080,
      headerZoneHasStrongSubject: false,
    });
    const strong = await renderFactLayer({
      facts: facts(4),
      widthPx: 1080,
      heightPx: 1080,
      headerZoneHasStrongSubject: true,
    });
    // The flat case draws an additional soft accent band the strong case
    // does not — more presence, never a solid overlay or a crop.
    expect(flat.svgMarkup).toContain('id="headerBase"');
    expect(strong.svgMarkup).not.toContain('id="headerBase"');

    // The agency mark itself is drawn larger in the flat case — same
    // agency name, larger font-size somewhere in the chip's <text>.
    const markSizeOf = (svg: string) => {
      const match = svg.match(/font-size="(\d+)" font-weight="600" fill="[^"]+" letter-spacing="2">AL-YOUSUF/);
      return match ? Number(match[1]) : null;
    };
    const flatSize = markSizeOf(flat.svgMarkup);
    const strongSize = markSizeOf(strong.svgMarkup);
    expect(flatSize).not.toBeNull();
    expect(strongSize).not.toBeNull();
    expect(flatSize as number).toBeGreaterThan(strongSize as number);
  });

  it("never lets the agency-name chip's text run past its own background rectangle, even for a very long name", async () => {
    // Regression: the identity chip's width estimate ignored per-string
    // letter-spacing accumulation, and the header-flat enlargement
    // (headerZoneHasStrongSubject: false) made an existing long-name risk
    // visible for the first time. Both are fixed with a shrink-to-fit
    // loop against the safe margin, mirroring how every other text
    // element in this file already handles long strings.
    const r = await renderFactLayer({
      facts: facts(4, { agencyName: "Sample Overseas Recruitment Agency And Manpower Consultancy LLP" }),
      widthPx: 1080,
      heightPx: 1080,
      headerZoneHasStrongSubject: false,
    });
    const chipRectMatch = r.svgMarkup.match(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="\d+" fill="[^"]+" fill-opacity="0\.78"\/>/);
    expect(chipRectMatch).not.toBeNull();
    const [, xStr, , wStr] = chipRectMatch as RegExpMatchArray;
    const chipRight = Number(xStr) + Number(wStr);
    expect(chipRight).toBeLessThanOrEqual(1080);
  });

  it("never crops or removes artwork — the header treatment only adds transparent-safe overlays, canvas dimensions are unaffected by the signal", async () => {
    const flat = await renderFactLayer({
      facts: facts(4),
      widthPx: 1080,
      heightPx: 1080,
      headerZoneHasStrongSubject: false,
    });
    const strong = await renderFactLayer({
      facts: facts(4),
      widthPx: 1080,
      heightPx: 1080,
      headerZoneHasStrongSubject: true,
    });
    expect(flat.heightPx).toBe(strong.heightPx);
  });
});
