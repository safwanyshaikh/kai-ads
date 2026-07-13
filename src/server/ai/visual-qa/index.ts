import { getIntegrationStatus } from "@/lib/env";
import type { VisualQaProvider } from "./visual-qa.schema";
import { KaiVisualQaProvider } from "./kai-visual-qa-provider";

export * from "./visual-qa.schema";

let cachedProvider: VisualQaProvider | null | undefined;

/**
 * Same OPENAI_API_KEY-gated pattern as getImageGenerationProvider().
 * Returns null when unconfigured — the acceptance loop treats a null
 * provider as "Visual QA unavailable" and reports SKIPPED honestly
 * instead of blocking generation or faking a score.
 */
export function getVisualQaProvider(): VisualQaProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;
  cachedProvider = getIntegrationStatus().openai ? new KaiVisualQaProvider() : null;
  return cachedProvider;
}
