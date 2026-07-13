/**
 * Recruiting Agent registration number — compact-form derivation
 * (Decision 1, Sprint 006 advertisement-foundation gap-closure).
 *
 * The database always stores the agency's full official registration
 * number as entered at registration (source of truth — never truncated
 * or overwritten). A real example:
 *
 *   RC-B1487/MUM/PART/1000+/9986/2022
 *     B1487  = file number
 *     MUM    = Mumbai POE jurisdiction
 *     PART   = constitution (Partnership)
 *     1000+  = licence capacity category
 *     9986   = the core RC number
 *     2022   = registration year
 *
 * Small, constrained visual areas (the verification badge) show only
 * the core RC number rather than the full string, which would overflow
 * a fixed-size box. This derives that compact form deterministically
 * from the full value, rather than requiring a second stored field —
 * every existing agency's already-compact value (e.g. "9986", with no
 * "/" separators) passes through unchanged, so no backfill/migration of
 * existing data is needed.
 */
export function deriveCompactRegistrationNumber(fullRegistrationNumber: string): string {
  const trimmed = fullRegistrationNumber.trim();
  const segments = trimmed.split("/");
  if (segments.length < 2) return trimmed; // already compact (e.g. "9986") — no separators to parse
  const core = segments[segments.length - 2]; // second-to-last segment: .../<core>/<year>
  return core || trimmed;
}
