/**
 * Theme Intelligence (Sprint 004). Named theme keys a recruiter never
 * types by hand. The one production pipeline has no UI theme picker
 * anymore — `theme` is an internal, optional field on
 * `GenerateAdvertisementInput` that, when present, is folded into the
 * Creative Brief as a soft prose hint (see
 * src/server/generation/pipeline/creative-brief.ts), never a deterministic
 * color token. This module only validates that key.
 */
const THEME_KEYS = new Set([
  "corporate",
  "industrial",
  "urgent_hiring",
  "premium",
  "minimal",
  "high_contrast",
  "newspaper_classic",
  "newspaper_modern",
  "country_inspired",
  "industry_inspired",
]);

export function isValidThemeKey(key: string): boolean {
  return THEME_KEYS.has(key);
}
