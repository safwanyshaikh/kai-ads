import { z } from "zod";

/**
 * KAI Intelligence Engine — structured extraction result.
 *
 * This is the ONE schema behind every extraction: it's converted to a
 * JSON Schema via `z.toJSONSchema()` and sent to OpenAI as the
 * structured-output contract, and the exact same schema validates
 * whatever comes back. There is no separate "prompt shape" and "app
 * shape" to keep in sync.
 *
 * Every optional recruitment field (Recruiter Reality Rules) is
 * genuinely optional and nullable — the model is instructed to return
 * `null`, never a placeholder, when information isn't present in the
 * source (No Hallucination rule). Every field that can be extracted
 * carries its own confidence so low-confidence fields can be flagged on
 * the Review screen without discarding them.
 */

export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Confidence = z.infer<typeof confidenceSchema>;

function confidentField<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: confidenceSchema,
  });
}

const contactValueSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
});

export const salaryTierSchema = z.object({
  /** e.g. "8 yrs to < 9 yrs" — verbatim from the source's experience band, not a duration in years. */
  experience: z.string(),
  /** e.g. "SAR 10,000" — verbatim from the source's salary-for-that-band, not just a number. */
  salary: z.string(),
});
export type SalaryTierExtraction = z.infer<typeof salaryTierSchema>;

export const extractedPositionSchema = z.object({
  title: z.string(),
  /** Trade Summary Rule: exactly one technically-precise sentence, never a copied job description. */
  tradeSummary: z.string(),
  quantity: confidentField(z.number().int().positive()),
  salaryAmount: confidentField(z.number().positive()),
  salaryCurrency: confidentField(z.string()),
  experience: confidentField(z.string()),
  /**
   * A graduated pay scale — the SAME position paying different salaries
   * at different experience bands (e.g. "8-9 yrs: SAR 10,000", "9-10 yrs:
   * SAR 11,000", ...). This is ONE position with a tiered salary table,
   * NEVER multiple position entries — see the Position Intelligence rule
   * in prompts.ts. Empty array when the source gives a single flat
   * salary (use salaryAmount/salaryCurrency instead) or no salary at all.
   */
  salaryTiers: z.array(salaryTierSchema),
  qualification: confidentField(z.string()),
  ageLimit: confidentField(z.string()),
  /**
   * Index into the positions array this one may duplicate, or null.
   * "Detect obvious duplicates. Flag possible duplicates for recruiter
   * review" — the model flags, the recruiter decides; nothing is
   * silently merged or dropped.
   */
  possibleDuplicateOfIndex: z.number().int().nonnegative().nullable(),
});
export type ExtractedPosition = z.infer<typeof extractedPositionSchema>;

/**
 * Decision 3 (Sprint 006 advertisement-foundation gap-closure): overseas
 * recruitment commonly interviews in more than one city on different
 * dates (e.g. "Baroda on 14th & 15th July, Mumbai on 18th July") — a
 * single interviewDate/interviewVenue pair cannot represent that without
 * concatenating unrelated cities and dates into one ambiguous string.
 * interviewEvents is additive: the singular interviewDate/interviewVenue/
 * interviewMode fields above are kept unchanged for the common
 * single-event case and for backward compatibility with every existing
 * caller; this array is populated only when the source genuinely
 * describes multiple distinct interview events.
 */
export const interviewEventSchema = z.object({
  date: z.string().nullable(),
  venue: z.string().nullable(),
  mode: z.enum(["in_person", "video", "phone"]).nullable(),
});
export type InterviewEventExtraction = z.infer<typeof interviewEventSchema>;

export const extractionResultSchema = z.object({
  country: confidentField(z.string()),
  industry: confidentField(z.string()),
  projectType: confidentField(z.string()),
  employer: confidentField(z.string()),
  positions: z.array(extractedPositionSchema),
  benefits: confidentField(z.array(z.string())),
  interviewMode: confidentField(z.enum(["in_person", "video", "phone"])),
  interviewDate: confidentField(z.string()),
  interviewTime: confidentField(z.string()),
  interviewVenue: confidentField(z.string()),
  /** Populated only when the source describes 2+ distinct interview events — see interviewEventSchema above. */
  interviewEvents: z.array(interviewEventSchema),
  /** Never invent — only populated when contact details are literally present in the source text. */
  contact: confidentField(contactValueSchema),
  originalSourceText: z.string(),
  /** Overall extraction confidence across the whole result, independent of per-field confidence. */
  overallConfidence: confidenceSchema,
  warnings: z.array(z.string()),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** A safe, empty result — used when extraction fails, so the caller always has a well-typed shape to fall back to. */
export function emptyExtractionResult(sourceText: string): ExtractionResult {
  const empty = { value: null, confidence: "LOW" as const };
  return {
    country: empty,
    industry: empty,
    projectType: empty,
    employer: empty,
    positions: [],
    benefits: { value: null, confidence: "LOW" },
    interviewMode: empty,
    interviewDate: empty,
    interviewTime: empty,
    interviewVenue: empty,
    interviewEvents: [],
    contact: { value: null, confidence: "LOW" },
    originalSourceText: sourceText,
    overallConfidence: "LOW",
    warnings: [],
  };
}
