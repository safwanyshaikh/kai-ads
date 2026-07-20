import { describe, expect, it } from "vitest";
import {
  extractionResultSchema,
  extractedPositionSchema,
  confidenceSchema,
  emptyExtractionResult,
} from "@/server/ai/extraction-result.schema";

describe("confidenceSchema", () => {
  it("accepts HIGH, MEDIUM, LOW", () => {
    expect(confidenceSchema.safeParse("HIGH").success).toBe(true);
    expect(confidenceSchema.safeParse("MEDIUM").success).toBe(true);
    expect(confidenceSchema.safeParse("LOW").success).toBe(true);
  });

  it("rejects anything else", () => {
    expect(confidenceSchema.safeParse("CERTAIN").success).toBe(false);
  });
});

describe("extractedPositionSchema — Position Intelligence", () => {
  const basePosition = {
    title: "6G Welder",
    tradeSummary: "Perform high-quality pipe welding for oil and gas projects.",
    quantity: { value: 10, confidence: "HIGH" },
    salaryAmount: { value: null, confidence: "LOW" },
    salaryCurrency: { value: null, confidence: "LOW" },
    experience: { value: null, confidence: "LOW" },
    qualification: { value: null, confidence: "LOW" },
    ageLimit: { value: null, confidence: "LOW" },
    salaryTiers: [],
    possibleDuplicateOfIndex: null,
  };

  it("accepts a fully-specified position", () => {
    expect(extractedPositionSchema.safeParse(basePosition).success).toBe(true);
  });

  it("Optional Salary/Quantity/Experience/Qualification: null values are valid, not errors", () => {
    const result = extractedPositionSchema.safeParse(basePosition);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salaryAmount.value).toBeNull();
      expect(result.data.experience.value).toBeNull();
      expect(result.data.qualification.value).toBeNull();
    }
  });

  it("supports flagging a possible duplicate by index", () => {
    const result = extractedPositionSchema.safeParse({ ...basePosition, possibleDuplicateOfIndex: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.possibleDuplicateOfIndex).toBe(0);
  });

  it("Trade Summary Rule: tradeSummary is required text, not optional", () => {
    const result = extractedPositionSchema.safeParse({ ...basePosition, tradeSummary: undefined });
    expect(result.success).toBe(false);
  });

  // Sprint 007 Bug: a graduated pay scale (the same position paying a
  // different salary at each experience band) previously had nowhere to
  // go on a single position entry, forcing the model to split it into
  // duplicate position entries with the full headcount repeated on each
  // — salaryTiers gives it a real home on ONE entry instead.
  it("accepts a graduated pay scale as salaryTiers on a single position", () => {
    const result = extractedPositionSchema.safeParse({
      ...basePosition,
      salaryTiers: [
        { experience: "8 yrs to < 9 yrs", salary: "SAR 10,000" },
        { experience: "9 yrs to < 10 yrs", salary: "SAR 11,000" },
        { experience: "10 yrs to < 11 yrs", salary: "SAR 12,000" },
        { experience: "11 yrs & above", salary: "SAR 13,000" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.salaryTiers).toHaveLength(4);
  });

  it("defaults to an empty salaryTiers array for a flat, untiered salary", () => {
    const result = extractedPositionSchema.safeParse(basePosition);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.salaryTiers).toEqual([]);
  });
});

describe("extractionResultSchema — Multiple Positions", () => {
  it("preserves every position in a large list (20-30 positions) without dropping any", () => {
    const positions = Array.from({ length: 25 }, (_, i) => ({
      title: `Trade ${i}`,
      tradeSummary: `Perform trade ${i} duties.`,
      quantity: { value: i + 1, confidence: "HIGH" as const },
      salaryAmount: { value: null, confidence: "LOW" as const },
      salaryCurrency: { value: null, confidence: "LOW" as const },
      experience: { value: null, confidence: "LOW" as const },
      qualification: { value: null, confidence: "LOW" as const },
      ageLimit: { value: null, confidence: "LOW" as const },
      salaryTiers: [],
      possibleDuplicateOfIndex: null,
    }));

    const result = extractionResultSchema.safeParse({
      country: { value: "UAE", confidence: "HIGH" },
      industry: { value: "Construction", confidence: "HIGH" },
      projectType: { value: null, confidence: "LOW" },
      employer: { value: null, confidence: "LOW" },
      positions,
      benefits: { value: null, confidence: "LOW" },
      interviewMode: { value: null, confidence: "LOW" },
      interviewDate: { value: null, confidence: "LOW" },
      interviewTime: { value: null, confidence: "LOW" },
      interviewVenue: { value: null, confidence: "LOW" },
      interviewEvents: [],
      contact: { value: null, confidence: "LOW" },
      originalSourceText: "25 trades needed",
      overallConfidence: "HIGH",
      warnings: [],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.positions).toHaveLength(25);
  });

  it("Recruiter Reality Rules: employer, salary, interview, benefits can all be simultaneously absent without failing validation", () => {
    const result = extractionResultSchema.safeParse({
      country: { value: "UAE", confidence: "HIGH" },
      industry: { value: "Construction", confidence: "HIGH" },
      projectType: { value: null, confidence: "LOW" },
      employer: { value: null, confidence: "LOW" },
      positions: [],
      benefits: { value: null, confidence: "LOW" },
      interviewMode: { value: null, confidence: "LOW" },
      interviewDate: { value: null, confidence: "LOW" },
      interviewTime: { value: null, confidence: "LOW" },
      interviewVenue: { value: null, confidence: "LOW" },
      interviewEvents: [],
      contact: { value: null, confidence: "LOW" },
      originalSourceText: "minimal requirement",
      overallConfidence: "LOW",
      warnings: [],
    });
    expect(result.success).toBe(true);
  });

  it("No Hallucination: contact must be null, not a fabricated object, when absent", () => {
    const result = extractionResultSchema.parse({
      country: { value: null, confidence: "LOW" },
      industry: { value: null, confidence: "LOW" },
      projectType: { value: null, confidence: "LOW" },
      employer: { value: null, confidence: "LOW" },
      positions: [],
      benefits: { value: null, confidence: "LOW" },
      interviewMode: { value: null, confidence: "LOW" },
      interviewDate: { value: null, confidence: "LOW" },
      interviewTime: { value: null, confidence: "LOW" },
      interviewVenue: { value: null, confidence: "LOW" },
      interviewEvents: [],
      contact: { value: null, confidence: "LOW" },
      originalSourceText: "no contact info given",
      overallConfidence: "LOW",
      warnings: [],
    });
    expect(result.contact.value).toBeNull();
  });
});

describe("emptyExtractionResult — No Hallucination fallback", () => {
  it("every optional field is null, never a placeholder string", () => {
    const result = emptyExtractionResult("some source text");
    expect(result.country.value).toBeNull();
    expect(result.industry.value).toBeNull();
    expect(result.employer.value).toBeNull();
    expect(result.contact.value).toBeNull();
    expect(result.positions).toEqual([]);
  });

  it("preserves the original source text for the recruiter to fall back to", () => {
    const result = emptyExtractionResult("Need 5 electricians for Qatar.");
    expect(result.originalSourceText).toBe("Need 5 electricians for Qatar.");
  });

  it("passes full schema validation (it's a safe, well-typed fallback, not a shortcut)", () => {
    const result = emptyExtractionResult("text");
    expect(extractionResultSchema.safeParse(result).success).toBe(true);
  });
});
