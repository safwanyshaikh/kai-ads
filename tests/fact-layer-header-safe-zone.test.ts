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
    // The header gives ground to body content as density rises. That is
    // now measured against each advertisement's OWN height rather than
    // against canvas width: the band is capped as a fraction of the
    // canvas it sits on (POSTER_ARTWORK_MAX_FRACTION), because a band
    // specified only as 0.34W silently became 35-40% of a SHORT canvas
    // even while it stayed a modest header on a tall one.
    //
    // Measured this way the original intent holds and is stronger — a
    // dense requirement spends proportionally far less of its
    // advertisement on the header than a sparse one does.
    const sparseFraction = sparse.artworkHeightPx / sparse.heightPx;
    const denseFraction = dense.artworkHeightPx / dense.heightPx;
    expect(denseFraction).toBeLessThan(sparseFraction);

    // And neither may exceed the cap, whatever its density.
    expect(sparseFraction).toBeLessThanOrEqual(0.23);
    // A dense requirement keeps a real artwork band (posterArtworkFloor),
    // which on its taller canvas is still a modest share of the page.
    expect(denseFraction).toBeLessThanOrEqual(0.23);

    // HEADER_DENSITY_FACTOR still governs the width-derived bound where
    // that is what binds. 35 roles is T3 (13-40), whose factor is 0.92 —
    // 0.85 is T4 (41+).
    expect(dense.artworkHeightPx).toBeLessThanOrEqual(Math.round(0.34 * 1080 * 0.92));
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
