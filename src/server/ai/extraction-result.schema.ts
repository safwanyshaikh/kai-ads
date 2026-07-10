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

export const extractedPositionSchema = z.object({
  title: z.string(),
  /** Trade Summary Rule: exactly one technically-precise sentence, never a copied job description. */
  tradeSummary: z.string(),
  quantity: confidentField(z.number().int().positive()),
  salaryAmount: confidentField(z.number().positive()),
  salaryCurrency: confidentField(z.string()),
  experience: confidentField(z.string()),
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
    contact: { value: null, confidence: "LOW" },
    originalSourceText: sourceText,
    overallConfidence: "LOW",
    warnings: [],
  };
}
