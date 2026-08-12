import { getGeminiImageClient } from "@/server/ai/gemini/gemini-client";
import { getEnv } from "@/lib/env";
import type {
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  ImageGenerationUsage,
} from "./image-provider.interface";

type SupportedAspectRatio =
  | "1:1"
  | "4:3"
  | "3:4";

function nearestSupportedAspectRatio(
  widthPx: number,
  heightPx: number,
): SupportedAspectRatio {
  if (widthPx === heightPx) {
    return "1:1";
  }

  return widthPx > heightPx
    ? "4:3"
    : "3:4";
}

/**
 * GEMINI = CREATIVE ADVERTISING ENGINE
 *
 * Gemini is responsible for creating the actual visual
 * advertising concept from KAI's recruitment intelligence.
 *
 * KAI remains responsible for exact factual identity,
 * verification and publication controls.
 */
function buildGeminiCreativePrompt(
  creativeBrief: string,
): string {
  return [
    "KAI CREATIVE ENGINE — GEMINI ADVERTISING DIRECTOR.",
    "",
    "Create the visual creative for a professional overseas recruitment advertisement.",
    "",
    "IMPORTANT:",
    "This is a REAL recruitment advertisement, not a background image.",
    "Think and create like a senior advertising creative director producing a finished commercial campaign visual for a serious international recruitment agency.",
    "",
    "The creative brief contains the recruitment intelligence and campaign direction.",
    "Use that intelligence to decide the strongest visual story.",
    "",
    "YOUR CREATIVE RESPONSIBILITY:",
    "Create the strongest possible visual advertisement concept.",
    "Choose the appropriate environment.",
    "Choose the dominant human subject or work activity.",
    "Choose the camera perspective.",
    "Choose the visual hierarchy.",
    "Choose lighting.",
    "Choose depth.",
    "Choose colour treatment.",
    "Choose atmosphere.",
    "Choose the emotional character of the campaign.",
    "Make the industry immediately recognisable.",
    "Make the destination/project environment believable.",
    "Make the opportunity feel real, professional and commercially attractive.",
    "",
    "DO NOT THINK OF YOURSELF AS A BACKGROUND GENERATOR.",
    "Do not make a blank canvas waiting for another system.",
    "Do not create large empty areas simply because information may be placed later.",
    "Do not create a generic photograph with no advertising concept.",
    "Do not create a document, spreadsheet, dashboard, presentation or recruitment database.",
    "",
    "THE VISUAL MUST STAND ON ITS OWN:",
    "Even before KAI adds exact factual information, the image should already look like a professionally art-directed recruitment campaign.",
    "",
    "INDUSTRY RECOGNITION:",
    "The industry must be visually obvious.",
    "Use authentic environments, machinery, tools, PPE, architecture, materials and working conditions.",
    "Oil and Gas must look like Oil and Gas.",
    "Construction must look like Construction.",
    "Marine and Shipyard must look like Marine and Shipyard.",
    "Manufacturing must look like Manufacturing.",
    "Hospitality must look like Hospitality.",
    "Healthcare must look like Healthcare.",
    "Agriculture must look like Agriculture.",
    "Energy and Power must look like Energy and Power.",
    "",
    "PEOPLE:",
    "When the recruitment opportunity involves workers or technical professionals, use realistic human subjects actively performing believable work.",
    "Do not use posed stock-photo behaviour.",
    "Use correct PPE and believable tools.",
    "The primary human subject should be large enough to remain recognisable on a mobile phone.",
    "",
    "VISUAL STORYTELLING:",
    "Use foreground, midground and background depth.",
    "Create scale.",
    "Use deliberate perspective.",
    "Use believable natural or cinematic lighting.",
    "Use authentic atmospheric conditions.",
    "Create one dominant focal point instead of many competing subjects.",
    "",
    "COMMERCIAL ADVERTISING QUALITY:",
    "The result should feel like a premium overseas recruitment campaign.",
    "Strong first impression.",
    "Clear visual hierarchy.",
    "Professional editorial photography.",
    "Realistic materials and people.",
    "Authentic industry.",
    "High visual impact.",
    "Mobile-first readability and recognition.",
    "",
    "FACTUAL INTEGRITY:",
    "KAI controls exact recruitment facts separately.",
    "Therefore do NOT invent or render factual recruitment information.",
    "",
    "NEVER RENDER:",
    "- readable recruitment text",
    "- job titles",
    "- vacancy numbers",
    "- salary figures",
    "- dates",
    "- phone numbers",
    "- email addresses",
    "- registration numbers",
    "- QR codes",
    "- fake agency logos",
    "- fake company logos",
    "- watermarks",
    "- fabricated contact details",
    "- fake certificates",
    "- fake documents",
    "- screens containing readable text",
    "- fabricated recruitment signage",
    "",
    "DO NOT REPLACE TEXT WITH GIBBERISH:",
    "Do not create pseudo-writing, fake letters or artificial text-like graphics.",
    "",
    "BRANDING:",
    "Do not invent branding.",
    "Do not create fake company marks.",
    "The exact agency identity is controlled by KAI.",
    "",
    "COMPOSITION:",
    "Do not reserve a giant blank area for text.",
    "Do not force the visual into a poster template.",
    "Do not create a giant dark information panel.",
    "Do not create a table.",
    "Do not create cards for every vacancy.",
    "Do not sacrifice the hero image to make room for imaginary text.",
    "",
    "The creative should have a natural advertising hierarchy:",
    "strong visual hook → clear industry recognition → professional recruitment atmosphere → natural space where factual information can coexist without destroying the image.",
    "",
    "The final composition should remain visually powerful even if exact text is subsequently added by KAI.",
    "",
    "AVOID:",
    "generic businessman imagery, handshake photography, empty skylines, fantasy machinery, unrealistic PPE, excessive posed workers, corporate stock-photo scenes, meaningless blue technology backgrounds, giant empty skies, decorative graphics with no recruitment meaning.",
    "",
    "The supplied creative brief is the authoritative campaign direction.",
    "",
    "CREATIVE BRIEF:",
    creativeBrief,
  ].join("\n");
}

