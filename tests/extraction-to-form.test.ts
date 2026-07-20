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
      salaryTiers: [],
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
      salaryTiers: [],
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

  it("does not repeat the country when the employer name already contains it", () => {
    const values = extractionResultToFormValues({
      ...emptyExtractionResult(""),
      employer: { value: "Halliburton Saudi Arabia", confidence: "HIGH" },
      country: { value: "Saudi Arabia", confidence: "HIGH" },
      industry: { value: "Oil & Gas", confidence: "HIGH" },
    });
    expect(values.header).toBe("Halliburton Saudi Arabia");
  });
});

/**
 * Sprint 007 Bug: a graduated pay scale (one position, several
 * experience-based salary bands) has no single number to map to —
 * previously the extraction step split it into duplicate position
 * entries (the same title repeated once per band, headcount duplicated
 * on each) with no salary ever reaching the advertisement at all.
 * formatPositionSalary (exercised here via extractionResultToFormValues)
 * folds every band into one grounded, source-verbatim display string on
 * the single position entry instead.
 */
describe("extractionResultToFormValues — graduated pay scale (Sprint 007 Bug)", () => {
  it("formats a tiered salary scale onto ONE position entry, not one entry per band", () => {
    const extraction: ExtractionResult = {
      ...emptyExtractionResult(""),
      country: { value: "Saudi Arabia", confidence: "HIGH" },
      positions: [
        {
          title: "RCM Instrument Engineer",
          tradeSummary: "Reliability-centered maintenance instrument engineering.",
          quantity: { value: 2, confidence: "HIGH" },
          salaryAmount: { value: null, confidence: "LOW" },
          salaryCurrency: { value: null, confidence: "LOW" },
          experience: { value: null, confidence: "LOW" },
          qualification: { value: null, confidence: "LOW" },
          ageLimit: { value: null, confidence: "LOW" },
          salaryTiers: [
            { experience: "8 yrs to < 9 yrs", salary: "SAR 10,000" },
            { experience: "9 yrs to < 10 yrs", salary: "SAR 11,000" },
            { experience: "10 yrs to < 11 yrs", salary: "SAR 12,000" },
            { experience: "11 yrs & above", salary: "SAR 13,000" },
          ],
          possibleDuplicateOfIndex: null,
        },
      ],
    };

    const values = extractionResultToFormValues(extraction);
    expect(values.positions).toHaveLength(1);
    expect(values.positions?.[0].count).toBe(2);
    expect(values.positions?.[0].salary).toBe(
      "8 yrs to < 9 yrs: SAR 10,000 · 9 yrs to < 10 yrs: SAR 11,000 · 10 yrs to < 11 yrs: SAR 12,000 · 11 yrs & above: SAR 13,000",
    );
  });

  it("formats a flat salaryAmount+currency when there is no tiered scale", () => {
    const extraction: ExtractionResult = {
      ...emptyExtractionResult(""),
      positions: [
        {
          title: "Welder",
          tradeSummary: "Structural welding for oil and gas fabrication.",
          quantity: { value: 5, confidence: "HIGH" },
          salaryAmount: { value: 2500, confidence: "HIGH" },
          salaryCurrency: { value: "SAR", confidence: "HIGH" },
          experience: { value: null, confidence: "LOW" },
          qualification: { value: null, confidence: "LOW" },
          ageLimit: { value: null, confidence: "LOW" },
          salaryTiers: [],
          possibleDuplicateOfIndex: null,
        },
      ],
    };

    const values = extractionResultToFormValues(extraction);
    expect(values.positions?.[0].salary).toBe("SAR 2,500");
  });

  it("leaves salary undefined, never fabricated, when neither a flat salary nor a tiered scale is present", () => {
    const extraction: ExtractionResult = {
      ...emptyExtractionResult(""),
      positions: [
        {
          title: "Rigger",
          tradeSummary: "Rigging and lifting operations for construction sites.",
          quantity: { value: 3, confidence: "HIGH" },
          salaryAmount: { value: null, confidence: "LOW" },
          salaryCurrency: { value: null, confidence: "LOW" },
          experience: { value: null, confidence: "LOW" },
          qualification: { value: null, confidence: "LOW" },
          ageLimit: { value: null, confidence: "LOW" },
          salaryTiers: [],
          possibleDuplicateOfIndex: null,
        },
      ],
    };

    const values = extractionResultToFormValues(extraction);
    expect(values.positions?.[0].salary).toBeUndefined();
  });
});
