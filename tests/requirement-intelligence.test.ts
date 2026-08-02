import { describe, expect, it } from "vitest";
import {
  buildRequirementFacts,
  reconcileFactSets,
  toCanonicalRequirement,
} from "@/server/services/requirement-intelligence.service";
import { emptyExtractionResult, type ExtractionResult } from "@/server/ai/extraction-result.schema";

/**
 * Requirement Intelligence — requirement to canonical JobOrder (Task 002).
 *
 * These tests cover the stage's contract:
 *   * exactly one canonical requirement comes out,
 *   * every field carries Source, Confidence and Reason,
 *   * nothing is invented to fill a gap,
 *   * and the result is identical every time.
 *
 * Pure throughout — no database, no model. The persistence path is
 * covered against a real PostgreSQL instance in
 * tests/integration/requirement-intelligence-flow.test.ts.
 */

function extraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    ...emptyExtractionResult("Need 10 welders for Dammam, SAR 3200. Interview 14th August 2026, Mumbai."),
    country: { value: "KSA", confidence: "HIGH" },
    industry: { value: "Construction", confidence: "HIGH" },
    employer: { value: "ABC Contracting", confidence: "MEDIUM" },
    positions: [
      {
        title: "WELDER",
        tradeSummary: "Welds structural steel.",
        quantity: { value: 10, confidence: "HIGH" },
        salaryAmount: { value: 3200, confidence: "MEDIUM" },
        salaryCurrency: { value: null, confidence: "LOW" },
        salaryTiers: [],
        experience: { value: "min 5 yrs", confidence: "MEDIUM" },
        qualification: { value: "ITI", confidence: "MEDIUM" },
        ageLimit: { value: null, confidence: "LOW" },
        possibleDuplicateOfIndex: null,
      },
    ],
    interviewDate: { value: "14th August 2026", confidence: "HIGH" },
    interviewVenue: { value: "Mumbai", confidence: "HIGH" },
    contact: {
      value: { name: "Rajesh", phone: "+91 98765-43210", email: "Jobs@Example.COM", whatsapp: null },
      confidence: "HIGH",
    },
    ...overrides,
  };
}

const context = { kind: "PDF" as const, sourceId: "src_1", label: "demand-letter.pdf" };

describe("every field carries source, confidence and reason", () => {
  const facts = buildRequirementFacts(extraction(), context);

  it("produces no fact without all three", () => {
    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      expect(fact.sourceKind).toBeTruthy();
      expect(typeof fact.confidence).toBe("number");
      expect(fact.reason.length).toBeGreaterThan(0);
      expect(fact.method).toBeTruthy();
    }
  });

  it("covers the fields a requirement is actually made of", () => {
    const fields = facts.map((fact) => fact.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "country",
        "industry",
        "employer",
        "interview.date",
        "interview.venue",
        "contact.phone",
        "contact.email",
        "positions.0.title",
        "positions.0.count",
        "positions.0.salary",
        "positions.0.experience",
      ]),
    );
  });

  it("records a field no source stated as an explicit unknown", () => {
    const withoutEmployer = buildRequirementFacts(
      extraction({ employer: { value: null, confidence: "LOW" } }),
      context,
    );
    const employer = withoutEmployer.find((fact) => fact.field === "employer");
    expect(employer?.method).toBe("ABSENT");
    expect(employer?.value).toBeNull();
    // "Not stated" must be distinguishable from "nobody looked".
    expect(employer?.reason).toContain("rather than inferred");
  });

  it("explains a deterministic canonicalization in the reason", () => {
    const country = facts.find((fact) => fact.field === "country");
    expect(country?.value).toBe("Saudi Arabia");
    expect(country?.rawValue).toBe("KSA");
    expect(country?.method).toBe("AI_THEN_NORMALIZED");
    expect(country?.reason).toContain("KSA");
    expect(country?.reason).toContain("Saudi Arabia");
  });

  it("is deterministic across repeated runs", () => {
    expect(buildRequirementFacts(extraction(), context)).toEqual(
      buildRequirementFacts(extraction(), context),
    );
  });
});

