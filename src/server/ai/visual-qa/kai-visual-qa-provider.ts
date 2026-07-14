import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAiClient, getKaiVisionModel } from "@/server/ai/openai/openai-client";
import { AiInvalidResponseError } from "@/server/ai/openai/errors";
import { visualQaResultSchema, type VisualQaInput, type VisualQaProvider, type VisualQaResult } from "./visual-qa.schema";

/**
 * BRAIN C — real OpenAI vision implementation. Uses the same
 * responses.parse + input_image pattern the extraction engine already
 * runs against KAI_VISION_MODEL (kai-extraction-engine.ts's
 * runVisionExtraction), so image-input compatibility is proven by the
 * existing production path, not assumed.
 *
 * The prompt gives the model the rendered image ONLY — no facts, no SVG,
 * no source text — so it can never be tempted into factual judgments; it
 * evaluates presentation quality exactly like a human reviewer holding
 * the finished advertisement.
 */
export class KaiVisualQaProvider implements VisualQaProvider {
  readonly name = "openai";

  async evaluate(input: VisualQaInput): Promise<VisualQaResult> {
    const client = getOpenAiClient();
    const response = await client.responses.parse({
      model: getKaiVisionModel(),
      instructions: buildVisualQaInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Evaluate this rendered recruitment advertisement (archetype: ${input.archetype}, ` +
                `platform format: ${input.platformFormatKey}, ${input.widthPx}x${input.heightPx}px).`,
            },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${input.imagePngBase64}`,
              detail: "high",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(visualQaResultSchema, "kai_visual_qa_result") },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new AiInvalidResponseError("Visual QA returned no structured verdict.");
    }
    return parsed;
  }
}

export function buildVisualQaInstructions(): string {
  return [
    "You are KAI Visual QA — a strict commercial art director for overseas recruitment advertisements.",
    "You enforce the KAI Advertisement Composition Constitution (docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md): candidate-first hierarchy, the first-second attention test, the three-second comprehension test, proportional typography, no unjustified dead canvas, agency identity in the trust footer rather than dominating the top, and a prominent contact CTA. Where the Constitution and any other convention conflict, the Constitution wins.",
    "You are judging whether a real recruitment agency could publish this advertisement on WhatsApp, Facebook, Instagram, LinkedIn, or in print, against the standard of professional Gulf/overseas recruitment agency advertisements.",
    "Judge the advertisement WITHIN its declared archetype's own grammar: VISUAL_HERO is imagery-led social advertising; STRUCTURED_PROFESSIONAL is card-led clarity with no photography by design; HIGH_DENSITY and DTP_NEWSPAPER are deliberately typographic recruitment forms (newspaper/print/WhatsApp circulation) where the ABSENCE of photography is the correct professional convention, exactly like real Gulf newspaper recruitment ads — never request imagery for them and never lower their imagery/attention scores for being typographic; score their typography, density, structure, and authenticity instead.",
    "Score 0-100 on each dimension. Be strict: a technically clean but commercially flat document deserves a failing score. 85 is the minimum publishable bar.",
    "Evaluate: commercial advertisement quality; attention-stopping power; immediate job clarity; immediate country clarity; visual hierarchy; typography quality; canvas utilization (dead zones are defects); relevance of imagery; image/text integration; information readability; contact CTA prominence; trust/verification visibility; QR integration (it must look designed-in, not a sticker); overall brand professionalism.",
    "You judge PRESENTATION ONLY. Never comment on whether facts (salary, employer, dates) are true, and never request adding, removing, or changing factual recruitment content — corrections may only concern layout, emphasis, spacing, imagery, and composition.",
    "List concrete defects. For each required correction choose the single most appropriate type: REGENERATE_IMAGE only when the background imagery itself is weak or irrelevant; INCREASE_HEADLINE_EMPHASIS when the role/country does not dominate; IMPROVE_SPACING for crowding, collisions, or unused canvas; OTHER for anything else.",
    "MANDATORY REJECTION CONDITIONS — if ANY of these is true, it MUST appear in catastrophicDefects (which blocks acceptance regardless of score): more than ~20% unjustified dead canvas; the dominant headline too small for mobile social viewing; no clear candidate-facing hook visible immediately; the output looks primarily like a report, internal memo, SaaS card, or corporate document instead of a recruitment advertisement; the agency logo illegible; the contact CTA hard to find; key recruitment information requiring careful reading before the opportunity is understood; visual hierarchy materially weaker than professional Gulf overseas-recruitment advertisements; or an agency would reasonably need to redesign it manually before publishing.",
    "The pass standard is commercial, not ceremonial: would a real overseas recruitment agency PAY for this advertisement and publish it directly, without manual redesign, and is it competitive with strong AI-generated and traditional overseas recruitment advertisements?",
    "Separately list catastrophicDefects — defects that must block publication regardless of the overall score: unreadable position text, clipped content, overlapping text, apparent company logos/branding/signage rendered inside the background imagery, generated gibberish text inside imagery that damages the advertisement, severe canvas misuse (large dead zones), or missing agency/verification identity elements. Leave the list empty when none apply.",
    "Verdict: PASS if overallScore >= 85, REGENERATE if below 85 and correctable, BLOCKED only if the image is fundamentally broken (blank, unreadable, corrupted).",
  ].join("\n");
}