export class KaiGeminiImageProvider
  implements ImageGenerationProvider
{
  readonly name = "gemini";

  async generate(
    input: ImageGenerationInput,
  ): Promise<{
    output: ImageGenerationOutput;
    usage: ImageGenerationUsage;
  }> {
    const client =
      getGeminiImageClient();

    const env =
      getEnv();

    const startedAt =
      Date.now();

    const prompt =
      buildGeminiCreativePrompt(
        input.prompt,
      );

    const response =
      await client.models.generateContent(
        {
          model:
            env.KAI_IMAGE_MODEL,

          contents:
            prompt,

          config: {
            responseModalities: [
              "TEXT",
              "IMAGE",
            ],

            imageConfig: {
              aspectRatio:
                nearestSupportedAspectRatio(
                  input.widthPx,
                  input.heightPx,
                ),
            },
          },
        },
      );

    const latencyMs =
      Date.now() -
      startedAt;

    const imagePart =
      response
        .candidates?.[0]
        ?.content
        ?.parts
        ?.find(
          (part) =>
            part.inlineData?.data,
        );

    if (
      !imagePart
        ?.inlineData
        ?.data
    ) {
      throw new Error(
        "KAI Creative Engine returned no image data.",
      );
    }

    return {
      output: {
        imageBase64:
          imagePart
            .inlineData
            .data,

        mimeType:
          imagePart
            .inlineData
            .mimeType ??
          "image/png",
      },

      usage: {
        model:
          env.KAI_IMAGE_MODEL,

        latencyMs,

        estimatedCostUsd:
          null,
      },
    };
  }
}
