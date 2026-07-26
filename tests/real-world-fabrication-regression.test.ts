import { describe, expect, it } from "vitest";
import { runCreativeDirector } from "@/server/generation/creative-director/creative-director";
import { factsToCreativeInput } from "@/server/generation/creative-director/pipeline-adapter";
import { applyDestinationCurrency } from "@/server/generation/creative-director/knowledge";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt } from "@/server/generation/gpt-native/master-prompt-builder";
import { realWorldWelderFacts } from "./fixtures/real-world-welder-jd";
import { realWorldPowerEnergyFacts } from "./fixtures/real-world-power-energy-jd";
import type { AdvertisementFacts } from "@/server/generation/archetypes";

/**
 * Regression suite for real, delivered fabrication defects (not
 * hypothetical ones) — each case here was caught on an actual GPT Image
 * generation during live product testing, root-caused, and fixed. This
 * suite runs the full DETERMINISTIC half of the pipeline (Creative
 * Director -> Commercial Brief -> master prompt text) against those exact
 * fixtures on every test run, with no OpenAI call, so a future edit that
 * reintroduces any of these defect classes fails CI before a single real
 * generation is ever attempted — "fix before generation," not after.
 *
 * What this suite CANNOT catch: GPT itself choosing to hallucinate on a
 * given day (the model is stochastic) — that's exactly what
 * requiredCorrections/regeneration + REVIEW_RECOMMENDED flagging in
 * production exist for. This suite guards the KAI-controlled half: the
 * facts and instructions GPT is actually given.
 */
function currencyCorrect(facts: AdvertisementFacts): AdvertisementFacts {
  return {
    ...facts,
    benefits: facts.benefits.map((b) => (b.detail ? { ...b, detail: applyDestinationCurrency(b.detail, facts.country) } : b)),
    positions: facts.positions.map((p) => (p.salary ? { ...p, salary: applyDestinationCurrency(p.salary, facts.country) } : p)),
  };
}

describe("Real-world fixture — welder JD (Abu Dhabi, no real salary given)", () => {
  const facts = currencyCorrect(realWorldWelderFacts);
  const direction = runCreativeDirector(factsToCreativeInput(facts, { aspectRatio: 1024 / 1536 }));
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, facts, { widthPx: 1024, heightPx: 1536 });

  it("never treats a bare currency code inside a non-salary benefit as a real salary", () => {
    // "Food Allowance — 300 AED" must NOT set hasSalary — this is the
    // exact defect that caused "EARNING 3,800 AED" to be fabricated.
    expect(direction.salary.hasSalary).toBe(false);
    expect(direction.salary.salaryText).toBeNull();
  });

  it("the dominant hook is never a salary hook when no real salary exists", () => {
    expect(direction.opportunity.hero).not.toBe("SALARY");
    expect(direction.psychology.dominantHook.toLowerCase()).not.toContain("earning");
  });

  it("the master prompt never tells GPT to lead with a salary offer that doesn't exist", () => {
    expect(prompt).not.toMatch(/lead with the salary offer/i);
  });

  it("the master prompt's fidelity guardrails are present verbatim (regression-proofing the instruction text itself)", () => {
    expect(prompt).toContain("If a monetary figure has NO currency stated in the facts above");
    expect(prompt).toContain("Never assume \"$\"/USD or any other currency");
  });
});

describe("Real-world fixture — Power & Energy JD (Saudi Arabia, real salary range given)", () => {
  const facts = currencyCorrect(realWorldPowerEnergyFacts);
  const direction = runCreativeDirector(factsToCreativeInput(facts, { aspectRatio: 1024 / 1536 }));
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, facts, { widthPx: 1024, heightPx: 1536 });

  it("applies the destination's real currency to the bare '5K to 7K' figure before anything else sees it", () => {
    expect(facts.benefits[0].detail).toBe("SAR 5K to 7K Basic (varies based on interview assessment)");
  });

  it("a real salary IS detected and becomes the hero lever", () => {
    expect(direction.salary.hasSalary).toBe(true);
    expect(direction.opportunity.hero).toBe("SALARY");
  });

  it("the dominant hook embeds the REAL currency-labeled figure, not a blank phrase GPT has to fill in", () => {
    // This is the exact regression for the "EARNING SAR 50-700" fabrication
    // — the hook must contain the true figure, verbatim.
    expect(direction.psychology.dominantHook).toBe(`Earning ${direction.salary.salaryText}`);
    expect(direction.psychology.dominantHook).toContain("SAR 5K to 7K");
  });

  it("the master prompt's factual content carries the corrected currency, not the bare source figure", () => {
    expect(prompt).toContain("SAR 5K to 7K Basic");
  });

  it("the master prompt explicitly forbids inventing a position count", () => {
    // Real defect: GPT added "(10 openings)" to a position given with NO count.
    expect(prompt).toContain("If NO count is given for a position, do not add one");
  });

  it("the master prompt explicitly forbids altering any number in the requirement/footer note", () => {
    // Real defect: GPT changed "5+ Years of Experience" to "3+".
    expect(prompt).toContain("Every number in the \"IMPORTANT NOTE\"");
    expect(prompt).toContain(facts.footer!);
  });

  it("the master prompt's blanket fidelity rule is not narrowed to only a few named fields", () => {
    expect(prompt).toMatch(/without exception/i);
  });
});
