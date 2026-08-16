import type { ExtractionResult, ExtractedPosition, Confidence } from "./extraction-result.schema";
import type { TextChunk } from "./text-chunking";
import { AiInvalidResponseError } from "./openai/errors";

export interface ChunkExtractionOutcome {
  chunk: TextChunk;
  result: ExtractionResult;
}

const CONFIDENCE_RANK: Record<Confidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function worstConfidence(values: Confidence[]): Confidence {
  return values.reduce((worst, c) => (CONFIDENCE_RANK[c] < CONFIDENCE_RANK[worst] ? c : worst), values[0]);
}

function firstNonNull<T extends { value: unknown }>(fields: T[]): T {
  return fields.find((f) => f.value != null) ?? fields[0];
}

/**
 * Combines one ExtractionResult per source chunk into a single result.
 *
 * Step 6, requirement G/H: every distinct position found in every chunk is
 * kept — nothing is invented and nothing is deduplicated beyond what the
 * model itself already flagged (possibleDuplicateOfIndex), which is
 * re-pointed to the merged array's indices rather than dropped. Scalar,
 * document-wide fields (country/industry/employer/...) are expected to be
 * stated once in the source, so the first chunk that actually found a
 * value wins; array fields that can legitimately appear more than once
 * (positions, interview events, warnings) are concatenated in chunk/
 * document order.
 */
export function mergeExtractionResults(outcomes: ChunkExtractionOutcome[]): ExtractionResult {
  if (outcomes.length === 0) {
    throw new AiInvalidResponseError("no extraction chunks to merge");
  }
  if (outcomes.length === 1) {
    return outcomes[0].result;
  }

  const positions: ExtractedPosition[] = [];
  let offset = 0;
  for (const { result } of outcomes) {
    for (const position of result.positions) {
      positions.push({
        ...position,
        possibleDuplicateOfIndex:
          position.possibleDuplicateOfIndex != null ? position.possibleDuplicateOfIndex + offset : null,
      });
    }
    offset += result.positions.length;
  }

  const benefitFields = outcomes.map((o) => o.result.benefits);
  const benefitLabels: string[] = [];
  const benefitSeen = new Set<string>();
  const contributingBenefitConfidences: Confidence[] = [];
  for (const field of benefitFields) {
    if (!field.value || field.value.length === 0) continue;
    contributingBenefitConfidences.push(field.confidence);
    for (const label of field.value) {
      if (!benefitSeen.has(label)) {
        benefitSeen.add(label);
        benefitLabels.push(label);
      }
    }
  }

  const interviewEvents = outcomes.flatMap((o) => o.result.interviewEvents);
  const warnings = outcomes.flatMap((o) => o.result.warnings);
  warnings.push(`Source text exceeded single-call capacity — extracted across ${outcomes.length} chunks.`);

  const merged: ExtractionResult = {
    country: firstNonNull(outcomes.map((o) => o.result.country)),
    industry: firstNonNull(outcomes.map((o) => o.result.industry)),
    projectType: firstNonNull(outcomes.map((o) => o.result.projectType)),
    employer: firstNonNull(outcomes.map((o) => o.result.employer)),
    positions,
    benefits:
      benefitLabels.length > 0
        ? { value: benefitLabels, confidence: worstConfidence(contributingBenefitConfidences) }
        : { value: null, confidence: "LOW" },
    interviewMode: firstNonNull(outcomes.map((o) => o.result.interviewMode)),
    interviewDate: firstNonNull(outcomes.map((o) => o.result.interviewDate)),
    interviewTime: firstNonNull(outcomes.map((o) => o.result.interviewTime)),
    interviewVenue: firstNonNull(outcomes.map((o) => o.result.interviewVenue)),
    interviewEvents,
    contact: firstNonNull(outcomes.map((o) => o.result.contact)),
    originalSourceText: outcomes.map((o) => o.chunk.text).join("\n\n"),
    overallConfidence: worstConfidence(outcomes.map((o) => o.result.overallConfidence)),
    warnings,
  };

  assertMergeIntegrity(outcomes, merged);
  return merged;
}

/**
 * Requirement F backstop: the merge above is a pure concatenation of every
 * chunk's positions, so this can only fire if a future edit to
 * mergeExtractionResults accidentally drops one — it exists to fail loudly
 * rather than silently ship a requirement with fewer roles than the model
 * actually reported across its chunks.
 */
function assertMergeIntegrity(outcomes: ChunkExtractionOutcome[], merged: ExtractionResult): void {
  const expected = outcomes.reduce((sum, o) => sum + o.result.positions.length, 0);
  if (merged.positions.length !== expected) {
    throw new AiInvalidResponseError(
      `extraction merge lost positions: expected ${expected}, got ${merged.positions.length}`,
    );
  }
}
