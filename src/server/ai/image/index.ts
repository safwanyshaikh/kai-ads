import { getIntegrationStatus } from "@/lib/env";
import type { ImageGenerationProvider } from "./image-provider.interface";
import { NotImplementedImageProvider } from "./not-implemented-image-provider";
import { KaiGeminiImageProvider } from "./kai-gemini-image-provider";

export * from "./image-provider.interface";

let cachedProvider: ImageGenerationProvider | null = null;

/**
 * KAI Creative Engine
 *
 * Gemini is the production image-generation engine.
 *
 * There is intentionally no silent OpenAI fallback.
 * A generation must either use Gemini or fail clearly.
 *
 * This keeps visual testing deterministic and prevents one generation
 * from using a different image model than the one we are tuning.
 */
export function getImageGenerationProvider(): ImageGenerationProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const status = getIntegrationStatus();

  cachedProvider = status.geminiImage
    ? new KaiGeminiImageProvider()
    : new NotImplementedImageProvider();

  return cachedProvider;
}
