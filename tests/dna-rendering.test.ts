import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { listDnas, getDna } from "@/server/generation/dna/registry";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import { applyAgencyBrand, buildAgencyDna } from "@/server/generation/dna/agency-dna";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const TRADES = [
  "TIG Welder 6G", "Pipe Fitter", "Scaffolder", "Rigger", "Instrument Technician",
  "Electrician", "Mason", "Steel Fixer", "HVAC Technician", "Crane Operator",
  "Safety Officer", "Store Keeper", "Painter", "Insulator", "Carpenter",
];

function facts(n: number): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Bilfinger Middle East",
    projectType: "Refinery Shutdown 2026",
    visaType: "Work Visa",
    dutyHours: "10 hours/day, 6 days/week",
    positions: Array.from({ length: n }, (_, i) => ({
      title: TRADES[i % TRADES.length],
      count: (i % 7) + 2,
      experience: "Min. 5 years",
      salary: `SAR ${1500 + (i % 6) * 300}`,
      qualification: "ITI / Diploma",
    })),
    benefits: [{ label: "Free Food" }, { label: "Accommodation" }, { label: "Medical Insurance" }],
    interview: [{ date: "12th September 2026", location: "Mumbai" }],
    contact: { phone: "+91 86559 60415", whatsapp: "+91 86559 60415", email: "jobs@example.test" },
    agencyName: "Al Yousuf Enterprises LLP",
    raLicenseId: "B-0655/MUM/PER",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  };
}

const W = 640;

describe("Every production DNA renders through the one Rendering Engine", () => {
  it.each(listDnas().map((d) => [d.id, d.label] as const))(
    "%s (%s) renders every verified fact at the requested width",
    async (id) => {
      const dna = getDna(id);
      // Enough roles to exercise the composition the DNA was authored for.
      const r = await renderFactLayer({
        facts: facts(dna.composition === "AAT_DTP" ? 24 : 6),
        widthPx: W,
        heightPx: W,
        dna,
      });
      const meta = await sharp(r.png).metadata();
      expect(meta.width).toBe(W);
      expect(meta.height).toBe(r.heightPx);
      // The canvas grows for a dense requirement; it never shrinks below
      // what was asked for, and never shrinks type to force a fit.
      expect(r.heightPx).toBeGreaterThanOrEqual(W);
      expect(r.artworkHeightPx).toBeGreaterThan(0);
      expect(r.artworkHeightPx).toBeLessThan(r.heightPx);
    },
  );
});

describe("Design DNA changes the design, never the facts or the guarantees", () => {
  it("produces visibly different output for different DNAs", async () => {
    const a = await renderFactLayer({ facts: facts(5), widthPx: W, heightPx: W, dna: getDna("PS-01") });
    const b = await renderFactLayer({ facts: facts(5), widthPx: W, heightPx: W, dna: getDna("CP-04") });
    expect(a.png.equals(b.png)).toBe(false);
  });

  it("is deterministic — the same DNA and facts give byte-identical output", async () => {
    const dna = getDna("OG-02");
    const a = await renderFactLayer({ facts: facts(8), widthPx: W, heightPx: W, dna });
    const b = await renderFactLayer({ facts: facts(8), widthPx: W, heightPx: W, dna });
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.heightPx).toBe(b.heightPx);
  });

  it("keeps failing closed on capacity, whichever DNA is used", async () => {
    // A DNA may not buy itself capacity it does not have. The engine still
    // refuses to publish rather than silently dropping roles.
    for (const id of ["PS-06", "AA-04", "CN-09"]) {
      await expect(
        renderFactLayer({ facts: facts(4000), widthPx: W, heightPx: W, dna: getDna(id) }),
        `${id} must fail closed`,
      ).rejects.toThrow(/cannot be rendered without omitting verified information/);
    }
  });

  it("renders with an agency's brand colours applied", async () => {
    const dna = getDna("PS-01");
    const agency = buildAgencyDna({
      id: "a",
      name: "Al Yousuf Enterprises LLP",
      registrationNumber: "B-0655/MUM/PER",
      brandColours: { primary: "#1A2B4C", secondary: "#C62828" },
    });
    const { palette } = applyAgencyBrand(dna, agency);
    const branded = await renderFactLayer({ facts: facts(5), widthPx: W, heightPx: W, dna, palette });
    const plain = await renderFactLayer({ facts: facts(5), widthPx: W, heightPx: W, dna });
    expect(branded.png.equals(plain.png)).toBe(false);
    // Same layout — only the colour changed.
    expect(branded.heightPx).toBe(plain.heightPx);
  });

  it("reproduces the shipping look when no DNA is supplied", async () => {
    const implicit = await renderFactLayer({ facts: facts(5), widthPx: W, heightPx: W });
    const explicit = await renderFactLayer({ facts: facts(5), widthPx: W, heightPx: W, dna: getDna("PS-01") });
    expect(implicit.png.equals(explicit.png)).toBe(true);
  });
});
