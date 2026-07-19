import { describe, expect, it } from "vitest";
import { extractionResultToFormValues } from "@/lib/extraction-to-form";
import { emptyExtractionResult, type ExtractionResult } from "@/server/ai/extraction-result.schema";

/**
 * Sprint 006 Bug 004: a successful AI extraction never reached the Review
 * form — reviewedData stayed empty regardless of what the AI actually
 * extracted. These tests cover the mapping that fixes it.
 */

const HALLIBURTON: ExtractionResult = {
  ...emptyExtractionResult("CLIENT: Halliburton Saudi Arabia..."),
  country: { value: "Saudi Arabia", confidence: "HIGH" },
  industry: { value: "Oil & Gas", confidence: "HIGH" },
  projectType: { value: "Oil & Gas Field Services", confidence: "HIGH" },
  employer: { value: "Halliburton", confidence: "HIGH" },
  positions: [
    {
      title: "Sperry Drilling Services",
      tradeSummary: "Drilling services technician for oilfield operations.",
      quantity: { value: 16, confidence: "HIGH" },
      salaryAmount: { value: null, confidence: "LOW" },
      salaryCurrency: { value: null, confidence: "LOW" },
      experience: { value: null, confidence: "LOW" },
      qualification: { value: null, confidence: "LOW" },
      ageLimit: { value: null, confidence: "LOW" },
      possibleDuplicateOfIndex: null,
    },
    {
      title: "Wireline & Perforating",
      tradeSummary: "Wireline operations technician.",
      quantity: { value: 18, confidence: "HIGH" },
      salaryAmount: { value: null, confidence: "LOW" },
      salaryCurrency: { value: null, confidence: "LOW" },
      experience: { value: null, confidence: "LOW" },
      qualification: { value: null, confidence: "LOW" },
      ageLimit: { value: null, confidence: "LOW" },
      possibleDuplicateOfIndex: null,
    },
  ],
  benefits: {
    value: ["Free Accommodation", "Medical Insurance", "Transportation", "Annual Leave"],
    confidence: "HIGH",
  },
  interviewDate: { value: null, confidence: "LOW" },
  interviewVenue: { value: null, confidence: "LOW" },
  interviewMode: { value: null, confidence: "LOW" },
  contact: {
    value: { name: null, phone: null, email: "jobs@alyousufent.com", whatsapp: null },
    confidence: "MEDIUM",
  },
  overallConfidence: "HIGH",
};

describe("extractionResultToFormValues — the missing Review-screen wiring", () => {
  it("populates header/industry/country/employer from the extraction, never leaves them blank when grounded", () => {
    const values = extractionResultToFormValues(HALLIBURTON);
    expect(values.industry).toBe("Oil & Gas");
    expect(values.country).toBe("Saudi Arabia");
    expect(values.employer).toBe("Halliburton");
    expect(values.header).toBe("Halliburton — Saudi Arabia");
  });

  it("maps every extracted position with its quantity, not just the first", () => {
    const values = extractionResultToFormValues(HALLIBURTON);
    expect(values.positions).toHaveLength(2);
    expect(values.positions?.[0]).toMatchObject({ title: "Sperry Drilling Services", count: 16 });
    expect(values.positions?.[1]).toMatchObject({ title: "Wireline & Perforating", count: 18 });
  });

  it("maps every extracted benefit", () => {
    const values = extractionResultToFormValues(HALLIBURTON);
    expect(values.benefits).toEqual([
      { label: "Free Accommodation" },
      { label: "Medical Insurance" },
      { label: "Transportation" },
      { label: "Annual Leave" },
    ]);
  });

  it("maps grounded contact details without inventing missing ones", () => {
    const values = extractionResultToFormValues(HALLIBURTON);
    expect(values.contact?.email).toBe("jobs@alyousufent.com");
    expect(values.contact?.phone).toBeUndefined();
  });

  it("never fabricates a value the extraction didn't provide — empty extraction maps to empty/omitted fields, not placeholders", () => {
    const empty = emptyExtractionResult("no useful content");
    const values = extractionResultToFormValues(empty);
    expect(values.industry).toBe("");
    expect(values.country).toBe("");
    expect(values.employer).toBe("");
    expect(values.header).toBe("");
    expect(values.positions).toBeUndefined();
    expect(values.benefits).toBeUndefined();
    expect(values.contact).toBeUndefined();
  });

  it("derives a plain, factual header when only industry+country are known (no employer)", () => {
    const values = extractionResultToFormValues({
      ...emptyExtractionResult(""),
      country: { value: "UAE", confidence: "HIGH" },
      industry: { value: "Construction", confidence: "MEDIUM" },
    });
    expect(values.header).toBe("Construction — UAE");
  });
});
