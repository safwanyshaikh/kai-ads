import type {
  AiExtractionToolkit,
} from "@/server/ai";
import type { AiExtractionInput, AiExtractionResult } from "@/server/ai/types";
import type {
  ExtractedInterview,
  ExtractedPosition,
  ExtractedSalary,
} from "@/server/ai/extraction-providers.interface";
import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import { AiProviderNotImplementedError } from "@/server/ai/types";

/**
 * A deterministic, DI-friendly stand-in for the real OpenAI-backed
 * toolkit — "Do not require a live OpenAI API key for normal automated
 * tests. Use dependency injection and deterministic test providers."
 * This never touches the `openai` package or the network; it implements
 * exactly the same interfaces the real provider does, so any code that
 * accepts a toolkit override (advertisement-draft.service.ts's
 * runExtraction) is genuinely exercised, not mocked at the function-call
 * level.
 */
export function buildFakeExtractionResult(
  overrides: Partial<ExtractionResult> = {},
): ExtractionResult {
  const high = (value: string) => ({ value, confidence: "HIGH" as const });
  return {
    country: high("United Arab Emirates"),
    industry: high("Construction"),
    projectType: high("Infrastructure"),
    employer: { value: null, confidence: "LOW" },
    positions: [
      {
        title: "6G Welder",
        tradeSummary: "Perform high-quality pipe welding for oil and gas projects.",
        quantity: { value: 10, confidence: "HIGH" },
        salaryAmount: { value: 1800, confidence: "MEDIUM" },
        salaryCurrency: { value: "AED", confidence: "MEDIUM" },
        experience: { value: "5 years", confidence: "HIGH" },
        qualification: { value: "ITI Welding", confidence: "MEDIUM" },
        ageLimit: { value: "up to 45", confidence: "MEDIUM" },
        possibleDuplicateOfIndex: null,
      },
      {
        title: "Pipe Fitter",
        tradeSummary: "Install and assemble industrial piping systems from isometric drawings.",
        quantity: { value: 5, confidence: "HIGH" },
        salaryAmount: { value: null, confidence: "LOW" },
        salaryCurrency: { value: null, confidence: "LOW" },
        experience: { value: "3 years", confidence: "MEDIUM" },
        qualification: { value: null, confidence: "LOW" },
        ageLimit: { value: null, confidence: "LOW" },
        possibleDuplicateOfIndex: null,
      },
    ],
    benefits: { value: ["Free accommodation", "Annual leave ticket"], confidence: "MEDIUM" },
    interviewMode: { value: null, confidence: "LOW" },
    interviewDate: { value: null, confidence: "LOW" },
    interviewTime: { value: null, confidence: "LOW" },
    interviewVenue: { value: null, confidence: "LOW" },
    contact: { value: null, confidence: "LOW" },
    originalSourceText: "Need 10 6G welders and 5 pipe fitters for a UAE construction project.",
    overallConfidence: "MEDIUM",
    warnings: [],
    ...overrides,
  };
}

/** A toolkit that always succeeds with a fixed, realistic extraction result. */
export function buildFakeSuccessToolkit(
  overrides: Partial<ExtractionResult> = {},
): AiExtractionToolkit {
  const canned = buildFakeExtractionResult(overrides);

  const composite = {
    name: "fake-success",
    async extractAll(_input: AiExtractionInput) {
      return {
        result: { found: true, value: canned } as AiExtractionResult<ExtractionResult>,
        usage: { inputTokens: 120, outputTokens: 340, latencyMs: 42, model: "fake-model" },
      };
    },
  };

  return {
    requirementExtraction: {
      name: "fake-success",
      async extractRequirements(): Promise<AiExtractionResult<ExtractedPosition[]>> {
        return {
          found: canned.positions.length > 0,
          value: canned.positions.map((p) => ({
            title: p.title,
            count: p.quantity.value ?? undefined,
            experience: p.experience.value ?? undefined,
          })),
        };
      },
    },
    tradeSummary: {
      name: "fake-success",
      async summarizeTrade(): Promise<AiExtractionResult<string>> {
        const summaries = canned.positions.map((p) => p.tradeSummary);
        return { found: summaries.length > 0, value: summaries.join(" ") };
      },
    },
    industryDetection: {
      name: "fake-success",
      async detectIndustry(): Promise<AiExtractionResult<string>> {
        return { found: canned.industry.value !== null, value: canned.industry.value };
      },
    },
    countryDetection: {
      name: "fake-success",
      async detectCountry(): Promise<AiExtractionResult<string>> {
        return { found: canned.country.value !== null, value: canned.country.value };
      },
    },
    employerDetection: {
      name: "fake-success",
      async detectEmployer(): Promise<AiExtractionResult<string>> {
        return { found: canned.employer.value !== null, value: canned.employer.value };
      },
    },
    salaryDetection: {
      name: "fake-success",
      async detectSalary(): Promise<AiExtractionResult<ExtractedSalary[]>> {
        const salaries = canned.positions
          .filter((p) => p.salaryAmount.value !== null)
          .map((p) => ({ amount: p.salaryAmount.value ?? undefined, currency: p.salaryCurrency.value ?? undefined, raw: p.title }));
        return { found: salaries.length > 0, value: salaries.length > 0 ? salaries : null };
      },
    },
    interviewDetection: {
      name: "fake-success",
      async detectInterview(): Promise<AiExtractionResult<ExtractedInterview>> {
        return { found: false, value: null };
      },
    },
    composite,
  };
}

/** A toolkit where every method throws, exactly like the Sprint 002 NotImplemented stand-ins. */
export function buildFakeUnimplementedToolkit(): AiExtractionToolkit {
  const throwNotImplemented = (name: string) => {
    throw new AiProviderNotImplementedError(name);
  };
  return {
    requirementExtraction: { name: "fake-unimplemented", extractRequirements: async () => throwNotImplemented("RequirementExtractionProvider") },
    tradeSummary: { name: "fake-unimplemented", summarizeTrade: async () => throwNotImplemented("TradeSummaryProvider") },
    industryDetection: { name: "fake-unimplemented", detectIndustry: async () => throwNotImplemented("IndustryDetectionProvider") },
    countryDetection: { name: "fake-unimplemented", detectCountry: async () => throwNotImplemented("CountryDetectionProvider") },
    employerDetection: { name: "fake-unimplemented", detectEmployer: async () => throwNotImplemented("EmployerDetectionProvider") },
    salaryDetection: { name: "fake-unimplemented", detectSalary: async () => throwNotImplemented("SalaryDetectionProvider") },
    interviewDetection: { name: "fake-unimplemented", detectInterview: async () => throwNotImplemented("InterviewDetectionProvider") },
  };
}
