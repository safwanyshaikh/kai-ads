import { describe, expect, it } from "vitest";
import { mergeExtractionResults, type ChunkExtractionOutcome } from "@/server/ai/extraction-merge";
import { emptyExtractionResult, type ExtractedPosition, type ExtractionResult } from "@/server/ai/extraction-result.schema";

function position(title: string, quantity: number, possibleDuplicateOfIndex: number | null = null): ExtractedPosition {
  return {
    title,
    tradeSummary: "",
    quantity: { value: quantity, confidence: "MEDIUM" },
    salaryAmount: { value: null, confidence: "LOW" },
    salaryCurrency: { value: null, confidence: "LOW" },
    salaryTiers: [],
    experience: { value: null, confidence: "LOW" },
    qualification: { value: null, confidence: "LOW" },
    ageLimit: { value: null, confidence: "LOW" },
    possibleDuplicateOfIndex,
  };
}

function chunkOutcome(index: number, text: string, overrides: Partial<ExtractionResult>): ChunkExtractionOutcome {
  return {
    chunk: { index, text, startChar: 0, endChar: text.length },
    result: { ...emptyExtractionResult(text), ...overrides },
  };
}

describe("mergeExtractionResults", () => {
  it("returns the single chunk's result unchanged when there is only one chunk", () => {
    const outcome = chunkOutcome(0, "chunk text", { positions: [position("Welder", 5)] });
    const merged = mergeExtractionResults([outcome]);
    expect(merged).toBe(outcome.result);
  });

  it("concatenates positions from every chunk, in chunk order, with exact counts preserved", () => {
    const outcomes = [
      chunkOutcome(0, "first chunk", { positions: [position("Operation Manager", 1), position("WPR", 25)] }),
      chunkOutcome(1, "second chunk", { positions: [position("Electrician", 10)] }),
      chunkOutcome(2, "third chunk", { positions: [position("PQCS", 5)] }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.positions.map((p) => p.title)).toEqual(["Operation Manager", "WPR", "Electrician", "PQCS"]);
    expect(merged.positions.map((p) => p.quantity.value)).toEqual([1, 25, 10, 5]);
    expect(merged.positions.reduce((sum, p) => sum + (p.quantity.value ?? 0), 0)).toBe(41);
  });

  it("never drops a position across chunks — a position after a simulated 20,000-char boundary survives", () => {
    const beforeBoundary = chunkOutcome(0, "a".repeat(20000), {
      positions: Array.from({ length: 18 }, (_, i) => position(`Role ${i + 1}`, 1)),
    });
    const afterBoundary = chunkOutcome(1, "PQCS — 5 (page 3)", { positions: [position("PQCS", 5)] });
    const merged = mergeExtractionResults([beforeBoundary, afterBoundary]);
    expect(merged.positions).toHaveLength(19);
    expect(merged.positions.some((p) => p.title === "PQCS")).toBe(true);
    expect(merged.positions.reduce((sum, p) => sum + (p.quantity.value ?? 0), 0)).toBe(23);
  });

  it("re-points possibleDuplicateOfIndex into the merged array instead of dropping it", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { positions: [position("Welder", 5), position("Welder (dup)", 5, 0)] }),
      chunkOutcome(1, "chunk 2", { positions: [position("Fitter", 3, 1) /* refers to Fitter's own chunk index 1 */] }),
    ];
    const merged = mergeExtractionResults(outcomes);
    // Chunk 0 contributed 2 positions (offset 0); "Welder (dup)" pointed at index 0 within its own chunk, unchanged.
    expect(merged.positions[1].possibleDuplicateOfIndex).toBe(0);
    // Chunk 1's "Fitter" pointed at index 1 within its own chunk; offset by chunk 0's 2 positions -> 3.
    expect(merged.positions[2].possibleDuplicateOfIndex).toBe(3);
  });

  it("does not deduplicate positions across chunks — repeated titles are kept as distinct entries", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { positions: [position("Electrician", 10)] }),
      chunkOutcome(1, "chunk 2", { positions: [position("Electrician", 5)] }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.positions).toHaveLength(2);
  });

  it("merges benefits as a deduplicated union across chunks, preserving first-seen order", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { benefits: { value: ["Free food", "Free accommodation"], confidence: "HIGH" } }),
      chunkOutcome(1, "chunk 2", { benefits: { value: ["Free accommodation", "Medical insurance"], confidence: "MEDIUM" } }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.benefits.value).toEqual(["Free food", "Free accommodation", "Medical insurance"]);
  });

  it("takes the first non-null value for document-wide scalar fields", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { employer: { value: null, confidence: "LOW" } }),
      chunkOutcome(1, "chunk 2", { employer: { value: "Halliburton", confidence: "HIGH" } }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.employer.value).toBe("Halliburton");
  });

  it("concatenates interview events across chunks without deduplication", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { interviewEvents: [{ date: "14th July", venue: "Mumbai", mode: "in_person" }] }),
      chunkOutcome(1, "chunk 2", { interviewEvents: [{ date: "18th July", venue: "Baroda", mode: "in_person" }] }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.interviewEvents).toHaveLength(2);
  });

  it("records a warning that the source was chunked, without losing per-chunk warnings", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { warnings: ["chunk 1 note"] }),
      chunkOutcome(1, "chunk 2", { warnings: ["chunk 2 note"] }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.warnings).toContain("chunk 1 note");
    expect(merged.warnings).toContain("chunk 2 note");
    expect(merged.warnings.some((w) => /chunk/i.test(w))).toBe(true);
  });

  it("takes the worst overall confidence across chunks", () => {
    const outcomes = [
      chunkOutcome(0, "chunk 1", { overallConfidence: "HIGH" }),
      chunkOutcome(1, "chunk 2", { overallConfidence: "LOW" }),
    ];
    const merged = mergeExtractionResults(outcomes);
    expect(merged.overallConfidence).toBe("LOW");
  });
});
