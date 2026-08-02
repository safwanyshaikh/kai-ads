import { describe, expect, it } from "vitest";
import {
  REQUIREMENT_SOURCE_KINDS,
  absentFact,
  bandFor,
  buildFact,
  deterministicFact,
  reconcileFact,
  scoreConfidence,
  type RequirementSourceKind,
} from "@/server/ai/requirement-provenance";

/**
 * Requirement Intelligence — provenance (Task 002).
 *
 * The rule under test: "Every extracted field must include Source,
 * Confidence and Reason. Every AI decision must be explainable."
 *
 * These tests treat that as an invariant rather than a feature — there
 * must be NO way to construct a fact without all three, including for
 * fields that were never stated. A silent null is exactly the failure
 * this layer exists to make impossible.
 */

const base = {
  field: "country",
  value: "Saudi Arabia",
  rawValue: "KSA",
  sourceId: "src_1",
  band: "HIGH" as const,
};

describe("the invariant: source, confidence and reason on every fact", () => {
  it.each(REQUIREMENT_SOURCE_KINDS)("holds for a value from %s", (kind) => {
    const fact = buildFact({ ...base, sourceKind: kind });
    expect(fact.sourceKind).toBe(kind);
    expect(fact.confidence).toBeGreaterThan(0);
    expect(fact.reason.length).toBeGreaterThan(0);
  });

  it.each(REQUIREMENT_SOURCE_KINDS)("holds for an ABSENT field from %s", (kind) => {
    const fact = absentFact({ field: "employer", sourceKind: kind, sourceId: "src_1" });
    expect(fact.sourceKind).toBe(kind);
    expect(fact.method).toBe("ABSENT");
    expect(fact.reason.length).toBeGreaterThan(0);
  });

  it("turns a null value into an explained absence rather than a silent null", () => {
    const fact = buildFact({ ...base, value: null, sourceKind: "PDF" });
    expect(fact.method).toBe("ABSENT");
    expect(fact.confidence).toBe(0);
    expect(fact.reason).toContain("rather than inferred");
  });

  it("names the channel in plain language, not as an enum", () => {
    expect(buildFact({ ...base, sourceKind: "VOICE_NOTE" }).reason).toContain("a voice note");
    expect(buildFact({ ...base, sourceKind: "GOOGLE_SHEET" }).reason).toContain("a Google Sheet");
  });
});

describe("confidence is deterministic and channel-aware", () => {
  it("is stable across repeated scoring", () => {
    const scores = Array.from({ length: 5 }, () => scoreConfidence("HIGH", "PDF"));
    expect(new Set(scores).size).toBe(1);
  });

  it("scales a confident extraction down by what the channel can deliver", () => {
    // The model may be certain; a photograph of a noticeboard is not.
    expect(scoreConfidence("HIGH", "EXCEL")).toBeGreaterThan(scoreConfidence("HIGH", "WHATSAPP_SCREENSHOT"));
    expect(scoreConfidence("HIGH", "PDF")).toBeGreaterThan(scoreConfidence("HIGH", "VOICE_NOTE"));
  });

  it("never lets a spoken or photographed value outrank a structured one", () => {
    const structured = scoreConfidence("MEDIUM", "EXCEL");
    const spoken = scoreConfidence("HIGH", "VOICE_NOTE");
    expect(structured).toBeGreaterThan(spoken);
  });

  it("explains in the reason why a lossy channel lowered the score", () => {
    const fact = buildFact({ ...base, sourceKind: "WHATSAPP_SCREENSHOT" });
    expect(fact.reason).toContain("scored");
    expect(fact.reason).toContain("misreads digits");
  });

  it("never scores anything as certain", () => {
    // Nothing but a human confirming should ever read as 1.0 — a model
    // asserting HIGH is still a model reading someone's PDF.
    for (const kind of REQUIREMENT_SOURCE_KINDS) {
      expect(scoreConfidence("HIGH", kind)).toBeLessThan(1);
    }
  });

  it("maps scores to the band a recruiter actually sees", () => {
    expect(bandFor(0.9)).toBe("HIGH");
    expect(bandFor(0.6)).toBe("MEDIUM");
    expect(bandFor(0.2)).toBe("LOW");
  });
});

describe("method records how the value came to be", () => {
  it("marks a value the model read and a rule then canonicalized", () => {
    const fact = buildFact({
      ...base,
      sourceKind: "PDF",
      normalization: { changed: true, reason: "Canonicalized KSA to Saudi Arabia." },
    });
    expect(fact.method).toBe("AI_THEN_NORMALIZED");
    expect(fact.reason).toContain("Canonicalized KSA to Saudi Arabia.");
  });

  it("marks a value the model read that needed no canonicalization", () => {
    const fact = buildFact({ ...base, sourceKind: "PDF", normalization: { changed: false, reason: "Already canonical." } });
    expect(fact.method).toBe("AI_EXTRACTION");
  });

  it("marks a value produced entirely by a replayable rule", () => {
    const fact = deterministicFact({
      field: "positions.0.possibleDuplicateOf",
      value: "1",
      rawValue: null,
      sourceKind: "EXCEL",
      sourceId: "src_1",
      reason: "Flagged as a possible duplicate of position 1.",
    });
    expect(fact.method).toBe("DETERMINISTIC");
    expect(fact.confidence).toBeGreaterThan(scoreConfidence("HIGH", "EXCEL"));
  });

  it("always preserves what the source said alongside the canonical value", () => {
    const fact = buildFact({ ...base, sourceKind: "PDF" });
    expect(fact.value).toBe("Saudi Arabia");
    expect(fact.rawValue).toBe("KSA");
  });
});

