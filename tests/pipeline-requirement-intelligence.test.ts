import { describe, expect, it } from "vitest";
import { buildAdvertisementFacts } from "@/server/generation/pipeline/requirement-intelligence";

describe("Requirement Intelligence — grounded facts assembly", () => {
  const advertisement = {
    header: "Multi Welders Required for Saudi Arabia",
    industry: "Construction",
    country: "Saudi Arabia",
    employer: null,
    positions: [{ title: "Multi Welder", salary: "5K to 7K Basic" }],
    benefits: [{ label: "Food Allowance", detail: "300 per month" }],
    interview: { events: [{ date: "1 Aug 2026", location: "Mumbai" }] },
    contact: { email: "jobs@example.com", phone: "0000000000" },
    footer: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
  };
  const agency = {
    name: "Al Yousuf Enterprises LLP",
    registrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
  };

  it("labels a bare salary figure with the destination's real currency", () => {
    const facts = buildAdvertisementFacts(advertisement, agency);
    expect(facts.positions[0].salary).toBe("SAR 5K to 7K Basic");
  });

  it("labels a bare benefit detail figure with the destination's real currency", () => {
    const facts = buildAdvertisementFacts(advertisement, agency);
    expect(facts.benefits[0].detail).toBe("SAR 300 per month");
  });

  it("derives the compact RA license number from the full registration string", () => {
    const facts = buildAdvertisementFacts(advertisement, agency);
    expect(facts.raLicenseId).toBe("9986");
    expect(facts.fullRegistrationNumber).toBe(agency.registrationNumber);
  });

  it("normalizes structured interview events", () => {
    const facts = buildAdvertisementFacts(advertisement, agency);
    expect(facts.interview).toEqual([{ date: "1 Aug 2026", location: "Mumbai" }]);
  });

  it("never adds a fact that isn't present on the source record", () => {
    const facts = buildAdvertisementFacts({ ...advertisement, employer: null }, agency);
    expect(facts.employer).toBeNull();
  });
});
