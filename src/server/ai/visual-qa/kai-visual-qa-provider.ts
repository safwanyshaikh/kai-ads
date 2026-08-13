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

const log = createLogger(
  "kai-gemini-visual-qa",
);

/**
 * KAI VISUAL QA
 *
 * Gemini creates the visual creative.
 * KAI judges commercial presentation quality.
 *
 * IMPORTANT:
 *
 * Visual QA is NOT the source of truth for recruitment facts.
 * The source facts and KAI deterministic rendering layer are authoritative.
 *
 * QA must therefore distinguish:
 *
 * 1. Candidate-facing fabricated text
 * 2. Incidental visual markings
 *
 * Only the first is a publication-blocking integrity defect.
 */
export class KaiVisualQaProvider
  implements VisualQaProvider
{
  readonly name = "gemini";

  async evaluate(
    input: VisualQaInput,
  ): Promise<VisualQaResult> {
    const client =
      getGeminiTextClient();

    const model =
      getKaiVisionModel();

    try {
      const response =
        await client.models.generateContent(
          {
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
                      data:
                        input.imagePngBase64,

                      mimeType:
                        "image/png",
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
          },
        );

      if (!response.text) {
        throw new AiInvalidResponseError(
          "Visual QA returned no structured verdict.",
        );
      }

      let parsed: unknown;

      try {
        parsed =
          JSON.parse(
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
        if (
          error.status ===
          429
        ) {
          throw new AiRateLimitError();
        }

        if (
          error.status ===
            401 ||
          error.status ===
            403
        ) {
          throw new AiNotConfiguredError();
        }

        if (
          error.status ===
            408 ||
          error.status ===
            504
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

    "You judge whether the final advertisement is commercially publishable by a professional overseas recruitment agency.",

    "Enforce the KAI Advertisement Composition Constitution: candidate-first hierarchy, immediate understanding, destination clarity, project/industry clarity, readable recruitment presentation, strong visual hierarchy, controlled agency branding, clear trust/verification and commercially appropriate use of the canvas.",

    "Judge the declared archetype correctly. VISUAL_HERO is a hybrid advertisement: Gemini creates the visual campaign and KAI supplies exact factual/agency overlays. STRUCTURED_PROFESSIONAL is information-led. HIGH_DENSITY and DTP_NEWSPAPER are intentionally typographic formats.",

    "Score 0-100 on commercial advertisement quality, attention stopping power, job clarity, country clarity, visual hierarchy, typography quality, canvas utilization, image relevance, image/text integration, information readability, CTA prominence when CTA information exists, trust/verification visibility, QR integration and overall brand professionalism.",

    "Presentation quality matters. A technically correct but visually flat requirement sheet should fail. A strong recruitment advertisement should feel publishable without manual redesign.",

    "FACT AUTHORITY RULE: Visual QA must NOT invent factual corrections. The recruitment source and KAI deterministic rendering layer are authoritative for job titles, vacancy counts, salaries, benefits, interview details, contact details, agency identity and registration.",

    "Do NOT infer that a role is incorrect from ambiguous OCR or imperfect visual reading. Do NOT replace, shorten, correct or reinterpret a canonical recruitment term.",

    "OPTIONAL SOURCE FIELDS: If salary, benefits, interview, contact or employer information is absent from the actual requirement, their absence is NOT a visual defect and must NOT reduce the score or create a catastrophic defect.",

    "CTA RULE: Evaluate CTA prominence ONLY when a valid candidate action/contact exists in the supplied recruitment data or deterministic footer. Do NOT demand a button, phone number, email address or application instruction when the source does not contain one.",

    "TRUST RULE: Judge the actual agency verification architecture present in the final image. Do not demand fictional badges, registration numbers, contact data or logos that are not source-grounded.",

    "CANDIDATE HOOK: The advertisement should have a strong, truthful, candidate-facing hook. Project + destination + industry should be obvious quickly.",

    "HEADLINE CLIPPING: A clipped or materially truncated headline is catastrophic.",

    "CONTRAST: Text that cannot reasonably be read at mobile size is a defect.",

    "SPACING: Flag crowding, collision, awkward overlaps or severe dead canvas.",

    "IMAGE RELEVANCE: The visual must clearly represent the recruitment industry and work environment.",

    "INDUSTRY RECOGNITION: Oil & Gas, Construction, Marine, Shipyard, Manufacturing, Healthcare, Hospitality, Agriculture, Energy and other industries must look like themselves through authentic environments, workers, machinery and working conditions.",

    "ANTI-GIBBERISH IS TARGETED, NOT BLIND: For VISUAL_HERO, Gemini must not create large or candidate-facing advertising text, fake recruitment headlines, fake vacancy numbers, fake salaries, fake dates, fake phone numbers, fake email addresses, fake QR codes, fake agency logos or prominent pseudo-text intended to look like real advertising information.",

    "INCIDENTAL MARKINGS ARE NOT CATASTROPHIC: Tiny manufacturer labels, PPE markings, helmet stickers, equipment labels, machinery lettering, background signage, technical markings or short incidental abbreviations that are not candidate-facing and are not being used as advertisement copy must NOT be treated as catastrophic anti-gibberish defects.",

    "A tiny incidental marking such as a short acronym on a helmet or piece of equipment is NOT equivalent to fabricated recruitment text.",

    "Only flag incidental visual text when it is large, prominent, clearly readable and materially behaves like invented advertising or factual recruitment content.",

    "Examples of acceptable incidental text: small helmet/manufacturer markings, tiny equipment labels, technical stickers, distant industrial signage that does not dominate the composition.",

    "Examples of catastrophic fabricated text: a large fake job title, fake vacancy number, fake salary, fake contact number, fake website, fake application instruction, fake agency name, fake QR or prominent recruitment slogan generated by Gemini.",

    "If small incidental text is noticed but does not materially affect the advertisement, do not create a catastrophic defect and do not make it the reason for rejection.",

    "AGENCY BRANDING: Agency identity should support trust and should not dominate the recruitment opportunity. Avoid unnecessary duplication.",

    "CONTACT DATA: Missing source contact information is not a generation defect.",

    "VACANCY COVERAGE: Do not reject because a large requirement cannot place every detailed qualification on one visual frame. Evaluate whether the advertisement communicates the opportunity appropriately for its selected format.",

    "Do not demand microscopic role text merely to force all source content into one canvas.",

    "If a large requirement is presented as a campaign/carousel architecture, judge the frame for its intended campaign role rather than expecting the complete source document on every frame.",

    "PUBLISHABILITY TEST: Would a real overseas recruitment agency be comfortable publishing this creative directly without redesigning the visual composition?",

    "CATASTROPHIC DEFECTS are limited to genuinely publication-blocking problems: materially broken composition, severe clipping, major collision, severe canvas misuse, unreadable primary message, fundamentally irrelevant imagery, fabricated prominent recruitment information, unusable verification identity, or a design that clearly looks like an internal report rather than an advertisement.",

    "A minor incidental text artifact is NOT catastrophic.",

    "A source field being absent is NOT catastrophic.",

    "An optional CTA style preference is NOT catastrophic when no CTA data exists.",

    "Verdict: PASS when overallScore is at or above 85. REGENERATE when below 85 and the defects are genuinely correctable. BLOCKED only when the advertisement is fundamentally broken or contains a serious integrity violation.",
  ].join(
    "\n",
  );
}
