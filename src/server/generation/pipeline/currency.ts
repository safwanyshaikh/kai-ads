/**
 * "Trained modules fundamental": a recruitment advertisement for a known
 * GCC destination must show pay in that destination's real currency —
 * never left unlabeled, and never guessed as USD/"$" by the image model.
 * Applied BEFORE any fact reaches GPT, so the fact itself already carries
 * the correct currency. A figure that already states a currency (source-
 * given) is left completely untouched; this only fills in a currency that
 * was never stated, using the country the recruiter already gave.
 */

interface CountryFact {
  name: string;
  currency: string;
}

/** GCC + common destinations. Extend per new destination (data, not code). */
const COUNTRIES: CountryFact[] = [
  { name: "Saudi Arabia", currency: "SAR" },
  { name: "United Arab Emirates", currency: "AED" },
  { name: "Kuwait", currency: "KWD" },
  { name: "Qatar", currency: "QAR" },
  { name: "Bahrain", currency: "BHD" },
  { name: "Oman", currency: "OMR" },
];

/** Aliases → canonical country name (matching is case-insensitive, substring). */
const COUNTRY_ALIASES: Record<string, string> = {
  ksa: "Saudi Arabia", saudi: "Saudi Arabia", "saudi arabia": "Saudi Arabia",
  uae: "United Arab Emirates", emirates: "United Arab Emirates", dubai: "United Arab Emirates", "abu dhabi": "United Arab Emirates",
  kuwait: "Kuwait", qatar: "Qatar", doha: "Qatar", bahrain: "Bahrain", manama: "Bahrain",
  oman: "Oman", muscat: "Oman",
};

function resolveCountry(raw: string): CountryFact | null {
  const q = (raw || "").toLowerCase().trim();
  const alias = Object.keys(COUNTRY_ALIASES).find((a) => q.includes(a));
  const name = alias ? COUNTRY_ALIASES[alias] : null;
  if (name) return COUNTRIES.find((c) => c.name === name) ?? null;
  return COUNTRIES.find((c) => q.includes(c.name.toLowerCase())) ?? null;
}

const CURRENCY_CODE_PATTERN = /\b(sar|aed|qar|kwd|bhd|omr|usd|inr|php|npr|bdt|lkr|egp)\b|[$₹€£]/i;
/** Bare monetary shorthand with no currency attached, e.g. "5K", "7,000". */
const BARE_MONEY_PATTERN = /\b\d[\d,]*\s*k?\b/i;

export function applyDestinationCurrency(text: string, country: string): string {
  if (CURRENCY_CODE_PATTERN.test(text)) return text; // already has one — never override a given currency
  if (!BARE_MONEY_PATTERN.test(text)) return text; // no monetary figure to label at all
  const resolved = resolveCountry(country);
  if (!resolved) return text; // unknown destination — never guess a currency
  return text.replace(BARE_MONEY_PATTERN, (match, offset: number) => {
    // Only prefix the FIRST bare figure — "5K to 7K" becomes "SAR 5K to 7K",
    // not "SAR 5K to SAR 7K" (the range already shares one currency).
    return offset === text.search(BARE_MONEY_PATTERN) ? `${resolved.currency} ${match}` : match;
  });
}
