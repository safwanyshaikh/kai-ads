import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HIRING_CORRIDORS,
  isPeakHiringMonth,
  resolveRegionIntelligence,
  SUPPLY_REGIONS,
} from "@/server/generation/dna/region-intelligence";

describe("Region Intelligence is objective recruitment data only", () => {
  it("holds no profiling, targeting, emotion or literacy concept anywhere", () => {
    // The prohibition is structural: there is no field on any type here
    // that could carry such a value. This test is the tripwire for a
    // future change that tries to add one.
    const source = readFileSync("src/server/generation/dna/region-intelligence.ts", "utf8");
    const body = source.slice(source.indexOf("export type IndianState"));
    for (const banned of [
      "psycholog",
      "behaviour",
      "behavior",
      "emotion",
      "literacy",
      "persuas",
      "sentiment",
      "motivation",
      "aspiration",
      "desperat",
      "vulnerab",
    ]) {
      expect(body.toLowerCase(), `"${banned}" must not appear in the data model`).not.toContain(banned);
    }
  });

  it("describes places and trades, never people", () => {
    for (const region of SUPPLY_REGIONS) {
      expect(region.trades.length).toBeGreaterThan(0);
      expect(region.languages).toContain("en");
      expect(Object.keys(region).sort()).toEqual(["label", "languages", "state", "trades"]);
    }
  });

  it("describes employer demand, not candidate characteristics", () => {
    for (const corridor of HIRING_CORRIDORS) {
      expect(Object.keys(corridor).sort()).toEqual([
        "country",
        "industries",
        "label",
        "peakMonths",
        "typicalProjectBackground",
      ]);
    }
  });
});

describe("Resolving region intelligence for a requirement", () => {
  it("matches a destination to its hiring corridor", () => {
    const r = resolveRegionIntelligence({
      country: "Saudi Arabia",
      industry: "Oil & Gas",
      positionTitles: ["TIG Welder 6G", "Pipe Fitter"],
    });
    expect(r.corridor?.label).toBe("Saudi Arabia");
    expect(r.corridor?.industryMatchesCorridor).toBe(true);
    expect(r.imageryDirection).toBeTruthy();
  });

  it("reports an unknown corridor as absent rather than approximating one", () => {
    const r = resolveRegionIntelligence({
      country: "Republic of Nowhere",
      industry: "Oil & Gas",
      positionTitles: ["Welder"],
    });
    expect(r.corridor).toBeNull();
    expect(r.imageryDirection).toBeNull();
  });

  it("identifies supply geography from the verified trade names", () => {
    const r = resolveRegionIntelligence({
      country: "Saudi Arabia",
      industry: "Construction",
      positionTitles: ["Mason", "Steel Fixer"],
    });
    const states = r.supplyRegions.map((s) => s.state);
    expect(states).toContain("BIHAR");
    expect(states).toContain("UTTAR_PRADESH");
  });

  it("suggests languages a drive is likely to need, English always included", () => {
    const nurses = resolveRegionIntelligence({
      country: "United Arab Emirates",
      industry: "Healthcare",
      positionTitles: ["Staff Nurse", "ICU Nurse"],
    });
    expect(nurses.suggestedLanguages).toContain("ml");
    expect(nurses.suggestedLanguages).toContain("en");

    const drivers = resolveRegionIntelligence({
      country: "Qatar",
      industry: "Logistics",
      positionTitles: ["Heavy Driver", "Truck Driver"],
    });
    expect(drivers.suggestedLanguages).toContain("pa");
  });

  it("always includes English even when no trade matches a supply region", () => {
    const r = resolveRegionIntelligence({ country: null, industry: null, positionTitles: ["Falconer"] });
    expect(r.suggestedLanguages).toEqual(["en"]);
    expect(r.supplyRegions).toEqual([]);
  });

  it("reports seasonality as advice, and only where there is a corridor", () => {
    const known = resolveRegionIntelligence({ country: "Oman", industry: "Oil", positionTitles: [] });
    expect(isPeakHiringMonth(known, 2)).toBe(true);
    expect(isPeakHiringMonth(known, 7)).toBe(false);

    const unknown = resolveRegionIntelligence({ country: "Atlantis", industry: null, positionTitles: [] });
    expect(isPeakHiringMonth(unknown, 2)).toBeNull();
  });
});
