import { z } from "zod";
import { ApiError } from "@google/genai";
import {
  getGeminiTextClient,
  getKaiVisionModel,
} from "@/server/ai/gemini/gemini-client";
import {
  AiInvalidResponseError,
  AiNotConfiguredError,
  AiRateLimitError,
  AiTimeoutError,
} from "@/server/ai/openai/errors";
import {
  visualQaResultSchema,
  type VisualQaInput,
  type VisualQaProvider,
  type VisualQaResult,
} from "./visual-qa.schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("kai-gemini-visual-qa");

/**
 * KAI Visual QA runs on Gemini vision.
 *
 * Gemini creates the advertisement.
 * Gemini also performs the visual-quality inspection.
 *
 * KAI remains responsible for:
 * - factual precision
 * - deterministic fact rendering
 * - branding / verification
 * - publication gating
 */
export class KaiVisualQaProvider
  implements VisualQaProvider
{
  readonly name = "gemini";

  async evaluate(
    input: VisualQaInput,
  ): Promise<VisualQaResult> {
    const client = getGeminiTextClient();
    const model = getKaiVisionModel();

    try {
      const response =
        await client.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Evaluate this rendered recruitment advertisement ` +
                    `(archetype: ${input.archetype}, ` +
                    `platform format: ${input.platformFormatKey}, ` +
                    `${input.widthPx}x${input.heightPx}px).`,
                },
                {
                  inlineData: {
                    data: input.imagePngBase64,
                    mimeType: "image/png",
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction:
              buildVisualQaInstructions(),
            responseMimeType:
              "application/json",
            responseJsonSchema:
              z.toJSONSchema(
                visualQaResultSchema,
              ),
          },
        });

      if (!response.text) {
        throw new AiInvalidResponseError(
          "Visual QA returned no structured verdict.",
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(
          response.text,
        );
      } catch {
        throw new AiInvalidResponseError(
          "Visual QA returned invalid JSON.",
        );
      }

      const validated =
        visualQaResultSchema.safeParse(
          parsed,
        );

      if (!validated.success) {
        log.error(
          {
            issues:
              validated.error.issues,
          },
          "Gemini Visual QA returned an invalid result",
        );

        throw new AiInvalidResponseError(
          "Visual QA output did not match the KAI Visual QA schema.",
        );
      }

      return validated.data;
    } catch (error) {
      if (
        error instanceof
          AiNotConfiguredError ||
        error instanceof
          AiInvalidResponseError
      ) {
        throw error;
      }

      if (error instanceof ApiError) {
        if (error.status === 429) {
          throw new AiRateLimitError();
        }

        if (
          error.status === 401 ||
          error.status === 403
        ) {
          throw new AiNotConfiguredError();
        }

        if (
          error.status === 408 ||
          error.status === 504
        ) {
          throw new AiTimeoutError();
        }
      }

      log.error(
        { err: error },
        "Gemini Visual QA failed",
      );

      throw new AiInvalidResponseError(
        error instanceof Error
          ? error.message
          : undefined,
      );
    }
  }
}

export function buildVisualQaInstructions(): string {
  return [
    "You are KAI Visual QA — a strict commercial art director for overseas recruitment advertisements.",

    "You enforce the KAI Advertisement Composition Constitution (docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md): candidate-first hierarchy, the first-second attention test, the three-second comprehension test, proportional typography, no unjustified dead canvas, agency identity in the trust footer rather than dominating the top, and a prominent contact CTA. Where the Constitution and any other convention conflict, the Constitution wins.",

    "You are judging whether a real recruitment agency could publish this advertisement on WhatsApp, Facebook, Instagram, LinkedIn, or in print, against the standard of professional Gulf/overseas recruitment agency advertisements.",

    "Judge the advertisement WITHIN its declared archetype's own grammar: VISUAL_HERO uses a HYBRID architecture — a Gemini-generated text-free creative visual canvas with ALL factual text rendered deterministically on top; the AI imagery should be materially visible and commercially important, not buried under rigid document blocks; the deterministic text should use compact integrated overlays that preserve the visual power of the AI canvas. STRUCTURED_PROFESSIONAL is card-led clarity with no photography by design; HIGH_DENSITY and DTP_NEWSPAPER are deliberately typographic recruitment forms where the ABSENCE of photography is the correct professional convention — never request imagery for them and never lower their imagery/attention scores for being typographic; score their typography, density, structure, and authenticity instead.",

    "Score 0-100 on each dimension. Be strict: a technically clean but commercially flat document deserves a failing score. 85 is the minimum publishable bar.",

    "Evaluate: commercial advertisement quality; attention-stopping power; immediate job clarity; immediate country clarity; visual hierarchy; typography quality; canvas utilization; relevance of imagery; image/text integration; information readability; contact CTA prominence; trust/verification visibility; QR integration; overall brand professionalism.",

    "You judge PRESENTATION ONLY. Never comment on whether facts (salary, employer, dates) are true, and never request adding, removing, or changing factual recruitment content — corrections may only concern layout, emphasis, spacing, imagery, and composition.",

    "INFORMATION DEDUPLICATION — the Constitution requires a single integrated trust footer. Agency name, logo, RA number, MEA badge, and registration should appear ONCE in the footer/verification band, NOT repeated at the top of the advertisement. If the agency identity dominates both top and bottom, flag it as a defect. Exception: DTP_NEWSPAPER mastheads are justified.",

    "CANDIDATE HOOK — the single largest text on the canvas should be a strong, truthful, candidate-facing hook, normally the project and destination, NOT the agency name or boilerplate.",

    "HEADLINE CLIPPING — check that headline text is fully visible and not truncated or running off the canvas edge. Clipped headlines are catastrophic.",

    "CONTRAST AND READABILITY — if text is difficult to read against its background, flag it.",

    "REGENERATE_IMAGE is appropriate only when the imagery itself is weak or irrelevant. INCREASE_HEADLINE_EMPHASIS concerns hierarchy. IMPROVE_SPACING concerns crowding, collisions or dead space. IMPROVE_CTA concerns contact prominence. IMPROVE_CONTRAST concerns readability. OTHER covers everything else.",

    "MANDATORY REJECTION CONDITIONS — catastrophicDefects MUST contain any of these: more than ~20% unjustified dead canvas; dominant headline too small for mobile; no clear candidate hook; output looks like a report/internal memo/SaaS card instead of a recruitment advertisement; illegible agency logo; contact CTA hard to find; headline clipped; material overlap/collision; severe canvas misuse; missing verification identity; or the agency would need to redesign it manually before publishing.",

    "The pass standard is commercial: would a real overseas recruitment agency publish this advertisement directly without manual redesign, and is it competitive with strong AI-generated and traditional overseas recruitment advertisements?",

    "ANTI-GIBBERISH — for VISUAL_HERO, the Gemini-generated creative canvas must contain NO readable advertising text, numbers, logos, pseudo-text, fake signage or readable equipment labels. Any such generated text is a CATASTROPHIC defect. All readable recruitment information must come from KAI's deterministic layer.",

    "Separately list catastrophicDefects that block publication regardless of score.",

    "Verdict: PASS if overallScore >= 85, REGENERATE if below 85 and correctable, BLOCKED only if the image is fundamentally broken."
  ].join("\n");
}
