import { describe, expect, it } from "vitest";
import { isValidThemeKey } from "@/server/generation/theme-recommendation.service";

describe("Theme Intelligence — key validation for the optional Creative Brief hint", () => {
  it("accepts every named theme key", () => {
    for (const key of [
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
    ]) {
      expect(isValidThemeKey(key)).toBe(true);
    }
  });

  it("rejects an unknown theme key", () => {
    expect(isValidThemeKey("cyberpunk_neon")).toBe(false);
  });
});
