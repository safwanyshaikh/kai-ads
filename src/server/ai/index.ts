import type {
  CompositeExtractionProvider,
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
import { KaiOpenAiExtractionProvider } from "./openai/kai-extraction-provider";
import { getIntegrationStatus } from "@/lib/env";

export * from "./types";
export * from "./extraction-providers.interface";

/**
 * The complete AI Extraction toolkit for one extraction pass. All seven
 * interface slots are always filled by the SAME underlying instance when
 * OpenAI is configured (KaiOpenAiExtractionProvider implements all
 * seven) so that calling several of them for one input triggers exactly
 * one real API call — see KaiOpenAiExtractionProvider's internal cache.
 */
export interface AiExtractionToolkit {
  requirementExtraction: RequirementExtractionProvider;
  tradeSummary: TradeSummaryProvider;
  industryDetection: IndustryDetectionProvider;
  countryDetection: CountryDetectionProvider;
  employerDetection: EmployerDetectionProvider;
  salaryDetection: SalaryDetectionProvider;
  interviewDetection: InterviewDetectionProvider;
  /** Optional 8th capability — see extraction-providers.interface.ts. Present only when a provider offers it. */
  composite?: CompositeExtractionProvider;
}

let cachedToolkit: AiExtractionToolkit | null = null;

/**
 * Sprint 003: when OPENAI_API_KEY is set, every slot is filled by one
 * KaiOpenAiExtractionProvider instance (a real implementation — see
 * src/server/ai/openai/). When it isn't set, every slot falls back to
 * the Sprint 002 NotImplemented stand-ins, so the app keeps working
 * (advertisement-draft.service.ts's EXTRACTION_FAILED -> manual-entry
 * path is unchanged and still fully tested) without AI configured.
 *
 * This is the single seam: a second real provider later (e.g. a
 * different model vendor) is a second branch here, no call-site changes.
 */
export function getAiExtractionToolkit(): AiExtractionToolkit {
  if (cachedToolkit) return cachedToolkit;

  if (getIntegrationStatus().openai) {
    const openai = new KaiOpenAiExtractionProvider();
    cachedToolkit = {
      requirementExtraction: openai,
      tradeSummary: openai,
      industryDetection: openai,
      countryDetection: openai,
      employerDetection: openai,
      salaryDetection: openai,
      interviewDetection: openai,
      composite: openai,
    };
    return cachedToolkit;
  }

  cachedToolkit = {
    requirementExtraction: new NotImplementedRequirementExtractionProvider(),
    tradeSummary: new NotImplementedTradeSummaryProvider(),
    industryDetection: new NotImplementedIndustryDetectionProvider(),
    countryDetection: new NotImplementedCountryDetectionProvider(),
    employerDetection: new NotImplementedEmployerDetectionProvider(),
    salaryDetection: new NotImplementedSalaryDetectionProvider(),
    interviewDetection: new NotImplementedInterviewDetectionProvider(),
  };
  return cachedToolkit;
}
