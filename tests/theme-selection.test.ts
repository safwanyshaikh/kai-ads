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
    expect(selectTheme(facts(15)).theme).toBe("PREMIUM_CAMPAIGN");
  });

  it("switches to AAT/DTP above 15 positions", () => {
    expect(selectTheme(facts(15)).theme).toBe("PREMIUM_CAMPAIGN");
    expect(selectTheme(facts(16)).theme).toBe("AAT_DTP");
    expect(selectTheme(facts(120)).theme).toBe("AAT_DTP");
  });

  it("forces AAT/DTP for an explicit print or newspaper destination", () => {
    // A campaign layout is the wrong artefact for a newsprint column, even
    // for a single role.
    const printed = selectTheme(facts(2), null, { printOrNewspaper: true });
    expect(printed.theme).toBe("AAT_DTP");
    expect(printed.fromOverride).toBe(false);
    expect(printed.reason).toMatch(/print or newspaper/i);
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
    const forcedDense = selectTheme(facts(2), "AAT_DTP");
    expect(forcedDense.theme).toBe("AAT_DTP");
    expect(forcedDense.fromOverride).toBe(true);

    const forcedPremium = selectTheme(facts(80), "PREMIUM_CAMPAIGN");
    expect(forcedPremium.theme).toBe("PREMIUM_CAMPAIGN");
    expect(forcedPremium.fromOverride).toBe(true);
  });

  it("does not fall over on an empty requirement", () => {
    expect(() => selectTheme(facts(0))).not.toThrow();
  });
});
