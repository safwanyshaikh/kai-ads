import {
  KaiVisualQaProvider,
} from "@/server/ai/visual-qa/kai-visual-qa-provider";
import {
  VISUAL_QA_PASS_THRESHOLD,
  type VisualQaResult,
} from "@/server/ai/visual-qa/visual-qa.schema";

/**
 * KAI Visual QA Gate
 *
 * The image generator creates the advertisement.
 * This gate judges the FINAL RASTERIZED advertisement exactly as the
 * recruiter/candidate will see it.
 *
 * It does not change facts.
 * It does not rewrite the advertisement.
 * It does not redesign the advertisement.
 *
 * It only decides:
 *
 *   PASS
 *   or
 *   BLOCK
 *
 * Gemini remains the image-generation engine.
 * Visual QA is a separate inspection step.
 */

export class VisualQaGateError extends Error {
  readonly code = "VISUAL_QA_FAILED";
  readonly result: VisualQaResult;

  constructor(result: VisualQaResult) {
    super(
      result.catastrophicDefects.length > 0
        ? `Visual QA blocked publication: ${result.catastrophicDefects.join(
            "; ",
          )}`
        : `Visual QA score ${result.overallScore}/${100} is below the publish threshold of ${VISUAL_QA_PASS_THRESHOLD}.`,
    );

    this.name = "VisualQaGateError";
    this.result = result;
  }
}

export interface VisualQaGateInput {
  imagePng: Buffer;
  platformFormatKey: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Runs KAI's existing Visual QA Brain against the FINAL image.
 *
 * Important:
 * The QA model receives ONLY the finished image.
 * It does not receive the source facts, extraction JSON or SVG.
 * Therefore it judges presentation quality rather than inventing factual
 * corrections.
 */
export async function runVisualQaGate(
  input: VisualQaGateInput,
): Promise<VisualQaResult> {
  const provider = new KaiVisualQaProvider();

  const result = await provider.evaluate({
    imagePngBase64: input.imagePng.toString("base64"),
    archetype: "VISUAL_HERO",
    platformFormatKey: input.platformFormatKey,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
  });

  /**
   * Catastrophic defects always block.
   *
   * This is deliberately checked before the score.
   */
  if (result.catastrophicDefects.length > 0) {
    throw new VisualQaGateError(result);
  }

  /**
   * Commercial threshold.
   *
   * 85 is the existing locked threshold in KAI's Visual QA schema.
   */
  if (result.overallScore < VISUAL_QA_PASS_THRESHOLD) {
    throw new VisualQaGateError(result);
  }

  /**
   * The model's own verdict is NOT trusted for the gate.
   *
   * The schema threshold above is authoritative.
   */
  return result;
}
