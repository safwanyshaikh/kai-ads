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

type SupportedImageSize =
  | "1K"
  | "2K";

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
 * Gemini owns the visual advertisement.
 *
 * KAI owns:
 * - exact recruitment facts
 * - exact agency identity
 * - registration
 * - verification
 * - QR
 *
 * Gemini must therefore create a commercially strong
 * recruitment advertisement visual, NOT a generic
 * background image.
 */
function buildGeminiCreativePrompt(
  creativeBrief: string,
): string {
  return [
    "KAI CREATIVE ENGINE — GEMINI ADVERTISING DIRECTOR.",
    "",
    "Create the primary visual creative for a professional overseas recruitment advertisement.",
    "",
    "This is a REAL COMMERCIAL RECRUITMENT ADVERTISEMENT.",
    "Do not think of this as a background generator.",
    "Do not create a blank canvas.",
    "Do not create a document.",
    "Do not create a spreadsheet.",
    "Do not create a dashboard.",
    "Do not create a generic stock photograph.",
    "",
    "Think like a senior advertising creative director.",
    "",
    "The creative brief contains the complete recruitment intelligence and campaign direction.",
    "Use it to create a strong visual advertising concept.",
    "",
    "The final image must immediately communicate:",
    "1. PROFESSIONAL RECRUITMENT OPPORTUNITY",
    "2. DESTINATION / PROJECT ENVIRONMENT",
    "3. INDUSTRY",
    "4. TYPE OF PROFESSIONAL OR WORKER REQUIRED",
    "",
    "INDUSTRY RECOGNITION IS MANDATORY.",
    "The viewer should recognise the industry from the environment and activity before reading detailed recruitment information.",
    "",
    "Use authentic:",
    "- workers",
    "- PPE",
    "- machinery",
    "- tools",
    "- architecture",
    "- industrial equipment",
    "- workplace conditions",
    "- materials",
    "- climate",
    "- scale",
    "",
    "When workers are relevant, show them actively performing believable professional work.",
    "Do not use posed corporate portraits.",
    "Do not use handshake photography.",
    "Do not use generic businessmen.",
    "",
    "Create one dominant visual hero.",
    "The hero must be large enough to remain recognisable on a mobile phone.",
    "",
    "Create professional foreground, midground and background depth.",
    "Use deliberate perspective.",
    "Use believable lighting.",
    "Use premium editorial photography.",
    "Use strong but realistic colour grading.",
    "Create commercial visual impact.",
    "",
    "The advertisement must remain visually powerful before KAI adds its exact factual information.",
    "",
    "DO NOT CREATE LARGE EMPTY AREAS.",
    "Do not leave giant blank sky.",
    "Do not create a huge empty central area.",
    "Do not make the image look unfinished.",
    "",
    "Do not solve the advertisement with a large dark panel.",
    "Do not create a vacancy table.",
    "Do not create cards for every job.",
    "Do not create artificial UI elements.",
    "",
    "KAI will protect exact factual information separately.",
    "",
    "NEVER INVENT OR RENDER:",
    "- job titles",
    "- vacancy counts",
    "- salary figures",
    "- dates",
    "- phone numbers",
    "- email addresses",
    "- registration numbers",
    "- QR codes",
    "- agency logos",
    "- company logos",
    "- fake certificates",
    "- fake documents",
    "- readable fabricated signage",
    "- fake website addresses",
    "- watermarks",
    "",
    "Do not create gibberish text or pseudo-writing.",
    "",
    "Do not invent branding.",
    "",
    "The visual should feel like a serious overseas recruitment agency campaign, not an AI-generated generic industrial photograph.",
    "",
    "MOBILE-FIRST QUALITY:",
    "The advertisement will be viewed primarily on WhatsApp, Instagram, Facebook, LinkedIn and Telegram.",
    "The main visual subject must survive thumbnail viewing.",
    "The industry must be recognisable immediately.",
    "The campaign must feel premium and trustworthy.",
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

    /**
     * 2K gives KAI enough visual quality for
     * professional recruitment advertising while
     * avoiding unnecessary 4K payload size.
     *
     * The final pipeline can resize the result to
     * the requested publication dimensions.
     */
    const response =
      await client.models.generateContent(
        {
          model:
            env.KAI_IMAGE_MODEL,

          contents:
            prompt,

          config: {
            /**
             * IMAGE ONLY.
             *
             * Do not request TEXT together with IMAGE.
             * This is important for image resolution behaviour
             * on the Gemini 3.1 image family.
             */
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
