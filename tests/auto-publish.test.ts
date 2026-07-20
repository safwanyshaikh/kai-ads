import { describe, expect, it } from "vitest";
import { planAutoPublish } from "@/lib/auto-publish";
import { emptyExtractionResult, type ExtractionResult } from "@/server/ai/extraction-result.schema";

/**
 * Sprint 006 workflow replacement: no Review form step. planAutoPublish()
 * is the single decision between the AUTO path (AI populated everything →
 * create + generate + open the canvas) and the MANUAL exception path
 * (extraction found too few grounded facts; Truth Brain forbids inventing
 * the missing ones, so the recruiter is asked for exactly those).
 */

const emptyField = { value: null, confidence: "LOW" as const };

function position(title: string, quantity: number | null): ExtractionResult["positions"][number] {
  return {
    title,
    tradeSummary: `${title} for overseas deployment.`,
    quantity: { value: quantity, confidence: quantity != null ? "HIGH" : "LOW" },
    salaryAmount: emptyField,
    salaryCurrency: emptyField,
    experience: emptyField,
    qualification: emptyField,
    ageLimit: emptyField,
    salaryTiers: [],
    possibleDuplicateOfIndex: null,
  };
}

const HALLIBURTON: ExtractionResult = {
  ...emptyExtractionResult("CLIENT: Halliburton Saudi Arabia..."),
  country: { value: "Saudi Arabia", confidence: "HIGH" },
  industry: { value: "Oil & Gas", confidence: "HIGH" },
  employer: { value: "Halliburton", confidence: "HIGH" },
  positions: [position("Sperry Drilling Services", 16), position("Wireline & Perforating", 18)],
  benefits: { value: ["Free Accommodation", "Medical Insurance"], confidence: "HIGH" },
  overallConfidence: "HIGH",
};

describe("planAutoPublish — auto path (the normal workflow)", () => {
  it("a fully-grounded extraction auto-publishes with no form step", () => {
    const plan = planAutoPublish(HALLIBURTON);
    expect(plan.mode).toBe("auto");
    if (plan.mode !== "auto") return;
    expect(plan.input.header).toBe("Halliburton — Saudi Arabia");
    expect(plan.input.country).toBe("Saudi Arabia");
    expect(plan.input.industry).toBe("Oil & Gas");
    expect(plan.input.positions).toHaveLength(2);
    expect(plan.input.benefits).toHaveLength(2);
    expect(plan.input.style).toBe("VISUAL");
  });

  it("auto path never fabricates: optional missing facts stay absent, not placeholder-filled", () => {
    const plan = planAutoPublish({
      ...HALLIBURTON,
      benefits: { value: null, confidence: "LOW" },
      contact: { value: null, confidence: "LOW" },
    });
    expect(plan.mode).toBe("auto");
    if (plan.mode !== "auto") return;
    expect(plan.input.benefits).toEqual([]);
    expect(plan.input.contact).toEqual({});
  });
});

describe("planAutoPublish — manual exception path (extraction insufficient)", () => {
  it("falls back to manual when no positions were found, naming the missing field", () => {
    const plan = planAutoPublish({ ...HALLIBURTON, positions: [] });
    expect(plan.mode).toBe("manual");
    if (plan.mode !== "manual") return;
    expect(plan.reason).toMatch(/positions/);
    // Whatever WAS grounded is carried into the fallback form — never lost.
    expect(plan.partial.country).toBe("Saudi Arabia");
    expect(plan.partial.employer).toBe("Halliburton");
  });

  it("falls back to manual when country/industry are missing", () => {
    const plan = planAutoPublish({
      ...HALLIBURTON,
      country: emptyField,
      industry: emptyField,
    });
    expect(plan.mode).toBe("manual");
    if (plan.mode !== "manual") return;
    expect(plan.reason).toMatch(/country|industry/);
  });

  it("a completely empty extraction is always manual", () => {
    const plan = planAutoPublish(emptyExtractionResult("nothing useful"));
    expect(plan.mode).toBe("manual");
  });
});
