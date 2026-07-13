import { describe, expect, it } from "vitest";
import { enforceSourceGrounding } from "@/server/ai/openai/kai-extraction-engine";
import { emptyExtractionResult, type ExtractionResult } from "@/server/ai/extraction-result.schema";

/** Builds a full ExtractionResult with only employer/benefits overridden, for grounding tests. */
function resultWith(overrides: Partial<Pick<ExtractionResult, "employer" | "benefits">>): ExtractionResult {
  return { ...emptyExtractionResult("(unused)"), ...overrides };
}

describe("enforceSourceGrounding — deterministic backstop for the prompt's No Hallucination rule", () => {
  const sourceText = "Urgent requirement: 10 Welders, 5 Technicians for a UAE construction project. Free accommodation provided.";

  it("keeps an employer name that literally appears in the source text", () => {
    const grounded = enforceSourceGrounding(
      resultWith({ employer: { value: "Al Noor Overseas", confidence: "HIGH" } }),
      "Posted by Al Noor Overseas Recruitment for a UAE client.",
    );
    expect(grounded.employer.value).toBe("Al Noor Overseas");
  });

  it("drops an employer name that never appears in the source text (the BILFINGER case)", () => {
    const grounded = enforceSourceGrounding(
      resultWith({ employer: { value: "BILFINGER", confidence: "HIGH" } }),
      sourceText,
    );
    expect(grounded.employer.value).toBeNull();
    expect(grounded.employer.confidence).toBe("LOW");
  });

  it("keeps a benefit that literally appears in the source text", () => {
    const grounded = enforceSourceGrounding(
      resultWith({ benefits: { value: ["Free accommodation"], confidence: "HIGH" } }),
      sourceText,
    );
    expect(grounded.benefits.value).toEqual(["Free accommodation"]);
  });

  it("drops a benefit that never appears in the source text, keeping any that do", () => {
    const grounded = enforceSourceGrounding(
      resultWith({
        benefits: {
          value: ["Free accommodation", "Basic Salary + Overtime upto 4 hours"],
          confidence: "HIGH",
        },
      }),
      sourceText,
    );
    expect(grounded.benefits.value).toEqual(["Free accommodation"]);
  });

  it("nulls out benefits entirely when none of them are grounded", () => {
    const grounded = enforceSourceGrounding(
      resultWith({ benefits: { value: ["Basic Salary + Overtime upto 4 hours"], confidence: "HIGH" } }),
      sourceText,
    );
    expect(grounded.benefits.value).toBeNull();
    expect(grounded.benefits.confidence).toBe("LOW");
  });

  it("is case-insensitive when checking grounding", () => {
    const grounded = enforceSourceGrounding(
      resultWith({ employer: { value: "AL NOOR OVERSEAS", confidence: "HIGH" } }),
      "posted by al noor overseas recruitment",
    );
    expect(grounded.employer.value).toBe("AL NOOR OVERSEAS");
  });

  it("leaves an already-null employer/benefits untouched", () => {
    const grounded = enforceSourceGrounding(resultWith({}), sourceText);
    expect(grounded.employer.value).toBeNull();
    expect(grounded.benefits.value).toBeNull();
  });
});
