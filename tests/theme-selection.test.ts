import { describe, it, expect } from "vitest";
import { selectTheme } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

function facts(count: number, withDetail = false): AdvertisementFacts {
  return {
    header: "TEST CAMPAIGN",
    agencyName: "Test Agency LLP",
    industry: "Oil & Gas",
    country: "SAUDI ARABIA",
    positions: Array.from({ length: count }, (_, i) => ({
      title: `Technician ${i + 1}`,
      ...(withDetail ? { salary: "SAR 2,000", experience: "Min. 5 years" } : {}),
    })),
    benefits: [],
    interview: [],
    contact: { email: "jobs@example.com" },
  } as unknown as AdvertisementFacts;
}

describe("Automatic theme selection", () => {
  it("uses Premium Campaign for a small requirement", () => {
    expect(selectTheme(facts(1)).theme).toBe("PREMIUM_CAMPAIGN");
    expect(selectTheme(facts(6)).theme).toBe("PREMIUM_CAMPAIGN");
    expect(selectTheme(facts(19)).theme).toBe("PREMIUM_CAMPAIGN");
  });

  it("switches to High Density at 20 positions", () => {
    expect(selectTheme(facts(20)).theme).toBe("HIGH_DENSITY");
    expect(selectTheme(facts(120)).theme).toBe("HIGH_DENSITY");
  });

  it("switches earlier when most roles carry salary and qualification detail", () => {
    // 13 bare titles still read well as a campaign; 13 roles each carrying a
    // salary and an experience line do not.
    expect(selectTheme(facts(13)).theme).toBe("PREMIUM_CAMPAIGN");
    expect(selectTheme(facts(13, true)).theme).toBe("HIGH_DENSITY");
  });

  it("always explains the choice, for the recruiter and for analytics", () => {
    expect(selectTheme(facts(6)).reason).toMatch(/6 positions/);
    expect(selectTheme(facts(40)).reason).toMatch(/40 positions/);
  });

  it("never marks an automatic choice as an override", () => {
    expect(selectTheme(facts(6)).fromOverride).toBe(false);
    expect(selectTheme(facts(40)).fromOverride).toBe(false);
  });

  it("honours a recruiter override in both directions", () => {
    const forcedDense = selectTheme(facts(2), "HIGH_DENSITY");
    expect(forcedDense.theme).toBe("HIGH_DENSITY");
    expect(forcedDense.fromOverride).toBe(true);

    const forcedPremium = selectTheme(facts(80), "PREMIUM_CAMPAIGN");
    expect(forcedPremium.theme).toBe("PREMIUM_CAMPAIGN");
    expect(forcedPremium.fromOverride).toBe(true);
  });

  it("does not fall over on an empty requirement", () => {
    expect(() => selectTheme(facts(0))).not.toThrow();
  });
});
