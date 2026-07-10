import type {
  CountryDetectionProvider,
  EmployerDetectionProvider,
  IndustryDetectionProvider,
  InterviewDetectionProvider,
  RequirementExtractionProvider,
  SalaryDetectionProvider,
  TradeSummaryProvider,
} from "./extraction-providers.interface";
import {
  NotImplementedCountryDetectionProvider,
  NotImplementedEmployerDetectionProvider,
  NotImplementedIndustryDetectionProvider,
  NotImplementedInterviewDetectionProvider,
  NotImplementedRequirementExtractionProvider,
  NotImplementedSalaryDetectionProvider,
  NotImplementedTradeSummaryProvider,
} from "./not-implemented-providers";

export * from "./types";
export * from "./extraction-providers.interface";

/**
 * The complete AI Extraction toolkit for one extraction pass.
 * A future sprint's factory function would branch on an env var
 * (e.g. AI_PROVIDER=openai) exactly like getEmailProvider() /
 * getStorageProvider() and return real implementations here — every
 * call site (advertisement-draft.service.ts) is already written against
 * this interface and would need zero changes.
 */
interface AiExtractionToolkit {
  requirementExtraction: RequirementExtractionProvider;
  tradeSummary: TradeSummaryProvider;
  industryDetection: IndustryDetectionProvider;
  countryDetection: CountryDetectionProvider;
  employerDetection: EmployerDetectionProvider;
  salaryDetection: SalaryDetectionProvider;
  interviewDetection: InterviewDetectionProvider;
}

let cachedToolkit: AiExtractionToolkit | null = null;

/** Sprint 002: always returns the not-implemented stand-ins. See ai/README notes in types.ts. */
export function getAiExtractionToolkit(): AiExtractionToolkit {
  if (!cachedToolkit) {
    cachedToolkit = {
      requirementExtraction: new NotImplementedRequirementExtractionProvider(),
      tradeSummary: new NotImplementedTradeSummaryProvider(),
      industryDetection: new NotImplementedIndustryDetectionProvider(),
      countryDetection: new NotImplementedCountryDetectionProvider(),
      employerDetection: new NotImplementedEmployerDetectionProvider(),
      salaryDetection: new NotImplementedSalaryDetectionProvider(),
      interviewDetection: new NotImplementedInterviewDetectionProvider(),
    };
  }
  return cachedToolkit;
}
