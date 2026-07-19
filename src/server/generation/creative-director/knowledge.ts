/**
 * Creative Director Brain — read-only classification knowledge.
 *
 * This is CLASSIFICATION DATA (destination prestige, currency, industry
 * attractiveness, channel constraints), not tenant data and not printable
 * content. Engines consult it to decide emphasis; nothing here is ever
 * rendered as a factual claim on an advertisement.
 */

import type { Channel, Currency, EmotionalTone, GccPrestige } from "./types";

export interface CountryFact {
  name: string;
  currency: Currency;
  prestige: GccPrestige;
  premiumColour: string;
  emotionalTone: EmotionalTone;
  flagKey: string;
}

/** GCC + common destinations. Extend per new destination (data, not code). */
export const COUNTRIES: CountryFact[] = [
  { name: "Saudi Arabia", currency: "SAR", prestige: "PRIME", premiumColour: "Desert Gold", emotionalTone: "OPPORTUNITY", flagKey: "SA" },
  { name: "United Arab Emirates", currency: "AED", prestige: "PRIME", premiumColour: "Blue + Gold", emotionalTone: "MODERN_CAREER", flagKey: "AE" },
  { name: "Kuwait", currency: "KWD", prestige: "HIGH", premiumColour: "Deep Blue", emotionalTone: "HIGH_INCOME", flagKey: "KW" },
  { name: "Qatar", currency: "QAR", prestige: "HIGH", premiumColour: "Burgundy", emotionalTone: "PREMIUM", flagKey: "QA" },
  { name: "Bahrain", currency: "BHD", prestige: "STABLE", premiumColour: "Red + White", emotionalTone: "STABLE", flagKey: "BH" },
  { name: "Oman", currency: "OMR", prestige: "STABLE", premiumColour: "Forest + Gold", emotionalTone: "STABLE", flagKey: "OM" },
];

/** Aliases → canonical country name (matching is case-insensitive, substring). */
export const COUNTRY_ALIASES: Record<string, string> = {
  ksa: "Saudi Arabia", saudi: "Saudi Arabia", "saudi arabia": "Saudi Arabia",
  uae: "United Arab Emirates", emirates: "United Arab Emirates", dubai: "United Arab Emirates", "abu dhabi": "United Arab Emirates",
  kuwait: "Kuwait", qatar: "Qatar", doha: "Qatar", bahrain: "Bahrain", manama: "Bahrain",
  oman: "Oman", muscat: "Oman",
};

export function resolveCountry(raw: string): CountryFact | null {
  const q = (raw || "").toLowerCase().trim();
  const alias = Object.keys(COUNTRY_ALIASES).find((a) => q.includes(a));
  const name = alias ? COUNTRY_ALIASES[alias] : null;
  if (name) return COUNTRIES.find((c) => c.name === name) ?? null;
  return COUNTRIES.find((c) => q.includes(c.name.toLowerCase())) ?? null;
}

/** Thousands-grouped currency format, e.g. "SAR 12,000". */
export function formatSalary(currency: Currency, amount: number): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export interface IndustryFact {
  keys: RegExp;
  attractiveness: number; // 0..100
  environment: string;
  defaultStory: string;
}

export const INDUSTRIES: IndustryFact[] = [
  { keys: /(oil|gas|petro|refin)/i, attractiveness: 92, environment: "a vast oil & gas refinery at golden hour, towers and pipe racks in warm haze", defaultStory: "REFINERY" },
  { keys: /(offshore|marine|subsea)/i, attractiveness: 88, environment: "an offshore oil & gas platform on open sea", defaultStory: "OFFSHORE_PLATFORM" },
  { keys: /(construct|infrastructure|civil|building)/i, attractiveness: 78, environment: "a large-scale construction site, cranes and rising structures", defaultStory: "CONSTRUCTION" },
  { keys: /(ship|dock|vessel)/i, attractiveness: 74, environment: "a massive shipyard, dry dock and gantry cranes", defaultStory: "SHIPYARD" },
  // Hotel/hospitality checked first: "hospital" is a literal substring of
  // "Hospitality", so the health-care row must not run before this one.
  { keys: /(hotel|hospitality|palace|catering)/i, attractiveness: 82, environment: "a luxury hospitality interior, refined and premium", defaultStory: "HOTEL" },
  { keys: /(hospital|health|medical|nurs)/i, attractiveness: 80, environment: "a modern hospital interior, clean and professional", defaultStory: "HOSPITAL" },
  { keys: /(aviation|airport|airline)/i, attractiveness: 84, environment: "a modern airport terminal, aircraft on the apron", defaultStory: "AIRPORT" },
  { keys: /(manufactur|factory|fmcg|plant)/i, attractiveness: 70, environment: "a modern manufacturing facility, clean production lines", defaultStory: "FACTORY" },
  { keys: /(power|renewable|solar|energy)/i, attractiveness: 80, environment: "a renewable-energy site, solar/turbine field at dawn", defaultStory: "FACTORY" },
];

