/**
 * Requirement Intelligence — deterministic normalization.
 *
 * Task 002 rule: "Every normalization must be deterministic."
 *
 * Nothing in this file calls a model, reads a clock, uses randomness, or
 * touches I/O. The same input always produces the same output, forever.
 * That is what makes a normalized value auditable: when a recruiter asks
 * why the system says "Saudi Arabia" for a source that said "KSA", the
 * answer is a rule in this file, not a model's mood on the day.
 *
 * THE ONE LAW HERE: normalization may only ever CANONICALIZE a value the
 * source actually stated. It may never invent, infer, upgrade or complete
 * a value. Every function returns the verbatim original alongside the
 * canonical form, and returns `null` rather than guessing. A normalizer
 * that cannot confidently canonicalize hands back the raw text unchanged
 * — losing tidiness is acceptable, losing truth is not.
 */

import { normalizePositionTitle } from "@/lib/normalize-entity-name";
import { applyDestinationCurrency } from "@/server/generation/pipeline/currency";

/** The outcome of one deterministic rule. */
export interface NormalizationOutcome<T> {
  /** Canonical value, or null when the rule could not canonicalize. */
  value: T | null;
  /** Exactly what the source said, always preserved. */
  raw: string | null;
  /** True when the rule actually changed something. */
  changed: boolean;
  /** Why this outcome — quoted verbatim into the field's provenance reason. */
  reason: string;
}

function outcome<T>(value: T | null, raw: string | null, changed: boolean, reason: string): NormalizationOutcome<T> {
  return { value, raw, changed, reason };
}

const clean = (raw: string | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
};

// ---------------------------------------------------------------------------
// Destination country
// ---------------------------------------------------------------------------

/**
 * Canonical destination names and the aliases recruiters actually type.
 *
 * Deliberately broader than the GCC currency table in
 * generation/pipeline/currency.ts: that one exists to LABEL money at
 * render time and only needs currencies; this one exists to canonicalize
 * the destination of a requirement, including corridors that have no
 * entry there. Currency labelling itself is not reimplemented here — it
 * delegates to applyDestinationCurrency (see normalizeSalaryText).
 *
 * Data, not code: a new corridor is a new row.
 */
const DESTINATIONS: { canonical: string; aliases: string[] }[] = [
  { canonical: "Saudi Arabia", aliases: ["ksa", "saudi", "saudi arabia", "kingdom of saudi arabia", "k.s.a", "jeddah", "riyadh", "dammam", "jubail", "yanbu"] },
  { canonical: "United Arab Emirates", aliases: ["uae", "u.a.e", "emirates", "united arab emirates", "dubai", "abu dhabi", "sharjah", "ajman", "ras al khaimah"] },
  { canonical: "Qatar", aliases: ["qatar", "doha"] },
  { canonical: "Kuwait", aliases: ["kuwait", "kuwait city"] },
  { canonical: "Bahrain", aliases: ["bahrain", "manama"] },
  { canonical: "Oman", aliases: ["oman", "muscat", "sohar", "salalah"] },
  { canonical: "Malaysia", aliases: ["malaysia", "kuala lumpur"] },
  { canonical: "Singapore", aliases: ["singapore"] },
  { canonical: "Romania", aliases: ["romania", "bucharest"] },
  { canonical: "Poland", aliases: ["poland", "warsaw"] },
  { canonical: "Croatia", aliases: ["croatia", "zagreb"] },
  { canonical: "Japan", aliases: ["japan", "tokyo"] },
  { canonical: "Israel", aliases: ["israel", "tel aviv"] },
  { canonical: "Maldives", aliases: ["maldives", "male"] },
  { canonical: "Mauritius", aliases: ["mauritius"] },
];

/**
 * Canonicalizes a destination. Matching is whole-word against the
 * lowercased source, longest alias first, so "Ras Al Khaimah" wins over
 * a stray "uae" appearing elsewhere in the same string.
 *
 * Returns the raw value unchanged when no alias matches — an unknown
 * destination is recorded exactly as the source wrote it and flagged,
 * never dropped and never guessed at.
 */
