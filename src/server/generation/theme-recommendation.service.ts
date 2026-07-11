import type { AdvertisementStyle } from "@prisma/client";
import type { DensityLevel } from "./density-classification.service";

/**
 * Theme Intelligence (Sprint 004). "Do not ask the recruiter to manually
 * choose hex colors, font names, gradients... The recruiter is not a
 * designer." Every theme is a named, pre-designed family — recruiters
 * pick one of these, never raw design parameters. The actual color
 * tokens/typography each family maps to belong to the rendering layer
 * (src/server/generation/section-renderer.ts), not here — this module
 * only decides which named families to recommend and in what order.
 */
interface ThemeFamily {
  key: string;
  label: string;
  description: string;
  suitedTo: AdvertisementStyle[];
}

export const THEME_FAMILIES: Record<string, ThemeFamily> = {
  corporate: {
    key: "corporate",
    label: "Corporate",
    description: "Clean, professional, trust-first.",
    suitedTo: ["VISUAL", "TYPOGRAPHY"],
  },
  industrial: {
    key: "industrial",
    label: "Industrial",
    description: "Bold, functional, built for trade and site roles.",
    suitedTo: ["VISUAL", "TYPOGRAPHY"],
  },
  urgent_hiring: {
    key: "urgent_hiring",
    label: "Urgent Hiring",
    description: "High-contrast, attention-first for time-sensitive roles.",
    suitedTo: ["VISUAL", "TYPOGRAPHY"],
  },
  premium: {
    key: "premium",
    label: "Premium",
    description: "Refined, understated, for senior or high-value roles.",
    suitedTo: ["VISUAL", "TYPOGRAPHY"],
  },
  minimal: {
    key: "minimal",
    label: "Minimal",
    description: "Maximum whitespace, minimum decoration.",
    suitedTo: ["VISUAL", "TYPOGRAPHY"],
  },
  high_contrast: {
    key: "high_contrast",
    label: "High Contrast",
    description: "Strong contrast for maximum scan-speed readability.",
    suitedTo: ["TYPOGRAPHY", "NEWSPAPER"],
  },
  newspaper_classic: {
    key: "newspaper_classic",
    label: "Newspaper Classic",
    description: "Traditional column-and-rule recruitment classified layout.",
    suitedTo: ["NEWSPAPER"],
  },
  newspaper_modern: {
    key: "newspaper_modern",
    label: "Newspaper Modern",
    description: "The same authentic DTP density with a cleaner typeface.",
    suitedTo: ["NEWSPAPER"],
  },
  country_inspired: {
    key: "country_inspired",
    label: "Country Inspired",
    description: "Subtle visual cues from the destination country's recruitment context.",
    suitedTo: ["VISUAL"],
  },
  industry_inspired: {
    key: "industry_inspired",
    label: "Industry Inspired",
    description: "Visual cues drawn from the trade/industry itself.",
    suitedTo: ["VISUAL"],
  },
};

export function listThemeFamilies(): ThemeFamily[] {
  return Object.values(THEME_FAMILIES);
}

export function isValidThemeKey(key: string): boolean {
  return key in THEME_FAMILIES;
}

/**
 * The one concrete visual property each theme family controls in this
 * sprint's deterministic renderer: an accent color used for the DTP rule
 * line, badge border, and section headings. Recruiters never see a hex
 * code — they pick "Urgent Hiring" and get red, "Premium" and get gold,
 * etc. Kept intentionally small (one property, not a full design token
 * set) so every theme has a real, testable effect on the output rather
 * than being a stored-but-unused label.
 */
const THEME_ACCENT_COLORS: Record<string, string> = {
  corporate: "#1e3a8a",
  industrial: "#78350f",
  urgent_hiring: "#b91c1c",
  premium: "#92400e",
  minimal: "#374151",
  high_contrast: "#000000",
  newspaper_classic: "#1a1a1a",
  newspaper_modern: "#1a1a1a",
  country_inspired: "#065f46",
  industry_inspired: "#1e3a8a",
};
const DEFAULT_ACCENT_COLOR = "#1a1a1a";

export function getThemeAccentColor(themeKey: string | null | undefined): string {
  if (!themeKey) return DEFAULT_ACCENT_COLOR;
  return THEME_ACCENT_COLORS[themeKey] ?? DEFAULT_ACCENT_COLOR;
}

/**
 * Recommends an ordered shortlist of theme families for the chosen
 * advertisement style/density — the recruiter picks visually from these,
 * never types a color. `hasLogo` biases toward the more brand-forward
 * families (Corporate/Premium) since those read best alongside a real
 * agency logo; it does not extract actual logo colors — see ADR-006 and
 * the AI image provider architecture for why that's scoped as a future
 * real image-analysis provider rather than implemented here.
 */
export function recommendThemes(params: {
  style: AdvertisementStyle;
  density: DensityLevel;
  hasLogo: boolean;
}): ThemeFamily[] {
  const candidates = listThemeFamilies().filter((theme) => theme.suitedTo.includes(params.style));

  const scored = candidates.map((theme) => {
    let score = 0;
    if (
      params.density === "HIGH" &&
      (theme.key === "newspaper_classic" || theme.key === "newspaper_modern" || theme.key === "high_contrast")
    ) {
      score += 2;
    }
    if (params.hasLogo && (theme.key === "corporate" || theme.key === "premium")) {
      score += 1;
    }
    if (params.style === "VISUAL" && (theme.key === "country_inspired" || theme.key === "industry_inspired")) {
      score += 1;
    }
    return { theme, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.theme);
}
