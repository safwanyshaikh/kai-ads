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
 * KAI CREATIVE ENGINE
 *
 * Gemini owns the visual creative.
 *
 * KAI owns:
 * - exact recruitment facts
 * - exact agency identity
 * - registration
 * - verification
 * - QR
 *
 * Gemini must create the visual campaign concept,
 * but it must NOT invent recruitment typography.
 */
function buildGeminiCreativePrompt(
  creativeBrief: string,
): string {
  return [
    "KAI CREATIVE ENGINE — GEMINI SENIOR ADVERTISING ART DIRECTOR.",
    "",
    "Create a premium visual creative for a professional overseas recruitment campaign.",
    "",
    "THIS IS NOT A BACKGROUND TEMPLATE.",
    "This must be a commercially strong photographic campaign visual.",
    "Think like a world-class advertising art director creating the visual identity of a recruitment campaign.",
    "",
    "The creative brief below contains the recruitment intelligence.",
    "Use that information to determine the industry, project environment, hero worker, activity, camera perspective, lighting, depth, atmosphere and visual emotional impact.",
    "",
    "The industry must be immediately recognisable.",
    "The destination and project environment must feel authentic.",
    "Use realistic people, realistic PPE, realistic tools, realistic machinery and believable working conditions.",
    "",
    "Create one dominant visual hero.",
    "Prefer an authentic worker actively performing a believable professional task instead of a posed portrait.",
    "The worker should be large enough to recognise immediately on a mobile phone.",
    "",
    "Build a premium commercial composition using foreground, midground and background depth.",
    "Use deliberate camera perspective.",
    "Use professional lighting.",
    "Use realistic materials and scale.",
    "Use strong but believable colour treatment.",
    "",
    "The visual must feel like something a serious overseas recruitment agency would actually publish.",
    "",
    "CRITICAL — PURE VISUAL CREATIVE:",
    "The generated image itself must contain ZERO advertising typography.",
    "ZERO readable headlines.",
    "ZERO readable subheadings.",
    "ZERO job titles.",
    "ZERO vacancy numbers.",
    "ZERO salaries.",
    "ZERO dates.",
    "ZERO contact details.",
    "ZERO email addresses.",
    "ZERO phone numbers.",
    "ZERO QR codes.",
    "ZERO agency names.",
    "ZERO company logos.",
    "ZERO fake logos.",
    "ZERO recruitment banners.",
    "ZERO category cards.",
    "ZERO vacancy lists.",
    "ZERO bullet lists.",
    "ZERO infographic panels.",
    "ZERO UI elements.",
    "ZERO brochure-style information blocks.",
    "ZERO poster-style text areas.",
    "",
    "Do not create fake text.",
    "Do not create pseudo-writing.",
    "Do not create gibberish typography.",
    "Do not intentionally place words, letters or numbers into the composition.",
    "",
    "Incidental tiny real-world markings on machinery, equipment or PPE may naturally exist, but they must not become prominent advertising content.",
    "",
    "DO NOT CREATE:",
    "a spreadsheet,",
    "a vacancy table,",
    "a recruitment document,",
    "a presentation slide,",
    "a SaaS dashboard,",
    "a brochure page,",
    "a catalogue page,",
    "a giant text panel,",
    "a fake recruitment poster.",
    "",
    "Do not leave giant empty areas.",
    "Do not make the creative look unfinished.",
    "Do not deliberately create large empty text zones.",
    "",
    "KAI will apply the exact verified recruitment information and agency trust elements after the visual is generated.",
    "",
    "Therefore the image must be visually complete as a premium campaign photograph while containing no invented recruitment wording.",
    "",
    "MOBILE-FIRST QUALITY:",
    "The visual must remain compelling at thumbnail size.",
    "The hero subject must be recognisable.",
    "The industry must be recognisable.",
    "The visual should communicate professional opportunity, technical credibility and real work.",
    "",
    "AVOID:",
    "generic businessman imagery, handshake photography, posed corporate teams, abstract technology backgrounds, empty skylines, fantasy machinery, unrealistic PPE, meaningless cranes, fake signage, decorative text, brochure layouts and stock-photo clichés.",
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
              "IMAGE",
            ],

            imageConfig: {
              aspectRatio:
                nearestSupportedAspectRatio(
                  input.widthPx,
                  input.heightPx,
                ),

              imageSize:
                "2K",
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
      !imagePart?.inlineData?.data
    ) {
      throw new Error(
        "KAI Creative Engine returned no image data.",
      );
    }

    return {
      output: {
        imageBase64:
          imagePart.inlineData.data,

        mimeType:
          imagePart.inlineData
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
