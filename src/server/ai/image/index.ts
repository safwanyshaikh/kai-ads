import { getIntegrationStatus } from "@/lib/env";
import type { ImageGenerationProvider } from "./image-provider.interface";
import { NotImplementedImageProvider } from "./not-implemented-image-provider";
import { KaiCreativeEngineProvider } from "./kai-creative-engine-provider";

export * from "./image-provider.interface";

let cachedProvider: ImageGenerationProvider | null = null;

/** Same OPENAI_API_KEY-gated pattern as getAiExtractionToolkit() (src/server/ai/index.ts). */
export function getImageGenerationProvider(): ImageGenerationProvider {
  if (cachedProvider) return cachedProvider;
  cachedProvider = getIntegrationStatus().openai
    ? new KaiCreativeEngineProvider()
    : new NotImplementedImageProvider();
  return cachedProvider;
}
