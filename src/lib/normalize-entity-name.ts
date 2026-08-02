/**
 * De-duplication keys for the permanent business domain (Task 001).
 *
 * Employers and trades arrive as free text, typed by different
 * recruiters on different days and extracted from documents of wildly
 * varying quality. "ABC Contracting", "abc  contracting" and
 * " ABC Contracting " are one employer, and an agency that sees three is
 * an agency with no employer memory at all.
 *
 * These functions produce the grouping key ONLY. The original text is
 * always stored alongside it and is always what gets displayed or
 * rendered — normalizing for display would silently rewrite what the
 * source document said, which the Factual Integrity Law forbids.
 *
 * The rule is deliberately conservative: case-fold, collapse whitespace,
 * trim. Nothing is transliterated, stemmed, abbreviated or spell-
 * corrected, because every one of those would merge two genuinely
 * different employers eventually, and a wrongly merged employer history
 * is worse than a duplicated one.
 *
 * IMPORTANT: the backfill in
 * prisma/migrations/20260802000000_job_order_domain/migration.sql
 * reproduces this exact rule in SQL. The two must stay identical, or
 * rows written before and after the migration will group differently.
 */

/**
 * Collapses internal whitespace runs to a single space and trims,
 * WITHOUT case-folding.
 *
 * This is the canonical *display* form: "ABC   Contracting" and
 * "ABC Contracting" are the same employer written with a stray keystroke,
 * and storing both spellings would split the employer's history for a
 * reason no recruiter would ever accept as real. Case is left exactly as
 * the source wrote it, because capitalisation can be genuine
 * (e.g. "ADNOC" vs "Adnoc Logistics").
 */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Case-folds, collapses internal whitespace runs to a single space, and
 * trims. Returns "" for input that is empty or whitespace-only.
 */
export function normalizeEntityName(value: string): string {
  return collapseWhitespace(value).toLowerCase();
}

/**
 * Employer de-duplication key. Returns null when the source carried no
 * usable employer name, so the JobOrder is linked to no employer at all
 * rather than to an employer called "".
 */
export function normalizeEmployerName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeEntityName(value);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Trade/position aggregation key. Positions always have a title (the
 * validation layer requires it), so this returns "" rather than null for
 * unusable input and the caller keeps the row — a position with an odd
 * title is still a real vacancy and must never be dropped.
 */
export function normalizePositionTitle(value: string): string {
  return normalizeEntityName(value);
}
