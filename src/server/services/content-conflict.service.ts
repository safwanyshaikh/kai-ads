/**
 * CONTENT CONFLICT DETECTION.
 *
 * Recruitment facts arrive from two places at once: the documents the
 * tenant uploaded, and the free text they typed alongside them. Those
 * two can disagree — a PDF quoting SAR 1,300 and a correction in the
 * text box saying SAR 1,400 is an ordinary Tuesday, not an edge case.
 *
 * The system must not settle that quietly. Preferring the document
 * silently discards the tenant's correction; preferring the text
 * silently discards the client's own paperwork. Either way an
 * advertisement goes out carrying a number nobody chose, and the
 * provenance of that number is gone by the time anyone notices.
 *
 * So disagreements become visible items the tenant resolves before the
 * content can be approved. This module only DETECTS them; resolution is
 * the tenant's, and the review screen's.
 */

/** Where a candidate value came from, so the tenant can judge it. */
export type ContentFactSource = "DOCUMENT" | "FREE_TEXT";

export interface ContentFactCandidate {
  value: string;
  source: ContentFactSource;
  /** The attachment or field it was read from, when known. */
  origin?: string | null;
}

export interface ContentConflict {
  /** Dotted path into the structured content, e.g. "positions.0.salary". */
  field: string;
  /** Human label for the review screen. */
  label: string;
  candidates: ContentFactCandidate[];
}

/**
 * Fields worth reconciling.
 *
 * Deliberately not "every field". A conflict prompt has a cost — it
 * stops the tenant and asks them to adjudicate — so it is spent on the
 * facts where being wrong is expensive: money, dates, places, and the
 * ways a candidate reaches the agency. Cosmetic disagreements about an
 * industry label are resolved by the tenant editing the draft, which
 * they can do anyway.
 */
const RECONCILED_FIELDS: { field: string; label: string }[] = [
  { field: "salary", label: "Salary" },
  { field: "currency", label: "Currency" },
  { field: "foodAllowance", label: "Food allowance" },
  { field: "overtime", label: "Overtime" },
  { field: "workingHours", label: "Working hours" },
  { field: "experience", label: "Experience required" },
  { field: "interviewDate", label: "Interview date" },
  { field: "interviewLocation", label: "Interview location" },
  { field: "joiningDate", label: "Joining date" },
  { field: "contactPhone", label: "Contact number" },
  { field: "contactEmail", label: "Contact email" },
  { field: "address", label: "Address" },
  { field: "clientName", label: "Client" },
  { field: "country", label: "Country" },
];

/**
 * Normalises a value for COMPARISON only.
 *
 * Never for storage: the tenant sees, and the advertisement prints,
 * exactly what the source said. This decides whether two spellings are
 * the same fact — "SAR 1,300" and "SAR 1300" are, and prompting about
 * them would train the tenant to click through conflict screens without
 * reading, which is worse than not detecting anything.
 */
function comparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s,]/g, "")
    // Currency and separator noise around the same amount.
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function present(value: unknown): value is string | number {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Compares facts extracted from documents against facts from free text.
 *
 * Both sides are the extractor's own output for the same field, so this
 * makes no judgement about which is correct — that is precisely the
 * judgement it refuses to make on the tenant's behalf.
 */
export function detectContentConflicts(
  fromDocuments: Record<string, unknown> | null | undefined,
  fromFreeText: Record<string, unknown> | null | undefined,
): ContentConflict[] {
  if (!fromDocuments || !fromFreeText) return [];

  const conflicts: ContentConflict[] = [];

  for (const { field, label } of RECONCILED_FIELDS) {
    const documentValue = fromDocuments[field];
    const freeTextValue = fromFreeText[field];

    // A fact present in only one source is not a conflict — it is the
    // other source having nothing to say, which is the ordinary case.
    if (!present(documentValue) || !present(freeTextValue)) continue;

    const a = String(documentValue);
    const b = String(freeTextValue);
    if (comparable(a) === comparable(b)) continue;

    conflicts.push({
      field,
      label,
      candidates: [
        { value: a, source: "DOCUMENT" },
        { value: b, source: "FREE_TEXT" },
      ],
    });
  }

  return conflicts;
}

/**
 * True when every detected conflict has been resolved in the reviewed
 * content.
 *
 * "Resolved" means the reviewed value matches one of the candidates the
 * tenant was offered, or is something they typed themselves — anything
 * except still being ambiguous. The gate is deliberately permissive
 * about WHICH value wins: the tenant may reject both and enter a third,
 * because the documents and the text can both be out of date.
 */
export function conflictsResolved(
  conflicts: ContentConflict[],
  reviewed: Record<string, unknown> | null | undefined,
): boolean {
  if (conflicts.length === 0) return true;
  if (!reviewed) return false;
  return conflicts.every((conflict) => present(reviewed[conflict.field]));
}