describe("nothing is invented to fill a gap", () => {
  it("labels a bare salary with the destination currency and says the amount is unchanged", () => {
    const facts = buildRequirementFacts(extraction(), context);
    const salary = facts.find((fact) => fact.field === "positions.0.salary");
    expect(salary?.value).toBe("SAR 3200");
    expect(salary?.rawValue).toBe("3200");
    expect(salary?.reason).toContain("The amount itself is unchanged");
  });

  it("leaves salary absent when the source stated none", () => {
    const noSalary = extraction();
    noSalary.positions[0].salaryAmount = { value: null, confidence: "LOW" };
    const salary = buildRequirementFacts(noSalary, context).find(
      (fact) => fact.field === "positions.0.salary",
    );
    expect(salary?.value).toBeNull();
    expect(salary?.method).toBe("ABSENT");
  });

  it("preserves a tiered pay scale rather than flattening it to one figure", () => {
    const tiered = extraction();
    tiered.positions[0].salaryTiers = [
      { experience: "8-9 years", salary: "SAR 10,000" },
      { experience: "9-10 years", salary: "SAR 11,000" },
    ];
    const salary = buildRequirementFacts(tiered, context).find(
      (fact) => fact.field === "positions.0.salary",
    );
    expect(salary?.value).toContain("SAR 10,000");
    expect(salary?.value).toContain("SAR 11,000");
  });

  it("records an ambiguous headcount as unknown rather than guessing", () => {
    const ambiguous = extraction();
    ambiguous.positions[0].quantity = { value: null, confidence: "LOW" };
    const count = buildRequirementFacts(ambiguous, context).find(
      (fact) => fact.field === "positions.0.count",
    );
    expect(count?.value).toBeNull();
    expect(count?.method).toBe("ABSENT");
  });

  it("flags a possible duplicate position without merging or removing it", () => {
    const withDuplicate = extraction();
    withDuplicate.positions.push({ ...withDuplicate.positions[0], possibleDuplicateOfIndex: 0 });
    const facts = buildRequirementFacts(withDuplicate, context);

    expect(facts.find((fact) => fact.field === "positions.1.possibleDuplicateOf")?.value).toBe("0");
    // Both positions survive — two similar lines are routinely two real vacancies.
    expect(facts.filter((fact) => /^positions\.\d+\.title$/.test(fact.field))).toHaveLength(2);
  });

  it("records the absence of any position rather than inventing one", () => {
    const facts = buildRequirementFacts(extraction({ positions: [] }), context);
    const positions = facts.find((fact) => fact.field === "positions");
    expect(positions?.method).toBe("ABSENT");
    expect(positions?.reason).toContain("nothing was invented");
  });
});

describe("channel governs how far a value is trusted", () => {
  it("scores the same extraction lower from a voice note than from a spreadsheet", () => {
    const fromSheet = buildRequirementFacts(extraction(), { ...context, kind: "EXCEL" });
    const fromVoice = buildRequirementFacts(extraction(), { ...context, kind: "VOICE_NOTE" });

    const salaryOf = (facts: typeof fromSheet) =>
      facts.find((fact) => fact.field === "positions.0.salary")?.confidence ?? 0;

    expect(salaryOf(fromSheet)).toBeGreaterThan(salaryOf(fromVoice));
  });

  it("attributes every fact to the channel it was read from", () => {
    const facts = buildRequirementFacts(extraction(), { ...context, kind: "WHATSAPP_SCREENSHOT" });
    expect(facts.every((fact) => fact.sourceKind === "WHATSAPP_SCREENSHOT")).toBe(true);
  });
});

