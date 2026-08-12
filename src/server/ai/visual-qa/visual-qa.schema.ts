import { z } from "zod";

/**
 * BRAIN C — Visual QA Brain structured verdict.
 *
 * The vision model inspects the ACTUAL final rendered advertisement
 * image (never the SVG source, never the facts) and returns this exact
 * structure. Scores are 0-100. The verdict is derived deterministically
 * from overallScore by the acceptance loop (>= 85 passes) — the model's
 * own verdict field is recorded but the threshold decision is code, not
 * the model, so the pass bar can never drift with prompt phrasing.
 */
export const VISUAL_QA_PASS_THRESHOLD = 85;

const score = z.number().min(0).max(100);

export const visualQaCorrectionTypeSchema = z.enum([
  /** The background/decorative imagery itself is weak or irrelevant — the only correction that spends image-generation budget again. */
  "REGENERATE_IMAGE",
  /** Headline/role/country not dominant enough. */
  "INCREASE_HEADLINE_EMPHASIS",
  /** Crowding, collisions, or dead zones — layout spacing correction. */
  "IMPROVE_SPACING",
  /** Contact CTA (phone, email) undersized or imbalanced. */
  "IMPROVE_CTA",
  /** Text-over-image or text-over-background contrast insufficient. */
  "IMPROVE_CONTRAST",
  /** Anything else — recorded for the report, mapped by keyword heuristic when possible. */
  "OTHER",
]);

export const visualQaResultSchema = z.object({
  overallScore: score,
  commercialQualityScore: score,
  hierarchyScore: score,
  readabilityScore: score,
  imageryScore: score,
  canvasUtilizationScore: score,
  ctaScore: score,
  trustScore: score,
  /** PRESENTATION defects only — layout, spacing, imagery, contrast, composition. Never a factual claim. */
  defects: z.array(z.string()),
  /**
   * Catastrophic defects — a NON-EMPTY list here prevents PASS regardless
   * of overallScore (enforced in code by the acceptance loop, not by the
   * model's verdict): unreadable/clipped/overlapping content, apparent
   * fabricated branding or signage inside imagery, generated gibberish
   * text damaging the advertisement, severe canvas misuse, or missing
   * agency/verification identity. PRESENTATION only — a factual reading
   * (e.g. "this role name looks wrong") belongs in factualMismatches /
   * factualUncertain below, never here, because catastrophicDefects
   * blocks PASS on the model's own say-so and a fact call is never the
   * model's to make.
   */
  catastrophicDefects: z.array(z.string()),
  /**
   * Genuine mismatches between the canonical AdvertisementFacts supplied
   * as expectedFacts and what the deterministic text actually shows on
   * the rendered image — e.g. a rendering bug that clipped or garbled a
   * role name. This is NEVER the model's own opinion that a canonical
   * term should read differently (KAI's deterministic fact layer is the
   * sole authority for recruitment text — see docs/010 Amendment 1); it
   * is only ever a literal transcription disagreeing with the literal
   * canonical string. FACTUAL_RENDER_MISMATCH in the ticket sense.
   */
  factualMismatches: z.array(
    z.object({
      expected: z.string(),
      observed: z.string(),
      location: z.string(),
    }),
  ),
  /**
   * Text that is visually ambiguous (blur, small size, low contrast) and
   * cannot be confidently transcribed — reported here instead of guessed
   * at and instead of silently treated as a mismatch.
   * FACTUAL_TEXT_UNCERTAIN in the ticket sense.
   */
  factualUncertain: z.array(
    z.object({
      observed: z.string(),
      location: z.string(),
    }),
  ),
  requiredCorrections: z.array(
    z.object({
      type: visualQaCorrectionTypeSchema,
      note: z.string(),
    }),
  ),
  verdict: z.enum(["PASS", "REGENERATE", "BLOCKED"]),
});

export type VisualQaCorrectionType = z.infer<typeof visualQaCorrectionTypeSchema>;
export type VisualQaResult = z.infer<typeof visualQaResultSchema>;

/**
 * The canonical, source-grounded facts Visual QA is allowed to check the
 * render against. Built from the same AdvertisementFacts the deterministic
 * Rendering Engine typeset the advertisement from (docs/010 Amendment 1) —
 * never re-derived or re-interpreted, so the vision model has no room to
 * "correct" a fact it merely finds unfamiliar (e.g. "Rotating equipment
 * technician" is not a typo for "equipment technician" just because that
 * reading is more common).
 *
 * Fields the source genuinely did not supply (salary, benefits, interview,
 * contact) are represented by their *Provided flags being false, and their
 * ABSENCE must never be scored as a defect — it is a source-data condition,
 * not a generation error.
 */
export interface VisualQaExpectedFacts {
  header: string;
  /** Exact, verbatim canonical role titles — the sole authority for role-name text on the render. */
  positions: string[];
  country?: string | null;
  industry?: string | null;
  salaryProvided: boolean;
  benefitsProvided: boolean;
  interviewProvided: boolean;
  /** True only when the source supplied a phone/email/whatsapp — a missing CTA is then a source condition, not a defect. */
  contactProvided: boolean;
  agencyName: string;
  registrationNumber?: string | null;
}

/**
 * Builds the expectedFacts payload from the same AdvertisementFacts the
 * Rendering Engine already typeset from — a pure projection, no new facts
 * invented or inferred.
 */
export function buildVisualQaExpectedFacts(input: {
  header: string;
  country?: string | null;
  industry?: string | null;
  positions: { title: string }[];
  salaryProvided: boolean;
  benefits: unknown[];
  interview: unknown[];
  contact: { phone?: string; email?: string; whatsapp?: string };
  agencyName: string;
  registrationNumber?: string | null;
}): VisualQaExpectedFacts {
  return {
    header: input.header,
    positions: input.positions.map((p) => p.title),
    country: input.country ?? null,
    industry: input.industry ?? null,
    salaryProvided: input.salaryProvided,
    benefitsProvided: input.benefits.length > 0,
    interviewProvided: input.interview.length > 0,
    contactProvided: Boolean(input.contact.phone || input.contact.email || input.contact.whatsapp),
    agencyName: input.agencyName,
    registrationNumber: input.registrationNumber ?? null,
  };
}

export interface VisualQaInput {
  /** The final rasterized advertisement, exactly as it would be exported. */
  imagePngBase64: string;
  archetype: string;
  platformFormatKey: string;
  widthPx: number;
  heightPx: number;
  /**
   * The canonical source facts, supplied separately from the image so the
   * model checks the render against KAI's own authoritative text instead
   * of inferring correctness from vision/OCR alone.
   */
  expectedFacts: VisualQaExpectedFacts;
}

export interface VisualQaProvider {
  readonly name: string;
  evaluate(input: VisualQaInput): Promise<VisualQaResult>;
}
