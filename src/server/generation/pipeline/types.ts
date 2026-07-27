import type { InterviewEvent } from "../interview-events";

/**
 * The complete, source-grounded factual payload of an advertisement.
 * Every value here must trace back to the Advertisement record, whose
 * fields were extracted by the KAI Extraction Engine under
 * enforceSourceGrounding() (src/server/ai/openai/kai-extraction-engine.ts).
 * No downstream stage may add, infer, or embellish a fact: if a field is
 * absent here, it does not exist for this advertisement.
 */
export interface AdvertisementFacts {
  header: string;
  industry: string;
  country: string;
  employer?: string | null;
  positions: { title: string; count?: number; experience?: string; salary?: string | null }[];
  benefits: { label: string; detail?: string }[];
  interview: InterviewEvent[];
  contact: { name?: string; phone?: string; email?: string; whatsapp?: string };
  footer?: string | null;
  agencyName: string;
  /** Compact core RC number for constrained visual areas (badge). */
  raLicenseId?: string | null;
  /** Full official registration string, printed verbatim in small print/footer. */
  fullRegistrationNumber?: string | null;
}
