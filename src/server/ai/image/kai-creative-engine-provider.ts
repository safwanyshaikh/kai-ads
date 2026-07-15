import { getOpenAiClient } from "@/server/ai/openai/openai-client";
import { getEnv } from "@/lib/env";
import type {
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  ImageGenerationUsage,
} from "./image-provider.interface";

const SUPPORTED_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
type SupportedImageSize = (typeof SUPPORTED_SIZES)[number];

/** Maps an arbitrary platform-format aspect ratio onto the nearest size GPT Image actually supports. */
function nearestSupportedSize(widthPx: number, heightPx: number): SupportedImageSize {
  const size: SupportedImageSize = widthPx === heightPx
    ? "1024x1024"
    : widthPx > heightPx
      ? "1536x1024"
      : "1024x1536";

  if (!SUPPORTED_SIZES.includes(size)) {
    // Unreachable given the three branches above, but keeps this list as
    // the single source of truth if GPT Image's supported sizes change.
    throw new Error(`Unsupported image size resolved: ${size}`);
  }
  return size;
}

/**
 * Real OpenAI GPT Image implementation. Product-facing name is "KAI
 * Creative Engine" — this class name and everything in it are internal
 * only; no route or component surfaces "OpenAI" or the model name to an
 * agency user (see getIntegrationStatus / env.ts).
 *
 * For Visual Hero: GPT is the primary advertisement designer — it
 * generates the complete commercial advertisement composition. KAI
 * overlays only precision-critical elements (exact logo, QR, registration).
 */
export class KaiCreativeEngineProvider implements ImageGenerationProvider {
  readonly name = "openai";

  async generate(
    input: ImageGenerationInput,
  ): Promise<{ output: ImageGenerationOutput; usage: ImageGenerationUsage }> {
    const client = getOpenAiClient();
    const env = getEnv();
    const startedAt = Date.now();

    const response = await client.images.generate({
      model: env.KAI_IMAGE_MODEL,
      prompt: input.prompt,
      size: nearestSupportedSize(input.widthPx, input.heightPx),
      quality: input.quality,
      n: 1,
    });

    const latencyMs = Date.now() - startedAt;
    const image = response.data?.[0];
    if (!image?.b64_json) {
      throw new Error("KAI Creative Engine returned no image data.");
    }

    // GPT Image billing is token-based (input + output image tokens), not
    // a flat per-image price — usage.total_tokens isn't reliably present
    // on every SDK version, so cost is left null here rather than guessed.
    // See src/server/services/cost-estimation.ts's "never guess" rule.
    return {
      output: { imageBase64: image.b64_json, mimeType: "image/png" },
      usage: { model: env.KAI_IMAGE_MODEL, latencyMs, estimatedCostUsd: null },
    };
  }
}
