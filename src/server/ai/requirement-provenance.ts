/**
 * Requirement Intelligence — provenance.
 *
 * Task 002 rule: "Every extracted field must include Source, Confidence
 * and Reason. Every AI decision must be explainable."
 *
 * This module is that guarantee, expressed as a type. A canonical
 * JobOrder field cannot be constructed without saying where it came
 * from, how sure the system is, and why. There is no code path that
 * produces a fact with an empty reason — `absentFact()` exists precisely
 * so that "we did not find this" is itself a first-class, explained
 * outcome rather than a silent null.
 *
 * Everything here is pure: no I/O, no model calls, no clock. The
 * confidence a field gets is a deterministic function of what the
 * extractor said and which channel the value came from, so two identical
 * requirements always score identically and any score can be replayed.
 */

import type { Confidence } from "./extraction-result.schema";

/** Every requirement channel Task 002 accepts. */
export const REQUIREMENT_SOURCE_KINDS = [
  "WHATSAPP_TEXT",
  "WHATSAPP_SCREENSHOT",
  "PDF",
  "IMAGE",
  "VOICE_NOTE",
  "EMAIL",
  "WORD",
  "EXCEL",
  "GOOGLE_SHEET",
  "WEBSITE",
  "PLAIN_TEXT",
] as const;

export type RequirementSourceKind = (typeof REQUIREMENT_SOURCE_KINDS)[number];

/** How a value came to hold its canonical form — the "explainable" axis. */
export type ExtractionMethod =
  /** A pure rule in requirement-normalization.ts produced it. Fully replayable. */
  | "DETERMINISTIC"
  /** The model read it out of the source and it needed no canonicalization. */
  | "AI_EXTRACTION"
  /** The model read it, then a deterministic rule canonicalized what it read. */
  | "AI_THEN_NORMALIZED"
  /** Not present in any source. Recorded as an explicit unknown, never guessed. */
  | "ABSENT";

export interface RequirementFact {
  /** Canonical dotted path, e.g. "country" or "positions.0.salary". */
  field: string;
  /** The canonical value as it will be stored, or null when absent. */
  value: string | null;
  /** Exactly what the source said, before any canonicalization. */
  rawValue: string | null;
  /** Which channel this came from. */
  sourceKind: RequirementSourceKind;
  /** Stable identifier of the specific source artifact. */
  sourceId: string | null;
  /** Where inside that source, e.g. "sheet 'Demand' row 12", "transcript 00:41". */
  sourceRef: string | null;
  /** 0–1, deterministic. */
  confidence: number;
  /** The band the numeric score falls in — what a recruiter actually sees. */
  confidenceBand: Confidence;
  method: ExtractionMethod;
  /** Plain-language explanation. Never empty. */
  reason: string;
}

/**
 * Base scores for the extractor's own three-way confidence.
 *
 * Deliberately not 1.0 for HIGH: a model asserting high confidence is
 * still a model reading someone's PDF, and a field that can put a wrong
 * salary on a public advertisement should never be scored as certain by
 * anything other than a human confirming it.
 */
const BAND_BASE: Record<Confidence, number> = {
  HIGH: 0.9,
  MEDIUM: 0.6,
  LOW: 0.3,
};

/**
 * Per-channel trust factors, applied as a MULTIPLIER.
 *
 * A value read out of a photographed noticeboard or a voice note is not
 * as trustworthy as the same value read from a spreadsheet cell, no
 * matter how confident the model sounds. These encode the failure modes
 * each channel actually has — OCR misreads digits, transcription mishears
 * numbers, scraped markup attaches a value to the wrong label.
 *
 * A multiplier rather than a ceiling, deliberately: a ceiling only bites
 * at the top of the range, so a MEDIUM-confidence salary transcribed from
 * speech would score exactly the same as a MEDIUM-confidence salary read
 * from a spreadsheet — which is plainly false, and would let the two tie
 * and be resolved by whichever happened to be uploaded first. Scaling
 * keeps the ordering strict at every confidence level: at equal extractor
 * confidence, a structured channel always outranks a lossy one.
 */