describe("reconciling the same field from two channels", () => {
  const make = (kind: RequirementSourceKind, value: string, band: "HIGH" | "MEDIUM" | "LOW" = "HIGH") =>
    buildFact({ field: "positions.0.salary", value, rawValue: value, sourceKind: kind, sourceId: "s", band });

  it("keeps the higher-confidence channel when they disagree", () => {
    const fromSheet = make("EXCEL", "SAR 3,200");
    const fromScreenshot = make("WHATSAPP_SCREENSHOT", "SAR 3,700");
    expect(reconcileFact(fromScreenshot, fromSheet).value).toBe("SAR 3,200");
    expect(reconcileFact(fromSheet, fromScreenshot).value).toBe("SAR 3,200");
  });

  it("names the losing value so the disagreement is visible, not resolved in silence", () => {
    const result = reconcileFact(make("WHATSAPP_SCREENSHOT", "SAR 3,700"), make("EXCEL", "SAR 3,200"));
    expect(result.reason).toContain("Conflict");
    expect(result.reason).toContain("SAR 3,700");
    expect(result.reason).toContain("Both values are retained");
  });

  it("treats agreement across channels as corroboration", () => {
    const result = reconcileFact(make("WHATSAPP_TEXT", "SAR 3,200"), make("EXCEL", "SAR 3,200"));
    expect(result.value).toBe("SAR 3,200");
    expect(result.reason).toContain("Corroborated");
  });

  it("does not let two weak channels agreeing beat one strong channel", () => {
    const twoScreenshots = reconcileFact(
      make("WHATSAPP_SCREENSHOT", "SAR 3,700"),
      make("IMAGE", "SAR 3,700"),
    );
    const sheet = make("EXCEL", "SAR 3,200");
    expect(reconcileFact(twoScreenshots, sheet).value).toBe("SAR 3,200");
  });

  it("prefers a stated value over an absent one, whichever arrives first", () => {
    const stated = make("PDF", "SAR 3,200");
    const missing = absentFact({ field: "positions.0.salary", sourceKind: "IMAGE", sourceId: "s" });
    expect(reconcileFact(missing, stated).value).toBe("SAR 3,200");
    expect(reconcileFact(stated, missing).value).toBe("SAR 3,200");
  });

  it("stays absent when neither channel stated the field", () => {
    const a = absentFact({ field: "employer", sourceKind: "PDF", sourceId: "s" });
    const b = absentFact({ field: "employer", sourceKind: "IMAGE", sourceId: "s" });
    expect(reconcileFact(a, b).value).toBeNull();
  });

  it("is deterministic regardless of the order sources were read in", () => {
    const a = make("EXCEL", "SAR 3,200");
    const b = make("WHATSAPP_SCREENSHOT", "SAR 3,700");
    expect(reconcileFact(a, b).value).toBe(reconcileFact(b, a).value);
  });

  it("lets a merely-MEDIUM spreadsheet beat a HIGH-confidence voice note", () => {
    // Scaling by channel rather than capping is what makes this hold. A
    // ceiling scores both at 0.6, leaving the winner decided by whichever
    // was uploaded first — a requirement that changes with upload order.
    const sheet = make("EXCEL", "SAR 3,200", "MEDIUM");
    const voice = make("VOICE_NOTE", "SAR 3,700", "HIGH");
    expect(sheet.confidence).toBeGreaterThan(voice.confidence);
    expect(reconcileFact(sheet, voice).value).toBe("SAR 3,200");
    expect(reconcileFact(voice, sheet).value).toBe("SAR 3,200");
  });

  it("resolves an equal-confidence conflict by channel, not by arrival order", () => {
    const sheet = make("EXCEL", "SAR 3,200", "MEDIUM");
    const screenshot = make("WHATSAPP_SCREENSHOT", "SAR 3,700", "MEDIUM");
    expect(reconcileFact(sheet, screenshot).value).toBe("SAR 3,200");
    expect(reconcileFact(screenshot, sheet).value).toBe("SAR 3,200");
  });

  it("resolves a conflict between equally-trustworthy channels stably", () => {
    const image = make("IMAGE", "SAR 3,200");
    const screenshot = make("WHATSAPP_SCREENSHOT", "SAR 3,700");
    expect(reconcileFact(image, screenshot).value).toBe(reconcileFact(screenshot, image).value);
  });
});
