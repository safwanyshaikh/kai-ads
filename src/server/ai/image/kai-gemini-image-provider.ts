import { getGeminiImageClient } from "@/server/ai/gemini/gemini-client";
import { getEnv } from "@/lib/env";
import type {
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  ImageGenerationUsage,
} from "./image-provider.interface";

type SupportedAspectRatio = "1:1" | "4:3" | "3:4";

function nearestSupportedAspectRatio(
  widthPx: number,
  heightPx: number,
): SupportedAspectRatio {
  if (widthPx === heightPx) return "1:1";
  return widthPx > heightPx ? "4:3" : "3:4";
}

/**
 * Gemini is KAI's active image-generation engine.
 *
 * Gemini owns the visual advertisement:
 * - concept
 * - people
 * - environment
 * - visual storytelling
 * - composition
 * - lighting
 * - colour
 * - atmosphere
 * - commercial impact
 *
 * KAI owns precision:
 * - verified recruitment facts
 * - exact positions
 * - exact vacancy counts
 * - exact salary/benefit information
 * - interview details
 * - contact details
 * - logo
 * - QR
 * - registration/verification
 *
 * The Gemini image must therefore be a strong commercial visual,
 * not a generic blank poster background.
 */
function buildGeminiCreativePrompt(
  creativeBrief: string,
): string {
  return [
    "KAI CREATIVE ENGINE — GEMINI IMAGE GENERATION.",
    "",
    "Create the primary visual artwork for a premium international recruitment advertisement.",
    "",
    "You are the creative artist. Produce a commercially strong, professionally art-directed advertisement visual.",
    "",
    "The creative brief below is the authoritative creative direction.",
    "",
    "KAI will apply the verified recruitment information after the image is generated.",
    "",
    "Therefore DO NOT render:",
    "- readable recruitment text",
    "- salary figures",
    "- vacancy numbers",
    "- dates",
    "- phone numbers",
    "- email addresses",
    "- QR codes",
    "- registration numbers",
    "- fake logos",
    "- watermarks",
    "- fake UI",
    "- pseudo-text",
    "- fabricated signage",
    "",
    "DO create:",
    "- a strong visual concept",
    "- a clear primary subject",
    "- realistic people where appropriate",
    "- authentic workplace/environment",
    "- cinematic depth",
    "- professional lighting",
    "- believable materials and machinery",
    "- strong colour direction",
    "- premium commercial photography",
    "- immediate mobile impact",
    "",
    "Do not produce an empty generic background merely because factual information will be overlaid later.",
    "",
    "Do not use large dead zones as a substitute for creativity.",
    "",
    "The composition must feel complete and intentional even before KAI adds the factual layer.",
    "",
    "Human subjects must be realistic, relevant to the occupation and actively engaged in believable work whenever the creative brief calls for workers.",
    "",
    "Industrial scenes must contain authentic equipment, PPE, architecture, scale, materials and working conditions appropriate to the specified industry and destination.",
    "",
    "Do not fabricate factual claims through visible text or logos.",
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
    const client = getGeminiImageClient();
    const env = getEnv();
    const startedAt = Date.now();

    const prompt = buildGeminiCreativePrompt(input.prompt);

    const response = await client.models.generateContent({
      model: env.KAI_IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: nearestSupportedAspectRatio(
            input.widthPx,
            input.heightPx,
          ),
        },
      },
    });

    const latencyMs = Date.now() - startedAt;

    const imagePart =
      response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data,
      );

    if (!imagePart?.inlineData?.data) {
      throw new Error(
        "KAI Creative Engine returned no image data.",
      );
    }

    return {
      output: {
        imageBase64: imagePart.inlineData.data,
        mimeType:
          imagePart.inlineData.mimeType ?? "image/png",
      },
      usage: {
        model: env.KAI_IMAGE_MODEL,
        latencyMs,
        estimatedCostUsd: null,
      },
    };
  }
}