describe("reconcileFactSets — several channels, one requirement", () => {
  it("keeps the higher-confidence channel and records the disagreement", () => {
    const fromSheet = buildRequirementFacts(extraction(), { ...context, kind: "EXCEL" });

    // Same extractor confidence on both, so the CHANNEL is what decides.
    const conflicting = extraction();
    conflicting.positions[0].salaryAmount = { value: 3700, confidence: "MEDIUM" };
    const fromScreenshot = buildRequirementFacts(conflicting, {
      ...context,
      kind: "WHATSAPP_SCREENSHOT",
    });

    const merged = reconcileFactSets([fromScreenshot, fromSheet]);
    const salary = merged.find((fact) => fact.field === "positions.0.salary");

    expect(salary?.value).toBe("SAR 3200");
    expect(salary?.reason).toContain("Conflict");
    expect(salary?.reason).toContain("3700");
  });

  it("produces exactly one fact per field", () => {
    const merged = reconcileFactSets([
      buildRequirementFacts(extraction(), { ...context, kind: "EXCEL" }),
      buildRequirementFacts(extraction(), { ...context, kind: "PDF" }),
    ]);
    expect(new Set(merged.map((fact) => fact.field)).size).toBe(merged.length);
  });

  it("does not depend on the order the sources were read in", () => {
    const a = buildRequirementFacts(extraction(), { ...context, kind: "EXCEL" });
    const b = buildRequirementFacts(extraction(), { ...context, kind: "WHATSAPP_SCREENSHOT" });

    const forwards = reconcileFactSets([a, b]).map((fact) => [fact.field, fact.value]).sort();
    const backwards = reconcileFactSets([b, a]).map((fact) => [fact.field, fact.value]).sort();
    expect(forwards).toEqual(backwards);
  });
});

describe("toCanonicalRequirement — exactly one canonical requirement", () => {
  const canonical = toCanonicalRequirement(buildRequirementFacts(extraction(), context));

  it("assembles the requirement from the explained facts", () => {
    expect(canonical.country).toBe("Saudi Arabia");
    expect(canonical.industry).toBe("Construction");
    expect(canonical.employer).toBe("ABC Contracting");
  });

  it("carries the canonicalized position through", () => {
    expect(canonical.positions).toHaveLength(1);
    expect(canonical.positions[0].title).toBe("Welder");
    expect(canonical.positions[0].count).toBe(10);
    expect(canonical.positions[0].salary).toBe("SAR 3200");
    expect(canonical.positions[0].experience).toBe("minimum 5 years");
  });

  it("carries the canonicalized interview and contact through", () => {
    expect(canonical.interview.date).toBe("2026-08-14");
    expect(canonical.interview.location).toBe("Mumbai");
    expect(canonical.contact.phone).toBe("+919876543210");
    expect(canonical.contact.email).toBe("jobs@example.com");
  });

  it("omits fields no source stated instead of emitting placeholders", () => {
    const bare = toCanonicalRequirement(
      buildRequirementFacts(extraction({ employer: { value: null, confidence: "LOW" } }), context),
    );
    expect(bare.employer).toBeNull();
    expect(JSON.stringify(bare)).not.toContain("N/A");
    expect(JSON.stringify(bare)).not.toContain("TBD");
  });

  it("preserves every position of a bulk requirement in order", () => {
    const bulk = extraction({
      positions: Array.from({ length: 40 }, (_, i) => ({
        title: `Trade ${i}`,
        tradeSummary: "s",
        quantity: { value: i + 1, confidence: "HIGH" as const },
        salaryAmount: { value: null, confidence: "LOW" as const },
        salaryCurrency: { value: null, confidence: "LOW" as const },
        salaryTiers: [],
        experience: { value: null, confidence: "LOW" as const },
        qualification: { value: null, confidence: "LOW" as const },
        ageLimit: { value: null, confidence: "LOW" as const },
        possibleDuplicateOfIndex: null,
      })),
    });

    const result = toCanonicalRequirement(buildRequirementFacts(bulk, context));
    expect(result.positions).toHaveLength(40);
    expect(result.positions.map((p) => p.count)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it("yields no position when the sources established none", () => {
    // The caller treats this as INSUFFICIENT_REQUIREMENT — no JobOrder is
    // created, rather than one with an invented vacancy.
    expect(toCanonicalRequirement(buildRequirementFacts(extraction({ positions: [] }), context)).positions).toHaveLength(0);
  });

  it("is deterministic", () => {
    const facts = buildRequirementFacts(extraction(), context);
    expect(toCanonicalRequirement(facts)).toEqual(toCanonicalRequirement(facts));
  });
});
