import { describe, it, expect } from "vitest";
import {
  buildDocumentExpectations,
  buildExpectations,
  VisionQaRejectedError,
} from "@/server/generation/pipeline/vision-qa";
import { buildAdvertisementDocument } from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
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

describe("Vision QA verifies the Advertisement JSON, not a copy of it", () => {
  it("checks the agency identity the renderer actually drew from", () => {
    const facts: AdvertisementFacts = {
      header: "Urgent Requirement — Saudi Arabia",
      industry: "Oil & Gas",
      country: "Saudi Arabia",
      positions: [{ title: "TIG Welder 6G", salary: "SAR 2,500" }],
      benefits: [{ label: "Free Food" }],
      interview: [],
      contact: {},
      // Deliberately stale: the advertisement record carries an old name.
      agencyName: "Old Trading Name",
    };
    const document = buildAdvertisementDocument({
      advertisementId: "ad-1",
      facts,
      agency: buildAgencyDna({
        id: "agency-1",
        name: "Al Yousuf Enterprises LLP",
        registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
        phone: "+91 86559 60415",
      }),
      format: { key: "KAI-SQ", widthPx: 1080, heightPx: 1080, dpi: null, printOrNewspaper: false },
    });

    const values = buildDocumentExpectations(document).map((e) => e.value);
    // The trust strip prints the VERIFIED profile, so that is what must be
    // read back off the pixels.
    expect(values).toContain("Al Yousuf Enterprises LLP");
    expect(values).toContain("+91 86559 60415");
    expect(values).toContain("TIG Welder 6G");
  });

  it("does not double-count a value that renders once", () => {
    const facts: AdvertisementFacts = {
      header: "Hiring",
      industry: "Construction",
      country: "Qatar",
      positions: [{ title: "Mason" }],
      benefits: [],
      interview: [],
      contact: { phone: "+91 90000 00000", whatsapp: "+91 90000 00000" },
      agencyName: "Test Agency",
    };
    const document = buildAdvertisementDocument({
      advertisementId: "ad-2",
      facts,
      agency: buildAgencyDna({ id: "a", name: "Test Agency", registrationNumber: "RC-1" }),
      format: { key: "KAI-SQ", widthPx: 1080, heightPx: 1080, dpi: null, printOrNewspaper: false },
    });
    const phones = buildDocumentExpectations(document).filter((e) => e.value === "+91 90000 00000");
    expect(phones).toHaveLength(1);
  });
});
