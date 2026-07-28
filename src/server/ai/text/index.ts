import { getIntegrationStatus } from "@/lib/env";
import type { TextGenerationProvider } from "./text-provider.interface";
import { NotImplementedTextProvider } from "./not-implemented-text-provider";
import { OpenAiTextProvider } from "./openai-text-provider";
import { GeminiTextProvider } from "./gemini-text-provider";

export * from "./text-provider.interface";

let cachedProvider: TextGenerationProvider | null = null;

/**
 * Gemini migration (Option A — independent gate): GEMINI_TEXT_API_KEY
 * configured takes priority over OpenAI. OpenAI is kept as-is and used
 * whenever GEMINI_TEXT_API_KEY is absent — priority order, not runtime
 * failover, so either provider rolls back independently by removing its
 * key. Same pattern as getAiExtractionToolkit() (src/server/ai/index.ts)
 * and getImageGenerationProvider() (src/server/ai/image/index.ts).
 */
export function getTextGenerationProvider(): TextGenerationProvider {
  if (cachedProvider) return cachedProvider;

  const status = getIntegrationStatus();
  cachedProvider = status.geminiText
    ? new GeminiTextProvider()
    : status.openai
      ? new OpenAiTextProvider()
      : new NotImplementedTextProvider();
  return cachedProvider;
}
