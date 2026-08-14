import { z } from "zod";

/**
 * KAI Visual QA — final commercial publication gate.
 *
 * Gemini:
 *   complete advertisement composition
 *
 * KAI:
 *   trusted agency identity / verification when supplied
 *
 * QA:
 *   judges the actual finished raster
 *
 * The model's verdict is informational.
 * The numeric threshold below is authoritative.
 */
export const VISUAL_QA_PASS_THRESHOLD =
  85;

const score =
  z.number().min(0).max(100);

export const visualQaCorrectionTypeSchema =
  z.enum([
    /**
     * The generated visual itself is weak,
     * irrelevant or fundamentally unsuitable.
     *
     * This is the only correction type that
     * legitimately spends another image-generation call.
     */
    "REGENERATE_IMAGE",

    /**
     * Candidate-facing hierarchy is weak.
     */
    "INCREASE_HEADLINE_EMPHASIS",

    /**
     * Collision, crowding, awkward spacing
     * or poor information organization.
     */
    "IMPROVE_SPACING",

    /**
     * Genuine candidate CTA/contact exists
     * but is visually weak.
     */
    "IMPROVE_CTA",

    /**
     * Readability/contrast problem.
     */
    "IMPROVE_CONTRAST",

    /**
     * Other non-catastrophic defect.
     */
    "OTHER",
  ]);

export const visualQaResultSchema =
  z.object({
    overallScore: score,

    commercialQualityScore:
      score,

    hierarchyScore:
      score,

    readabilityScore:
      score,

    imageryScore:
      score,

    canvasUtilizationScore:
      score,

    ctaScore:
      score,

    trustScore:
      score,

    defects:
      z.array(
        z.string(),
      ),

    /**
     * A non-empty catastrophicDefects list blocks publication.
     *
     * IMPORTANT:
     * A catastrophic defect must represent a genuine
     * publication-blocking failure.
     *
     * Missing OPTIONAL SOURCE DATA is not catastrophic.
     * Missing optional CTA data is not catastrophic.
     * Missing optional benefit/interview data is not catastrophic.
     * Small incidental text inside an industrial scene is not catastrophic.
     *
     * Examples that ARE catastrophic:
     *
     * - primary headline clipped
     * - major text collision
     * - unusable composition
     * - fundamentally wrong industry imagery
     * - prominent fabricated recruitment facts
     * - fake agency identity
     * - fake QR / verification claim
     * - severe unreadability of critical content
     */
    catastrophicDefects:
      z.array(
        z.string(),
      ),

    requiredCorrections:
      z.array(
        z.object({
          type:
            visualQaCorrectionTypeSchema,

          note:
            z.string(),
        }),
      ),

    verdict:
      z.enum([
        "PASS",
        "REGENERATE",
        "BLOCKED",
      ]),
  });

export type VisualQaCorrectionType =
  z.infer<
    typeof visualQaCorrectionTypeSchema
  >;

export type VisualQaResult =
  z.infer<
    typeof visualQaResultSchema
  >;

export interface VisualQaInput {
  /**
   * Exact final rasterized advertisement.
   */
  imagePngBase64: string;

  /**
   * Creative archetype used by the pipeline.
   */
  archetype: string;

  /**
   * Publication format.
   */
  platformFormatKey: string;

  widthPx: number;

  heightPx: number;
}

export interface VisualQaProvider {
  readonly name: string;

  evaluate(
    input: VisualQaInput,
  ): Promise<VisualQaResult>;
}
