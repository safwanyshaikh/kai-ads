/**
 * Critical Legal Language (Sprint 004). These phrases must never appear
 * in generated advertisement text or footer content — checked case-
 * insensitively, checked against every text-bearing section.
 */
const PROHIBITED_PHRASES = [
  "government approved",
  "mea approved",
  "government certified",
  "official mea qr",
  "official government qr",
  "meta approved",
  "facebook approved",
  "whatsapp approved",
  "linkedin approved",
  "platform safe",
  "ban proof",
  "guaranteed reach",
  "guaranteed social media approval",
  "guaranteed approval",
  "no flagging",
  "reduced bans",
];

/** Government Branding Restriction — no imitation of official emblems/seals. */
const PROHIBITED_BRANDING_TERMS = [
  "ashoka emblem",
  "government of india emblem",
  "official mea seal",
  "government insignia",
  "government seal",
];

interface ClaimCheckResult {
  clean: boolean;
  violations: string[];
}

/** Scans arbitrary advertisement text for prohibited claims and unauthorized government-branding references. */
export function detectProhibitedClaims(texts: (string | null | undefined)[]): ClaimCheckResult {
  const combined = texts.filter((t): t is string => Boolean(t)).join(" \n ").toLowerCase();
  const violations: string[] = [];

  for (const phrase of PROHIBITED_PHRASES) {
    if (combined.includes(phrase)) {
      violations.push(`Prohibited claim: "${phrase}"`);
    }
  }
  for (const term of PROHIBITED_BRANDING_TERMS) {
    if (combined.includes(term)) {
      violations.push(`Unauthorized government branding reference: "${term}"`);
    }
  }

  return { clean: violations.length === 0, violations };
}