const GENERIC_INDUSTRY_FALLBACK: IndustryFact = {
  keys: /.*/, attractiveness: 65,
  environment: "a professional industrial facility with strong presence",
  defaultStory: "WORKER_HERO",
};

export function resolveIndustry(raw: string): IndustryFact {
  return INDUSTRIES.find((i) => i.keys.test(raw || "")) ?? GENERIC_INDUSTRY_FALLBACK;
}

/**
 * Playbook §17 ("Industry-specific visual language"): a specific,
 * industry-accurate environment wins whenever classification confidence
 * is high; the generic fallback is "a safety net, not a default
 * preference." Engines cite this to be honest in their trace about
 * whether they matched a real industry or fell back.
 */
export function industryHasConfidentMatch(raw: string): boolean {
  return INDUSTRIES.some((i) => i.keys.test(raw || ""));
}

/**
 * Playbook §8 ("Colour psychology") + Failure Library FL-009/FL-010: "one
 * grading commitment per ad — mixing warm and cool casts in the same
 * frame reads as unresolved." Each destination's LOCKED premium colour
 * (§18) gets one internally-consistent dark tone — warm colours pair with
 * a warm dark tone, cool colours with a cool dark tone — so the engine
 * itself can never generate a warm/cool clash (the exact defect the V12
 * green-cast failure was). Keyed by the exact `premiumColour` strings in
 * COUNTRIES above (data, not a guess), with a neutral fallback for any
 * future country added without a matching entry here.
 */
export const COLOUR_DARK_TONE: Record<string, string> = {
  "Desert Gold": "#2B1B0E", // warm umber/bronze — never the cool navy a "gold" mood should not carry
  "Blue + Gold": "#0C2E63", // cool navy — correct here: the mood NAME itself commits to blue
  "Deep Blue": "#0C2E63",
  "Burgundy": "#6E1023",
  "Red + White": "#5C0A0A", // deep red — was previously falling through to generic charcoal
  "Forest + Gold": "#123D28",
};
export const COLOUR_DARK_TONE_FALLBACK = "#1c1c1e";

/**
 * Employer brand strength — recognition classification (not tenant data).
 * A candidate-magnet brand may lead; an unknown contractor is demoted to a
 * credibility mark. Extend as a data table.
 */
export const MAGNET_EMPLOYERS = /(aramco|adnoc|qatar\s*energy|halliburton|schlumberger|slb|baker\s*hughes|bechtel|siemens|shell|bp|exxon|petrofac|technip|mcdermott)/i;
export const CREDIBLE_EMPLOYERS = /(bilfinger|worley|saipem|larsen|l&t|sisco|nesma|nasser|al\s*yousuf|kentech|descon|galfar)/i;

/** Channel constraints — what must survive per surface. */
export const CHANNEL_CONSTRAINTS: Record<Channel, { mustSurvive: string[]; mayShrink: string[]; columns: number }> = {
  DTP_NEWSPAPER: { mustSurvive: ["HEADLINE", "POSITIONS", "INTERVIEW_OR_ACTION", "SALARY"], mayShrink: ["ADDRESS", "REG_LICENSE", "QR_CAPTION"], columns: 4 },
  SOCIAL_SQUARE: { mustSurvive: ["HEADLINE", "HERO", "SALARY_OR_HOOK", "CTA"], mayShrink: ["REG_LICENSE", "ADDRESS"], columns: 2 },
  LINKEDIN_BANNER: { mustSurvive: ["HEADLINE", "COUNTRY", "CTA"], mayShrink: ["POSITIONS", "ADDRESS", "REG_LICENSE"], columns: 1 },
  WHATSAPP: { mustSurvive: ["HEADLINE", "SALARY_OR_HOOK", "CONTACT"], mayShrink: ["ADDRESS", "REG_LICENSE", "QR_CAPTION"], columns: 2 },
};
