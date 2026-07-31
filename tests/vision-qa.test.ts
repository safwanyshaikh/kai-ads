import { describe, it, expect } from "vitest";
import { buildExpectations, VisionQaRejectedError } from "@/server/generation/pipeline/vision-qa";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

function factsFixture(overrides: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "PLANT MAINTENANCE — SAUDI ARABIA",
    agencyName: "Al Yousuf Enterprises LLP",
    industry: "Oil & Gas",
    country: "SAUDI ARABIA",
    positions: [
      { title: "Instrument Technician", salary: "SAR 2,000" },
      { title: "Electrical Technician" },
    ],
    benefits: [{ label: "Free Accommodation" }],
    interview: [],
    contact: { phone: "+91 86559 60415", whatsapp: "+91 86559 60415", email: "jobs@alyousufent.com" },
    raLicenseId: "B-0655/MUM/PER/1000+",
    ...overrides,
  } as AdvertisementFacts;
}

describe("Vision QA — expectations built from verified facts", () => {
  it("checks the header, agency, every position title and every salary", () => {
    const expectations = buildExpectations(factsFixture());
    const values = expectations.map((e) => e.value);

    expect(values).toContain("PLANT MAINTENANCE — SAUDI ARABIA");
    expect(values).toContain("Al Yousuf Enterprises LLP");
    expect(values).toContain("Instrument Technician");
    expect(values).toContain("Electrical Technician");
    expect(values).toContain("SAR 2,000");
  });

  it("checks contact details and the licence number", () => {
    const expectations = buildExpectations(factsFixture());
    const byCategory = (c: string) => expectations.filter((e) => e.category === c).map((e) => e.value);

    expect(byCategory("contact")).toContain("jobs@alyousufent.com");
    expect(byCategory("contact")).toContain("+91 86559 60415");
    expect(byCategory("registration")).toContain("B-0655/MUM/PER/1000+");
  });

  it("counts one phone used for both call and WhatsApp only once", () => {
    // Rendered as a single string; expecting it twice would fail an
    // advertisement that is actually correct.
    const phones = buildExpectations(factsFixture()).filter(
      (e) => e.category === "contact" && e.value === "+91 86559 60415",
    );
    expect(phones).toHaveLength(1);
  });

  it("skips absent optional facts rather than demanding them", () => {
    const expectations = buildExpectations(
      factsFixture({ raLicenseId: null, benefits: [], contact: { email: "jobs@alyousufent.com" } }),
    );
    expect(expectations.some((e) => e.category === "registration")).toBe(false);
    expect(expectations.some((e) => e.category === "benefit")).toBe(false);
    expect(expectations.filter((e) => e.category === "contact")).toHaveLength(1);
  });

  it("ignores values too short to verify against a transcription", () => {
    const expectations = buildExpectations(factsFixture({ country: "UK", agencyName: "AB" }));
    expect(expectations.some((e) => e.value === "AB")).toBe(false);
  });
});

describe("Vision QA — rejection", () => {
  it("never exposes provider or model detail to the agency user", () => {
    const error = new VisionQaRejectedError({
      passed: false,
      checked: 7,
      missing: [{ category: "position", value: "Bolt Technician" }],
      readBack: "…",
      model: "gemini-3.5-flash-lite",
      latencyMs: 900,
    });

    expect(error.message).not.toMatch(/gemini|openai|model/i);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("VISION_QA_REJECTED");
  });

  it("records which facts were missing in operator detail, for diagnosis", () => {
    const error = new VisionQaRejectedError({
      passed: false,
      checked: 7,
      missing: [{ category: "position", value: "Bolt Technician" }],
      readBack: "…",
      model: "gemini-3.5-flash-lite",
      latencyMs: 900,
    });

    expect(error.operatorDetail).toContain("Bolt Technician");
    expect(error.operatorDetail).toContain("1 of 7");
  });
});
