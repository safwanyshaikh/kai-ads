import type { SignalStrength, TaxonomyEntry } from "./taxonomy";

/**
 * JobOrder Intelligence — deterministic signal matching.
 *
 * The engine's evidence layer. Every determination is made by matching
 * taxonomy phrases against the requirement's own recorded text and
 * reporting exactly which phrases fired and where.
 *
 * Nothing here calls a model, reads a clock, or uses randomness. The same
 * JobOrder always produces the same signals in the same order, so a
 * determination made today can be replayed and defended a year from now.
 */

/** Where a signal was found. Named so a determination can cite it. */
export type SignalOrigin =
  | "position title"
  | "qualification"
  | "requirement title"
  | "employer name"
  | "project"
  | "industry field"
  | "source text";

export interface SignalHit {
  /** The taxonomy phrase that matched, verbatim. */
  phrase: string;
  strength: SignalStrength;
  origin: SignalOrigin;
  /**
   * The text it matched inside, trimmed for display — this is what a
   * recruiter is shown as evidence, e.g. "Analyzer Technician".
   */
  excerpt: string;
}

/** One labelled piece of the requirement's text, searchable by the matcher. */
export interface CorpusEntry {
  origin: SignalOrigin;
  text: string;
}

/**
 * Everything this engine is allowed to read.
 *
 * Assembled by the service from the requirement's own records. There is
 * no other input: the engine never reaches outside the JobOrder it was
 * asked about, so a determination can always be traced to something the
 * agency actually received.
 */
export interface SignalCorpus {
  entries: CorpusEntry[];
  /** Position titles kept separately — trade categorization reads only these. */
  positionTitles: string[];
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whole-phrase matching.
 *
 * Bounded on both sides so "lng" cannot match inside "challenging" and
 * "marine" cannot match inside "submarine". Word boundaries are defined
 * against letters and digits rather than \b, because taxonomy phrases
 * legitimately contain "&", "/" and "-" ("oil & gas", "qa/qc", "6g").
 */
function phraseMatches(haystack: string, phrase: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Trims a matched entry down to something readable as evidence. */
function excerptFor(text: string, phrase: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 80) return collapsed;

  const index = collapsed.toLowerCase().indexOf(phrase.toLowerCase());
  if (index === -1) return `${collapsed.slice(0, 77)}...`;

  const start = Math.max(0, index - 30);
  const end = Math.min(collapsed.length, index + phrase.length + 30);
  return `${start > 0 ? "..." : ""}${collapsed.slice(start, end).trim()}${end < collapsed.length ? "..." : ""}`;
}

/**
 * Finds every taxonomy phrase for one candidate value across the corpus.
 *
 * Only the FIRST occurrence of each phrase counts. A demand letter that
 * says "shutdown" nine times is not nine independent pieces of evidence,
 * and counting it as such would let one repeated word manufacture
 * certainty out of nothing.
 */
export function findSignals<T extends string>(
  entry: TaxonomyEntry<T>,
  corpus: CorpusEntry[],
): SignalHit[] {
  const hits: SignalHit[] = [];
  const seen = new Set<string>();

  const scan = (phrases: string[], strength: SignalStrength) => {
    for (const phrase of phrases) {
      if (seen.has(phrase)) continue;
      for (const item of corpus) {
        if (phraseMatches(normalize(item.text), phrase)) {
          hits.push({ phrase, strength, origin: item.origin, excerpt: excerptFor(item.text, phrase) });
          seen.add(phrase);
          break;
        }
      }
    }
  };

  scan(entry.strong, "STRONG");
  scan(entry.weak, "WEAK");

  return hits;
}

export interface ScoredCandidate<T extends string> {
  value: T;
  hits: SignalHit[];
  strongCount: number;
  weakCount: number;
  confidencePct: number;
}

/**
 * Confidence as a fixed ladder, not a formula.
 *
 * A ladder is auditable: a recruiter asking "why 92%?" gets "two strong
 * signals fired", not an arithmetic derivation nobody can check. The
 * rungs encode one judgement — a single weak signal is never enough to
 * decide anything, which is what keeps the engine returning UNKNOWN
 * instead of guessing.
 *
 * Nothing reaches 100: this is inference from wording, and wording can
 * always be wrong.
 */
export function confidenceFor(strongCount: number, weakCount: number): number {
  if (strongCount >= 3) return 98;
  if (strongCount === 2 && weakCount >= 1) return 95;
  if (strongCount === 2) return 92;
  if (strongCount === 1 && weakCount >= 2) return 85;
  if (strongCount === 1 && weakCount === 1) return 78;
  if (strongCount === 1) return 70;
  if (weakCount >= 4) return 66;
  if (weakCount === 3) return 62;
  if (weakCount === 2) return 55;
  return weakCount === 1 ? 30 : 0;
}

/** Below this, the engine reports UNKNOWN rather than a value. */
export const CONFIDENCE_THRESHOLD = 50;

/**
 * Scores every candidate value and returns them best-first.
 *
 * Ordering is a total order — confidence, then strong hits, then weak
 * hits, then the value's own name — so two candidates that tie on
 * evidence still resolve identically on every run.
 */
export function scoreCandidates<T extends string>(
  entries: TaxonomyEntry<T>[],
  corpus: CorpusEntry[],
): ScoredCandidate<T>[] {
  return entries
    .map((entry) => {
      const hits = findSignals(entry, corpus);
      const strongCount = hits.filter((hit) => hit.strength === "STRONG").length;
      const weakCount = hits.filter((hit) => hit.strength === "WEAK").length;
      return { value: entry.value, hits, strongCount, weakCount, confidencePct: confidenceFor(strongCount, weakCount) };
    })
    .filter((candidate) => candidate.hits.length > 0)
    .sort(
      (a, b) =>
        b.confidencePct - a.confidencePct ||
        b.strongCount - a.strongCount ||
        b.weakCount - a.weakCount ||
        a.value.localeCompare(b.value),
    );
}