export function normalizeDestinationCountry(raw: string | null | undefined): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No destination was stated in the source.");

  const haystack = value.toLowerCase();
  const candidates = DESTINATIONS.flatMap((d) => d.aliases.map((alias) => ({ alias, canonical: d.canonical })))
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const candidate of candidates) {
    // Whole-word match: "oman" must not match inside "Romania".
    const pattern = new RegExp(`(^|[^a-z])${candidate.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (pattern.test(haystack)) {
      const changed = candidate.canonical !== value;
      return outcome(
        candidate.canonical,
        value,
        changed,
        changed
          ? `Source said "${value}"; matched the known destination alias "${candidate.alias}" and canonicalized to "${candidate.canonical}".`
          : `Source stated "${value}", already the canonical destination name.`,
      );
    }
  }

  return outcome(
    value,
    value,
    false,
    `Source said "${value}", which matches no known destination — kept exactly as written rather than guessed.`,
  );
}

// ---------------------------------------------------------------------------
// Headcount
// ---------------------------------------------------------------------------

/** Trailing/leading count noise recruiters write around a number. */
const COUNT_NOISE = /\b(nos?|no\.|pax|persons?|positions?|vacancies|vacancy|candidates?|qty|quantity|x)\b/gi;

/**
 * Extracts a headcount from text like "15", "15 Nos", "Qty: 15", "x15".
 *
 * Refuses anything ambiguous. "10-15" is a RANGE, and silently picking
 * either end would misstate demand on a public advertisement, so it
 * returns null with a reason instead. A recruiter correcting one field is
 * a far better outcome than an advertisement that promises the wrong
 * number of jobs.
 */
export function normalizeHeadcount(raw: string | number | null | undefined): NormalizationOutcome<number> {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
      return outcome<number>(null, String(raw), false, `Headcount "${raw}" is not a positive whole number — recorded as unknown.`);
    }
    return outcome(raw, String(raw), false, `Source stated a numeric headcount of ${raw}.`);
  }

  const value = clean(raw);
  if (!value) return outcome<number>(null, null, false, "No headcount was stated for this position.");

  // A range or a list of numbers is ambiguous — never resolve it silently.
  if (/\d\s*(?:-|–|—|to|\/)\s*\d/i.test(value)) {
    return outcome<number>(null, value, false, `Source gave a range ("${value}") rather than one headcount — left unknown rather than picking an end of the range.`);
  }

  const stripped = value.replace(COUNT_NOISE, " ").replace(/[:,]/g, " ");
  const digits = stripped.match(/\d+/g);
  if (!digits || digits.length === 0) {
    return outcome<number>(null, value, false, `No number could be read from "${value}" — headcount recorded as unknown.`);
  }
  if (digits.length > 1) {
    return outcome<number>(null, value, false, `"${value}" contains more than one number — left unknown rather than choosing between them.`);
  }

  const parsed = Number.parseInt(digits[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return outcome<number>(null, value, false, `"${value}" did not yield a positive headcount — recorded as unknown.`);
  }

  const changed = String(parsed) !== value;
  return outcome(
    parsed,
    value,
    changed,
    changed ? `Read headcount ${parsed} from "${value}".` : `Source stated a headcount of ${parsed}.`,
  );
}

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

/**
 * Canonicalizes salary TEXT. The figure is never parsed into a number and
 * never converted between currencies — a salary on a recruitment
 * advertisement is a promise, and the only safe version of it is the one
 * the employer actually wrote.
 *
 * The single transformation applied is labelling a bare figure with the
 * destination's currency, delegated to the existing
 * applyDestinationCurrency rule so there is exactly one implementation of
 * that behaviour in the codebase.
 */
export function normalizeSalaryText(
  raw: string | null | undefined,
  destinationCountry: string | null | undefined,
): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No salary was stated for this position.");

  const country = clean(destinationCountry);
  if (!country) {
    return outcome(value, value, false, `Salary kept verbatim as "${value}" — no destination was known, so no currency could be attached.`);
  }

  const labelled = applyDestinationCurrency(value, country);
  if (labelled === value) {
    return outcome(value, value, false, `Salary kept verbatim as "${value}" — it already states a currency, or contains no bare figure to label.`);
  }

  return outcome(
    labelled,
    value,
    true,
    `Source said "${value}" with no currency; the destination is ${country}, so the figure was labelled as "${labelled}". The amount itself is unchanged.`,
  );
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

/**
 * Canonicalizes an experience requirement's wording without changing what
 * it demands. "min 5 yrs" and "5+ Years" both mean the same thing to a
 * candidate; storing both verbatim makes them two different requirements
 * to every query that follows.
 */
export function normalizeExperienceText(raw: string | null | undefined): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No experience requirement was stated for this position.");

  const canonical = value
    .replace(/\byrs?\b/gi, "years")
    .replace(/\byear\b/gi, "years")
    .replace(/\bexp\b/gi, "experience")
    .replace(/\bmin(imum)?\b/gi, "minimum")
    .replace(/\s+/g, " ")
    .trim();

  const changed = canonical !== value;
  return outcome(
    canonical,
    value,
    changed,
    changed
      ? `Source said "${value}"; expanded standard abbreviations to "${canonical}" without changing the requirement.`
      : `Source stated "${value}".`,
  );
}

// ---------------------------------------------------------------------------
// Trade title
// ---------------------------------------------------------------------------

/**
 * Trade acronyms and certifications that are genuinely uppercase.
 *
 * Data, not code: a new certification is a new entry. This list exists
 * because the alternative — "an all-caps word is an acronym" — is wrong
 * in the most common case there is. Recruiters type entire titles in
 * caps ("SENIOR PIPE FITTER"), and treating that as three acronyms
 * defeats the whole point of canonicalizing the title.
 */
const TRADE_ACRONYMS = new Set([
  "QC", "QA", "QAQC", "HVAC", "CSWIP", "NDT", "ITI", "HSE", "MEP", "PLC", "CNC",
  "TIG", "MIG", "ARC", "PPE", "API", "ASME", "AWS", "BOSIET", "IOSH", "NEBOSH",
  "DG", "HT", "LT", "AC", "RO", "GRP", "PVC", "HDPE", "HGV", "LMV", "HMV",
]);

const ROMAN_NUMERAL = /^(?:[IVX]{1,5})$/;

/**
 * Canonicalizes a trade title's presentation only.
 *
 * The aggregation key is NOT computed here — it comes from
 * normalizePositionTitle (Task 001), so the permanent business domain and
 * Requirement Intelligence group trades by exactly one rule.
 *
 * Casing is normalized to Title Case because "WELDER", "welder" and
 * "Welder" are one trade and shouting is not a job requirement. Genuine
 * acronyms survive by three routes: a known trade acronym, a Roman
 * numeral grade, or an all-caps token inside an otherwise mixed-case
 * title (which is a real acronym, not shouting).
 */
export function normalizeTradeTitle(raw: string | null | undefined): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No position title was stated.");

  // A wholly uppercase title is shouting; an uppercase token inside a
  // mixed-case title is an acronym. This distinction is the whole rule.
  const isShouted = value === value.toUpperCase() && /[A-Z]/.test(value);

  const canonical = value
    .split(" ")
    .map((word) => {
      const bare = word.replace(/[^A-Za-z0-9]/g, "");
      if (TRADE_ACRONYMS.has(bare.toUpperCase())) return word.toUpperCase();
      if (ROMAN_NUMERAL.test(bare.toUpperCase()) && bare.length > 0) return word.toUpperCase();
      // Grades and codes: "3G", "6G", "3.1".
      if (/\d/.test(word)) return isShouted ? word.toUpperCase() : word;
      if (!isShouted && /^[A-Z]{2,}$/.test(bare)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  const changed = canonical !== value;
  return outcome(
    canonical,
    value,
    changed,
    changed
      ? `Source said "${value}"; presented as "${canonical}". Grouping key is "${normalizePositionTitle(value)}".`
      : `Source stated "${value}". Grouping key is "${normalizePositionTitle(value)}".`,
  );
}

// ---------------------------------------------------------------------------
// Contact details
// ---------------------------------------------------------------------------

/**
 * Canonicalizes a phone number's punctuation without ever changing its
 * digits or inventing a country code. A dialling code that was not in the
 * source is not added: a wrong number on a public advertisement sends
 * candidates to a stranger.
 */
export function normalizePhone(raw: string | null | undefined): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No phone number was stated in the source.");

  const hasPlus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) {
    return outcome(value, value, false, `"${value}" has too few digits to be a phone number — kept verbatim rather than corrected.`);
  }

  const canonical = `${hasPlus ? "+" : ""}${digits}`;
  const changed = canonical !== value;
  return outcome(
    canonical,
    value,
    changed,
    changed
      ? `Source said "${value}"; punctuation removed to "${canonical}". No country code was added and no digit was changed.`
      : `Source stated "${value}".`,
  );
}

/** Lowercases an email address. Nothing else — the local part is case-sensitive by spec, but no real mailbox relies on it. */
export function normalizeEmail(raw: string | null | undefined): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No email address was stated in the source.");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return outcome(value, value, false, `"${value}" is not a well-formed email address — kept verbatim rather than corrected.`);
  }

  const canonical = value.toLowerCase();
  const changed = canonical !== value;
  return outcome(canonical, value, changed, changed ? `Source said "${value}"; lowercased to "${canonical}".` : `Source stated "${value}".`);
}

// ---------------------------------------------------------------------------
// Interview date
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/**
 * Canonicalizes an interview date ONLY when it is unambiguous.
 *
 * Purely numeric dates are deliberately refused: "05/06/2026" is 5 June
 * to an Indian recruiter and 6 May to an American one, and a candidate
 * who travels to an interview on the wrong day has lost a day's wage and
 * a job. Named months ("14 August 2026") are unambiguous and are
 * canonicalized; everything else is kept verbatim with the ambiguity
 * stated in the reason.
 *
 * No year is inferred. A date with no year stays partial rather than
 * being silently assigned to the current one.
 */
export function normalizeInterviewDate(raw: string | null | undefined): NormalizationOutcome<string> {
  const value = clean(raw);
  if (!value) return outcome<string>(null, null, false, "No interview date was stated in the source.");

  if (/^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}$/.test(value)) {
    return outcome(
      value,
      value,
      false,
      `"${value}" is all digits, so day-month order cannot be determined (05/06 is 5 June or 6 May depending on convention) — kept exactly as written rather than risk sending candidates on the wrong day.`,
    );
  }

  const match = value.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?\s*(\d{4})?\b/i);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = MONTHS[match[2].toLowerCase()];
    const year = match[3];
    if (month && day >= 1 && day <= 31) {
      const canonical = year
        ? `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        : `--${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return outcome(
        canonical,
        value,
        true,
        year
          ? `Source said "${value}", an unambiguous named-month date; canonicalized to ${canonical}.`
          : `Source said "${value}", which names a month and day but no year; canonicalized to ${canonical} without inferring a year.`,
      );
    }
  }

  return outcome(value, value, false, `"${value}" is not a date this rule can read unambiguously — kept exactly as written.`);
}
