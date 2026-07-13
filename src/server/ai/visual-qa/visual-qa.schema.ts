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
  /** Anything else — recorded for the report, applied as no structural change. */
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
  defects: z.array(z.string()),
  /**
   * Catastrophic defects — a NON-EMPTY list here prevents PASS regardless
   * of overallScore (enforced in code by the acceptance loop, not by the
   * model's verdict): unreadable/clipped/overlapping content, apparent
   * fabricated branding or signage inside imagery, generated gibberish
   * text damaging the advertisement, severe canvas misuse, or missing
   * agency/verification identity.
   */
  catastrophicDefects: z.array(z.string()),
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

export interface VisualQaInput {
  /** The final rasterized advertisement, exactly as it would be exported. */
  imagePngBase64: string;
  archetype: string;
  platformFormatKey: string;
  widthPx: number;
  heightPx: number;
}

export interface VisualQaProvider {
  readonly name: string;
  evaluate(input: VisualQaInput): Promise<VisualQaResult>;
}
