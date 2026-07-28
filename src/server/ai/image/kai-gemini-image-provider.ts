import { getGeminiImageClient } from "@/server/ai/gemini/gemini-client";
import { getEnv } from "@/lib/env";
import type {
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  ImageGenerationUsage,
} from "./image-provider.interface";

type SupportedAspectRatio = "1:1" | "4:3" | "3:4";

/** Maps an arbitrary platform-format aspect ratio onto the nearest ratio Gemini image generation supports — same three-way split as the OpenAI provider's nearestSupportedSize(), adapted to Gemini's aspectRatio config instead of an explicit pixel size. */
function nearestSupportedAspectRatio(widthPx: number, heightPx: number): SupportedAspectRatio {
  if (widthPx === heightPx) return "1:1";
  return widthPx > heightPx ? "4:3" : "3:4";
}

/**
 * Real Gemini image implementation — the "KAI Creative Engine" product
 * name and everything in it are internal only; no route or component
 * surfaces "Gemini" or the model name to an agency user (see
 * getIntegrationStatus / env.ts). Independent of the OpenAI image
 * provider (Option A) — its own key, its own client, its own rollback.
 *
 * GPT/Gemini is the primary advertisement designer — it generates the
 * complete commercial advertisement composition. KAI overlays only
 * precision-critical elements (exact logo, QR, registration) afterward,
 * unchanged by which image model produced the base artwork.
 */
export class KaiGeminiImageProvider implements ImageGenerationProvider {
  readonly name = "gemini";

  async generate(
    input: ImageGenerationInput,
  ): Promise<{ output: ImageGenerationOutput; usage: ImageGenerationUsage }> {
    const client = getGeminiImageClient();
    const env = getEnv();
    const startedAt = Date.now();

    const response = await client.models.generateContent({
      model: env.KAI_IMAGE_MODEL,
      contents: input.prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: nearestSupportedAspectRatio(input.widthPx, input.heightPx),
        },
      },
    });

    const latencyMs = Date.now() - startedAt;
    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new Error("KAI Creative Engine returned no image data.");
    }

    // Gemini image billing is token-based, not a flat per-image price —
    // left null here rather than guessed, same rule as the OpenAI provider
    // (see src/server/services/cost-estimation.ts's "never guess" rule).
    return {
      output: {
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? "image/png",
      },
      usage: { model: env.KAI_IMAGE_MODEL, latencyMs, estimatedCostUsd: null },
    };
  }
}