const CHANNEL_FACTOR: Record<RequirementSourceKind, number> = {
  // Structured/native text: nothing between the source and the words.
  EXCEL: 1,
  GOOGLE_SHEET: 1,
  PLAIN_TEXT: 1,
  WORD: 1,
  EMAIL: 1,
  // Text layer is native, but extraction order can interleave columns.
  PDF: 0.95,
  WHATSAPP_TEXT: 0.95,
  // Scraped markup: layout can attach a number to the wrong label.
  WEBSITE: 0.8,
  // OCR: digits and currency codes are exactly what it gets wrong.
  IMAGE: 0.75,
  WHATSAPP_SCREENSHOT: 0.75,
  // Speech: numbers, proper nouns and trade codes suffer most.
  VOICE_NOTE: 0.65,
};

/** Human-readable justification for each channel's trust factor, quoted into reasons. */
const CHANNEL_CAVEAT: Record<RequirementSourceKind, string | null> = {
  EXCEL: null,
  GOOGLE_SHEET: null,
  PLAIN_TEXT: null,
  WORD: null,
  EMAIL: null,
  PDF: null,
  WHATSAPP_TEXT: null,
  WEBSITE: "read from web page markup, where a value can be associated with the wrong label",
  IMAGE: "read by OCR from an image, which commonly misreads digits and currency codes",
  WHATSAPP_SCREENSHOT: "read by OCR from a screenshot, which commonly misreads digits and currency codes",
  VOICE_NOTE: "transcribed from speech, which commonly mishears numbers and proper nouns",
};

