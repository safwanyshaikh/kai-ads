/**
 * Compensation Signal Detection (Decision 2, Sprint 006 advertisement-
 * foundation gap-closure).
 *
 * advertisement-type-recommendation.service.ts's `hasSalaryInfo` input
 * was always hardcoded to `false` by its one real caller
 * (advertisement-generation.service.ts) — the recommendation logic had
 * a real, wired input that no caller ever actually computed. This
 * derives the signal from the advertisement's own grounded `benefits`
 * content (the field compensation details are actually stored in — see
 * ADR-006/extraction-result.schema.ts) rather than inferring it from
 * unrelated fields like job title, country, employer, or industry.
 */
const COMPENSATION_PHRASES = [
  "salary",
  "overtime",
  "hourly rate",
  "monthly rate",
  "daily rate",
  "allowance",
  "compensation",
  "wage",
  "pay rate",
  "remuneration",
];
/** Short abbreviations need a word boundary — a bare substring match on "ot" would also match "lot", "not", "overtime" itself, etc. */
const COMPENSATION_ABBREVIATIONS = [/\bot\b/i];

export function detectCompensationSignal(benefits: { label: string; detail?: string }[]): boolean {
  const combined = benefits.map((b) => `${b.label} ${b.detail ?? ""}`).join(" ");
  const lower = combined.toLowerCase();

  return (
    COMPENSATION_PHRASES.some((phrase) => lower.includes(phrase)) ||
    COMPENSATION_ABBREVIATIONS.some((pattern) => pattern.test(combined))
  );
}
