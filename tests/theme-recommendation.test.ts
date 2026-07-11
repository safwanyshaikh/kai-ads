import { describe, expect, it } from "vitest";
import {
  listThemeFamilies,
  recommendThemes,
  isValidThemeKey,
  THEME_FAMILIES,
} from "@/server/generation/theme-recommendation.service";

describe("Theme Intelligence", () => {
  it("includes every minimum theme family named in the brief", () => {
    const keys = Object.keys(THEME_FAMILIES);
    expect(keys).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it("recommendThemes only returns families suited to the requested style", () => {
    const themes = recommendThemes({ style: "NEWSPAPER", density: "HIGH", hasLogo: false });
    for (const theme of themes) {
      expect(theme.suitedTo).toContain("NEWSPAPER");
    }
  });

  it("HIGH density prioritizes newspaper/high-contrast families for a NEWSPAPER style", () => {
    const themes = recommendThemes({ style: "NEWSPAPER", density: "HIGH", hasLogo: false });
    expect(["newspaper_classic", "newspaper_modern", "high_contrast"]).toContain(themes[0].key);
  });

  it("never exposes hex codes, font names, or raw design terminology — every family is a named concept only", () => {
    for (const theme of listThemeFamilies()) {
      expect(theme.label).not.toMatch(/#[0-9a-f]{3,6}/i);
      expect(theme.description).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("isValidThemeKey validates correctly", () => {
    expect(isValidThemeKey("corporate")).toBe(true);
    expect(isValidThemeKey("cyberpunk_neon")).toBe(false);
  });
});
