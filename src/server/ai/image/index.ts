import { getIntegrationStatus } from "@/lib/env";
import type { ImageGenerationProvider } from "./image-provider.interface";
import { NotImplementedImageProvider } from "./not-implemented-image-provider";
import { KaiCreativeEngineProvider } from "./kai-creative-engine-provider";
import { KaiGeminiImageProvider } from "./kai-gemini-image-provider";

export * from "./image-provider.interface";

let cachedProvider: ImageGenerationProvider | null = null;

/**
 * Gemini migration (Option A — independent gate): GEMINI_IMAGE_API_KEY
 * configured takes priority over OpenAI. OpenAI is kept as-is and used
 * whenever GEMINI_IMAGE_API_KEY is absent — priority order, not runtime
 * failover, so either provider rolls back independently by removing its
 * key. Same pattern as getAiExtractionToolkit() (src/server/ai/index.ts).
 */
export function getImageGenerationProvider(): ImageGenerationProvider {
  if (cachedProvider) return cachedProvider;

  const status = getIntegrationStatus();
  cachedProvider = status.geminiImage
    ? new KaiGeminiImageProvider()
    : status.openai
      ? new KaiCreativeEngineProvider()
      : new NotImplementedImageProvider();
  return cachedProvider;
}
