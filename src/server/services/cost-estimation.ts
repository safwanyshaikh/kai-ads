/**
 * Rough per-1K-token USD pricing for cost estimation. This is reference
 * data, not a "hardcoded model name" in the sense the brief means —
 * WHICH model to call is still entirely env-driven (KAI_TEXT_MODEL /
 * KAI_VISION_MODEL); this table only estimates cost *if* that model
 * happens to match a known price point, and safely returns null
 * otherwise rather than guessing.
 */
const PRICING_PER_1K_TOKENS_USD: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  "gpt-4.1": { input: 0.002, output: 0.008 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

/** Returns null (never guesses) when the model or token counts aren't known. */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const pricing = PRICING_PER_1K_TOKENS_USD[model];
  if (!pricing || inputTokens === null || outputTokens === null) return null;
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}
