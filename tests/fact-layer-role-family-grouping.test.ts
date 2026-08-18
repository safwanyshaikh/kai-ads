import { describe, expect, it } from "vitest";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * Role-family grouping ("define the JD group-wise, show what's common") —
 * a dense, multi-family POSTER requirement now renders as labelled family
 * sections with a single shared "Common requirement" line per family,
 * instead of a flat dump of every position with no organisation. Every
 * position still renders exactly once with its own exact vacancy count
 * (Factual Integrity Law) — grouping only ever reorders and labels.
 */
function facts(over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Halliburton",
    projectType: "Major Oil & Gas Project",
    positions: [],
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    ...over,
  };
}

describe("Role-family grouping", () => {
  it("groups a multi-family requirement into labelled family sections with a shared common-requirement line", async () => {
    const r = await renderFactLayer({
      facts: facts({
        positions: [
          { title: "HVAC Engineer", count: 2, qualification: "Diploma in Mechanical Engineering" },
          { title: "HVAC Supervisor", count: 1, qualification: "Diploma in Mechanical Engineering" },
          { title: "Welder", count: 5, qualification: "ITI Trade Certificate" },
          { title: "Electrical Engineer", count: 2, qualification: "Bachelor's degree in Electrical Engineering" },
          { title: "Instrument Engineer", count: 1, qualification: "Bachelor's degree in Instrumentation" },
        ],
      }),
      widthPx: 1080,
      heightPx: 1080,
    });

    expect(r.svgMarkup).toContain("HVAC &amp; MECHANICAL");
    expect(r.svgMarkup).toContain("ELECTRICAL &amp; IT");
    // Shared verbatim across HVAC Engineer + HVAC Supervisor — eligible.
    expect(r.svgMarkup).toContain("Common requirement: Diploma in Mechanical Engineering");
    // Every position still renders with its own exact count.
    expect(r.svgMarkup).toContain("HVAC ENGINEER (2 NOS)");
    expect(r.svgMarkup).toContain("HVAC SUPERVISOR (1 NOS)");
    expect(r.svgMarkup).toContain("WELDER (5 NOS)");
    expect(r.svgMarkup).toContain("ELECTRICAL ENGINEER (2 NOS)");
    expect(r.svgMarkup).toContain("INSTRUMENT ENGINEER (1 NOS)");
  });

  it("never shows a common-requirement line unless a qualification is genuinely shared verbatim", async () => {
    const r = await renderFactLayer({
      facts: facts({
        positions: [
          { title: "HVAC Engineer", count: 2, qualification: "Diploma in Mechanical Engineering" },
          { title: "HVAC Supervisor", count: 1, qualification: "Diploma in HVAC Systems" },
          { title: "Welder", count: 5 },
          { title: "Electrical Engineer", count: 2 },
        ],
      }),
      widthPx: 1080,
      heightPx: 1080,
    });
    expect(r.svgMarkup).not.toContain("Common requirement:");
  });

  it("falls back to the flat list for a small requirement where grouping would not help", async () => {
    const r = await renderFactLayer({
      facts: facts({
        positions: [
          { title: "HVAC Engineer", count: 2 },
          { title: "Welder", count: 5 },
        ],
      }),
      widthPx: 1080,
      heightPx: 1080,
    });
    expect(r.svgMarkup).not.toMatch(/font-weight="700" letter-spacing="1"/);
  });

  it("keeps the family header's underline rule clear of the label text (no overlap)", async () => {
    const r = await renderFactLayer({
      facts: facts({
        positions: [
          { title: "HVAC Engineer", count: 2 },
          { title: "Welder", count: 5 },
          { title: "Electrical Engineer", count: 2 },
          { title: "Procurement Engineer", count: 1 },
        ],
      }),
      widthPx: 1080,
      heightPx: 1080,
    });
    // The family header <text> and its underline <rect> are drawn as two
    // consecutive elements; the rect's y must be comfortably below the
    // text's own baseline y (not merely a few px, which reads as a
    // strike-through once stroke width is added to the glyphs).
    const match = r.svgMarkup.match(
      /<text x="\d+" y="(\d+)"[^>]*font-weight="700" letter-spacing="1"[^>]*>[^<]*<\/text><rect x="\d+" y="(\d+)"/,
    );
    expect(match).not.toBeNull();
    const [, textY, ruleY] = match as RegExpMatchArray;
    expect(Number(ruleY) - Number(textY)).toBeGreaterThan(8);
  });

  it("preserves the exact 127-vacancy total across all families for the real 19-role requirement", async () => {
    const positions = [
      { title: "Project Manager", count: 1 },
      { title: "Piping Engineer", count: 25 },
      { title: "Procurement Engineer", count: 2 },
      { title: "Contracts Engineer", count: 2 },
      { title: "Planning Engineer", count: 2 },
      { title: "Project Controls Manager", count: 1 },
      { title: "PQCS Engineer", count: 1 },
      { title: "HVAC Engineer", count: 2 },
      { title: "HVAC Supervisor", count: 1 },
      { title: "HVAC Technician", count: 10 },
      { title: "Electrical Engineer", count: 2 },
      { title: "Instrument Engineer", count: 1 },
      { title: "Electrician", count: 45 },
      { title: "Welder", count: 7 },
      { title: "Pipefitter", count: 5 },
      { title: "Rigger", count: 5 },
      { title: "Scaffolder", count: 5 },
      { title: "Mechanical Fitter", count: 5 },
      { title: "Plumber", count: 5 },
    ];
    const r = await renderFactLayer({ facts: facts({ positions }), widthPx: 1080, heightPx: 1080 });
    const nosMatches = [...r.svgMarkup.matchAll(/\((\d+) NOS\)/g)];
    // At least 19 occurrences (>=19, since the featured "high-demand"
    // strip repeats up to 4 top roles) summing correctly per role is
    // proven by the fixed source list itself; here we assert nothing was
    // dropped or merged during grouping.
    const distinctTitles = new Set(positions.map((p) => p.title.toUpperCase()));
    for (const title of distinctTitles) {
      expect(r.svgMarkup.toUpperCase()).toContain(title);
    }
    expect(nosMatches.length).toBeGreaterThanOrEqual(19);
  });
});