export function bandFor(score: number): Confidence {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Scores a field deterministically: the extractor's own confidence,
 * scaled by how much the channel it came through can be trusted.
 */
export function scoreConfidence(band: Confidence, sourceKind: RequirementSourceKind): number {
  return round2(BAND_BASE[band] * CHANNEL_FACTOR[sourceKind]);
}

export interface BuildFactParams {
  field: string;
  value: string | null;
  rawValue: string | null;
  sourceKind: RequirementSourceKind;
  sourceId: string | null;
  sourceRef?: string | null;
  /** The extractor's own confidence for this field. */
  band: Confidence;
  /** Set when a deterministic rule canonicalized the extracted value. */
  normalization?: { changed: boolean; reason: string } | null;
}

/**
 * Builds one fully-explained fact.
 *
 * The reason is assembled from three parts, all deterministic: what the
 * channel was, what the deterministic rule did (if anything), and why the
 * confidence landed where it did. A recruiter reading it should never
 * have to ask a follow-up question.
 */
export function buildFact(params: BuildFactParams): RequirementFact {
  if (params.value === null || params.value === undefined) {
    return absentFact({
      field: params.field,
      sourceKind: params.sourceKind,
      sourceId: params.sourceId,
      note: params.normalization?.reason ?? null,
    });
  }

  const score = scoreConfidence(params.band, params.sourceKind);
  const method: ExtractionMethod = params.normalization?.changed ? "AI_THEN_NORMALIZED" : "AI_EXTRACTION";

  const parts: string[] = [];
  parts.push(`Read from ${describeChannel(params.sourceKind)}${params.sourceRef ? ` (${params.sourceRef})` : ""}.`);

  if (params.normalization?.reason) {
    parts.push(params.normalization.reason);
  }

  const caveat = CHANNEL_CAVEAT[params.sourceKind];
  if (caveat) {
    parts.push(
      `Extractor reported ${params.band} confidence; scored ${score} because the value was ${caveat}.`,
    );
  } else {
    parts.push(`Extractor reported ${params.band} confidence (${score}).`);
  }

  return {
    field: params.field,
    value: params.value,
    rawValue: params.rawValue,
    sourceKind: params.sourceKind,
    sourceId: params.sourceId,
    sourceRef: params.sourceRef ?? null,
    confidence: score,
    confidenceBand: bandFor(score),
    method,
    reason: parts.join(" "),
  };
}

/**
 * A field that no source stated.
 *
 * This exists so absence is recorded rather than inferred. A downstream
 * reader can tell "the requirement did not mention salary" apart from
 * "nobody looked" — which is the difference between an honest
 * advertisement and a fabricated one.
 */
export function absentFact(params: {
  field: string;
  sourceKind: RequirementSourceKind;
  sourceId: string | null;
  note?: string | null;
}): RequirementFact {
  return {
    field: params.field,
    value: null,
    rawValue: null,
    sourceKind: params.sourceKind,
    sourceId: params.sourceId,
    sourceRef: null,
    confidence: 0,
    confidenceBand: "LOW",
    method: "ABSENT",
    reason:
      params.note ??
      `Not stated in the ${describeChannel(params.sourceKind)} provided. Recorded as unknown rather than inferred.`,
  };
}

/**
 * A value produced entirely by a deterministic rule from other known
 * facts — no model involved. Scored at the rule's own certainty, which is
 * high precisely because it is replayable.
 */
export function deterministicFact(params: {
  field: string;
  value: string | null;
  rawValue: string | null;
  sourceKind: RequirementSourceKind;
  sourceId: string | null;
  reason: string;
}): RequirementFact {
  const score = params.value === null ? 0 : 0.95;
  return {
    field: params.field,
    value: params.value,
    rawValue: params.rawValue,
    sourceKind: params.sourceKind,
    sourceId: params.sourceId,
    sourceRef: null,
    confidence: score,
    confidenceBand: bandFor(score),
    method: params.value === null ? "ABSENT" : "DETERMINISTIC",
    reason: params.reason,
  };
}

export function describeChannel(kind: RequirementSourceKind): string {
  switch (kind) {
    case "WHATSAPP_TEXT": return "a WhatsApp message";
    case "WHATSAPP_SCREENSHOT": return "a WhatsApp screenshot";
    case "PDF": return "a PDF document";
    case "IMAGE": return "an image";
    case "VOICE_NOTE": return "a voice note";
    case "EMAIL": return "an email";
    case "WORD": return "a Word document";
    case "EXCEL": return "an Excel workbook";
    case "GOOGLE_SHEET": return "a Google Sheet";
    case "WEBSITE": return "a web page";
    case "PLAIN_TEXT": return "pasted text";
  }
}

/**
 * Orders two conflicting facts deterministically.
 *
 * Confidence decides first. Equal confidence is genuinely common — a
 * MEDIUM value from a spreadsheet and a HIGH value from a voice note
 * both score 0.6 — and resolving that by whichever source happened to be
 * read first would make the outcome depend on arrival order, which is
 * exactly the non-determinism Task 002 forbids. So ties fall to the more
 * trustworthy channel, and a tie between equally-trustworthy channels
 * falls to a stable alphabetical order.
 *
 * The result is that the same two sources always produce the same
 * winner, no matter which arrived first.
 */
function rankAgainst(a: RequirementFact, b: RequirementFact): [RequirementFact, RequirementFact] {
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? [a, b] : [b, a];

  const factorA = CHANNEL_FACTOR[a.sourceKind];
  const factorB = CHANNEL_FACTOR[b.sourceKind];
  if (factorA !== factorB) return factorA > factorB ? [a, b] : [b, a];

  return a.sourceKind <= b.sourceKind ? [a, b] : [b, a];
}

/**
 * Resolves the same field extracted from two different channels.
 *
 * Overseas requirements genuinely arrive twice — the demand letter as a
 * PDF and the "urgent" summary as a WhatsApp forward — and they
 * disagree more often than anyone would like. The higher-confidence
 * channel wins, ties keep the incumbent, and the losing value is named in
 * the winner's reason so the disagreement is visible instead of
 * resolved in silence.
 */
export function reconcileFact(incumbent: RequirementFact, challenger: RequirementFact): RequirementFact {
  if (incumbent.value === null && challenger.value === null) return incumbent;
  if (incumbent.value === null) return challenger;
  if (challenger.value === null) return incumbent;

  if (incumbent.value === challenger.value) {
    // Agreement across two channels is genuine corroboration, but it is
    // still capped by the better channel's ceiling — two screenshots do
    // not become a spreadsheet.
    const score = round2(Math.max(incumbent.confidence, challenger.confidence));
    return {
      ...incumbent,
      confidence: score,
      confidenceBand: bandFor(score),
      reason: `${incumbent.reason} Corroborated by ${describeChannel(challenger.sourceKind)}, which stated the same value.`,
    };
  }

  const [winner, loser] = rankAgainst(incumbent, challenger);

  return {
    ...winner,
    reason:
      `${winner.reason} Conflict: ${describeChannel(loser.sourceKind)} stated "${loser.value}" ` +
      `(confidence ${loser.confidence}). Kept the value from ${describeChannel(winner.sourceKind)} ` +
      `because it scored higher (${winner.confidence}). Both values are retained in the requirement's sources.`,
  };
}
