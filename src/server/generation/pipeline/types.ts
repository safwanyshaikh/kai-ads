import type { InterviewEvent } from "../interview-events";

/**
 * Ink. Colour is the Design DNA's palette. Single-ink is what a newspaper
 * actually prints: one black plate on newsprint, tints achieved by halftone
 * screen rather than by a second colour. Greyscaling a colour render is not
 * the same thing — it turns a gold accent into a muddy mid-grey with no
 * contrast against cream.
 *
 * This is a palette substitution, not a second rendering path: the same
 * marks are drawn either way.
 */
export type AdInk = "COLOUR" | "SINGLE_INK";

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
  /** Named project/site the hiring is for, e.g. "Major Oil & Gas Project". */
  projectType?: string | null;
  /** Work-permit / visa category, when the requirement states one. */
  visaType?: string | null;
  /** e.g. "10 hours/day, 6 days/week". */
  dutyHours?: string | null;
  /** e.g. "3 months on / 1 month off". */
  rotation?: string | null;
  positions: {
    title: string;
    count?: number;
    experience?: string;
    salary?: string | null;
    /** Education/qualification requirement for this role. */
    qualification?: string | null;
    /** Required certifications/tickets, only when stated in the source. */
    certifications?: string[];
    ageLimit?: string | null;
  }[];
  benefits: { label: string; detail?: string }[];
  interview: InterviewEvent[];
  contact: { name?: string; phone?: string; email?: string; whatsapp?: string };
  /** Agency office address, printed by the Branding Engine when supplied. */
  officeAddress?: string | null;
  /** Agency website, printed by the Branding Engine when supplied. */
  website?: string | null;
  /** Verbatim legal/disclaimer text. Never generated — only ever passed through. */
  legalDisclaimer?: string | null;
  footer?: string | null;
  agencyName: string;
  /** Compact core RC number for constrained visual areas (badge). */
  raLicenseId?: string | null;
  /** Full official registration string, printed verbatim in small print/footer. */
  fullRegistrationNumber?: string | null;
}
