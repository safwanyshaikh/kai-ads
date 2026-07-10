import type { AiExtractionInput, AiExtractionResult } from "./types";

/**
 * Requirement Extraction Interface
 * Extracts the structured position/requirement list from raw input —
 * the primary, composite extraction step (Screen: "AI Extraction Review").
 */
export interface ExtractedPosition {
  title: string;
  count?: number;
  experience?: string;
  ageRange?: string;
  language?: string;
  qualifications?: string[];
}

export interface RequirementExtractionProvider {
  readonly name: string;
  extractRequirements(
    input: AiExtractionInput,
  ): Promise<AiExtractionResult<ExtractedPosition[]>>;
}

/**
 * Trade Summary Interface
 * Produces a short, human-readable summary of the trade/role context —
 * used as a starting point for the advertisement's header/summary copy.
 */
export interface TradeSummaryProvider {
  readonly name: string;
  summarizeTrade(input: AiExtractionInput): Promise<AiExtractionResult<string>>;
}

/**
 * Industry Detection Interface
 */
export interface IndustryDetectionProvider {
  readonly name: string;
  detectIndustry(input: AiExtractionInput): Promise<AiExtractionResult<string>>;
}

/**
 * Country Detection Interface
 * Detects the destination country for the recruitment.
 */
export interface CountryDetectionProvider {
  readonly name: string;
  detectCountry(input: AiExtractionInput): Promise<AiExtractionResult<string>>;
}

/**
 * Employer Detection Interface
 * Employer is optional in the Advertisement Schema — a provider
 * legitimately returns `found: false` when no employer is named, which
 * is expected and not an error.
 */
export interface EmployerDetectionProvider {
  readonly name: string;
  detectEmployer(input: AiExtractionInput): Promise<AiExtractionResult<string>>;
}

/**
 * Salary Detection Interface
 * Per the Product Constitution's AI Limitations: "AI must never invent
 * Salary" — a real implementation must only report salary it actually
 * found in the source text, never infer or estimate one.
 */
export interface ExtractedSalary {
  amount?: number;
  currency?: string;
  period?: "monthly" | "yearly" | "daily" | "hourly";
  raw: string; // the exact source phrase, for auditability
}

export interface SalaryDetectionProvider {
  readonly name: string;
  detectSalary(input: AiExtractionInput): Promise<AiExtractionResult<ExtractedSalary[]>>;
}

/**
 * Interview Detection Interface
 */
export interface ExtractedInterview {
  date?: string;
  location?: string;
  mode?: "in_person" | "video" | "phone";
  raw: string;
}

export interface InterviewDetectionProvider {
  readonly name: string;
  detectInterview(
    input: AiExtractionInput,
  ): Promise<AiExtractionResult<ExtractedInterview>>;
}
