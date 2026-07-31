/**
 * The Footer Library — five agency-owned footer styles.
 *
 * A footer is brand furniture, the equivalent of a letterhead or an email
 * signature. It is NOT an advertisement template: it never influences the
 * creative above the branding strip, which belongs entirely to the AI.
 * These styles only re-dress the trust strip KAI already paints.
 *
 * Every style is built from KDL's locked palette (docs/012 §3.1) — navy
 * #0B1F33, cream #F3EEE3, gold #F3D98B, slate #4A5A6C, divider #C9C0AB.
 * No style introduces a colour outside it, and the contrast law (gold only
 * on navy) holds in all five.
 */

export type FooterStyle =
  | "CLASSIC_CORPORATE"
  | "TRADITIONAL_DTP"
  | "INDUSTRIAL_PREMIUM"
  | "MODERN_MINIMAL"
  | "AI_PREMIUM";

export const FOOTER_STYLES: FooterStyle[] = [
  "CLASSIC_CORPORATE",
  "TRADITIONAL_DTP",
  "INDUSTRIAL_PREMIUM",
  "MODERN_MINIMAL",
  "AI_PREMIUM",
];

export interface FooterTheme {
  /** Band fill behind the agency identity. */
  background: string;
  /** Agency name colour. */
  text: string;
  /** Registration/address colour. */
  mutedText: string;
  /** Hairline and divider colour. */
  divider: string;
  contactRowBackground: string;
  contactRowText: string;
  /** Badge pill fill and text. */
  badgeBackground: string;
  badgeText: string;
  /** A rule above the band, 0 to omit it. */
  topRulePx: number;
  topRuleColour: string;
  /** Whether the agency name renders uppercase. */
  uppercaseName: boolean;
  label: string;
  description: string;
}

const NAVY = "#0B1F33";
const CREAM = "#F3EEE3";
const GOLD = "#F3D98B";
const SLATE = "#4A5A6C";
const DIVIDER = "#C9C0AB";
const WHITE = "#FFFFFF";

export const FOOTER_THEMES: Record<FooterStyle, FooterTheme> = {
  /** The shipping default — cream band, navy contact row. */
  CLASSIC_CORPORATE: {
    background: CREAM,
    text: NAVY,
    mutedText: SLATE,
    divider: DIVIDER,
    contactRowBackground: NAVY,
    contactRowText: GOLD,
    badgeBackground: NAVY,
    badgeText: GOLD,
    topRulePx: 0,
    topRuleColour: DIVIDER,
    uppercaseName: false,
    label: "Classic Corporate",
    description: "Professional overseas-recruitment footer. Cream band, navy contact row.",
  },

  /**
   * Newspaper classified convention: heavy rule above the band, uppercase
   * agency name, high-contrast print-safe type.
   */
  TRADITIONAL_DTP: {
    background: WHITE,
    text: NAVY,
    mutedText: NAVY,
    divider: NAVY,
    contactRowBackground: NAVY,
    contactRowText: WHITE,
    badgeBackground: NAVY,
    badgeText: WHITE,
    topRulePx: 6,
    topRuleColour: NAVY,
    uppercaseName: true,
    label: "Traditional Recruitment (DTP)",
    description: "Newspaper classified convention — heavy rule, uppercase name, print-safe contrast.",
  },

  /** Oil & gas, EPC, marine, heavy engineering: dark, industrial weight. */
  INDUSTRIAL_PREMIUM: {
    background: NAVY,
    text: WHITE,
    mutedText: DIVIDER,
    divider: GOLD,
    contactRowBackground: NAVY,
    contactRowText: GOLD,
    badgeBackground: GOLD,
    badgeText: NAVY,
    topRulePx: 4,
    topRuleColour: GOLD,
    uppercaseName: true,
    label: "Industrial Premium",
    description: "For Oil & Gas, EPC, shutdown, marine and heavy engineering. Dark, weighty.",
  },

  /** Quietest option: for busy or colourful artwork that needs calm below. */
  MODERN_MINIMAL: {
    background: WHITE,
    text: NAVY,
    mutedText: SLATE,
    divider: DIVIDER,
    contactRowBackground: CREAM,
    contactRowText: NAVY,
    badgeBackground: CREAM,
    badgeText: NAVY,
    topRulePx: 1,
    topRuleColour: DIVIDER,
    uppercaseName: false,
    label: "Modern Minimal",
    description: "Quiet and light. Best beneath busy or colourful artwork.",
  },

  /** Gold-accented navy: the most decorative, for premium campaigns. */
  AI_PREMIUM: {
    background: NAVY,
    text: GOLD,
    mutedText: DIVIDER,
    divider: GOLD,
    contactRowBackground: CREAM,
    contactRowText: NAVY,
    badgeBackground: GOLD,
    badgeText: NAVY,
    topRulePx: 3,
    topRuleColour: GOLD,
    uppercaseName: false,
    label: "AI Premium",
    description: "Gold on navy. The most decorative option, for premium campaigns.",
  },
};

export const DEFAULT_FOOTER_STYLE: FooterStyle = "CLASSIC_CORPORATE";

/**
 * One black plate. A newspaper prints single-ink; leaving the trust strip
 * in navy under an otherwise black advertisement looked like a printing
 * fault. Same marks, one ink.
 */
const SINGLE_INK_FOOTER: FooterTheme = {
  background: "#FFFFFF",
  text: "#000000",
  mutedText: "#333333",
  divider: "#000000",
  contactRowBackground: "#000000",
  contactRowText: "#FFFFFF",
  badgeBackground: "#000000",
  badgeText: "#FFFFFF",
  topRulePx: 4,
  topRuleColour: "#000000",
  uppercaseName: true,
  label: "Single Ink (Newsprint)",
  description: "One black plate, for newspaper printing.",
};

export function footerTheme(style?: FooterStyle | null, singleInk = false): FooterTheme {
  if (singleInk) return SINGLE_INK_FOOTER;
  return FOOTER_THEMES[style ?? DEFAULT_FOOTER_STYLE];
}

/** At most three permanent branding claims. */
export const MAX_BRAND_BADGES = 3;

export function normaliseBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_BRAND_BADGES);
}
