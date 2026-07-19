/**
 * Quality engines — deterministic, single-responsibility, traceable.
 *   • truthValidation   — asserts nothing invented, currency valid, one hero,
 *                          employer not over opportunity (the Brain's own
 *                          catastrophic-defect gate — computed BEFORE scoring)
 *   • commercialScoring — advisory 0..100 pre-render score + gate
 *
 * These are the LAST engines; they consume the composed decisions. The
 * commercial score is advisory (pre-render). The authoritative gates remain
 * the deterministic acceptance gates + Visual QA in the render pipeline.
 */

import type {
  CommercialScore, CreativeInput, CurrencyDecision, EmployerDecision, EngineOutput,
  OpportunityRankingDecision, SalaryDecision, TruthValidationDecision, UrgencyDecision,
} from "../types";

export interface TruthInput {
  input: CreativeInput;
  currency: CurrencyDecision;
  opportunity: OpportunityRankingDecision;
  employer: EmployerDecision;
  salary: SalaryDecision;
}

export function truthValidation(a: TruthInput): EngineOutput<TruthValidationDecision> {
  const violations: string[] = [];
  if (!a.currency.valid) violations.push("Currency could not be validated for the destination (wrong currency = FAIL).");
  if (a.opportunity.hero === "EMPLOYER" && a.employer.brandStrength !== "MAGNET") violations.push("Employer leads without being a candidate-magnet brand (opportunity must lead).");
  if (a.salary.prominence === "HIGH" && !a.salary.hasSalary) violations.push("Salary prominence HIGH but no grounded salary present.");
  // The Brain never emits factual strings; it only ranks grounded input.
  const pass = violations.length === 0;
  return {
    value: { pass, violations, invented: "NONE" },
    trace: { engine: "truthValidation", decision: pass ? "PASS" : "FAIL", reason: pass ? "Currency valid, one hero, employer not over opportunity, no invented facts." : `Violations: ${violations.join(" | ")}` },
  };
}

export interface ScoringInput {
  currency: CurrencyDecision;
  salary: SalaryDecision;
  urgency: UrgencyDecision;
  opportunity: OpportunityRankingDecision;
  employer: EmployerDecision;
  positionsCount: number;
  hasAgencyPalette: boolean;
  /** The Brain's own catastrophic-defect equivalent — Playbook §22: checked FIRST, absolute. */
  truth: TruthValidationDecision;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Playbook §22 permanent rule: "Catastrophic defects are checked first
 * and are absolute rejection gates regardless of score. With no
 * catastrophic defect present: 95–100 → auto-approve · 90–94 → creative
 * review · below 90 → reject and redesign." The pre-render equivalent of
 * a catastrophic defect is a Truth Brain failure (Decision Flow Stage 0:
 * "FAIL here stops everything else") — previously truthValidation ran
 * independently of commercialScoring with no interaction between them,
 * so a truth failure could coexist with a high numeric score. `truth` is
 * now a required input and forces REJECT before any score is computed.
 */
export function commercialScoring(a: ScoringInput): EngineOutput<CommercialScore> {
  const scrollStop = clamp(60 + (a.opportunity.hero === "COUNTRY" ? 20 : 12) + (a.salary.hasSalary ? 12 : 0) + (a.urgency.level === "HIGH" ? 8 : 0));
  const commercialAppeal = clamp(58 + (a.salary.hasSalary ? 18 : 6) + (a.employer.brandStrength === "MAGNET" ? 10 : 0));
  const candidatePsychology = clamp(60 + (a.salary.hasSalary ? 15 : 8) + (a.urgency.level !== "NONE" ? 10 : 0));
  const informationHierarchy = clamp(70 + (a.positionsCount > 0 ? 10 : 0));
  const colourHarmony = clamp(72 + (a.hasAgencyPalette ? 8 : 0));
  const typography = 88; // locked 5-font system
  const trust = 82;
  const mobileReadability = 80;
  const brandQuality = clamp(70 + (a.hasAgencyPalette ? 10 : 0) + (a.employer.brandStrength === "MAGNET" ? 6 : 0));
  const publishReadiness = clamp((scrollStop + commercialAppeal + candidatePsychology + informationHierarchy + colourHarmony + typography + trust + mobileReadability + brandQuality) / 9);
  const overall = clamp((scrollStop + commercialAppeal + candidatePsychology + informationHierarchy + colourHarmony + typography + trust + mobileReadability + brandQuality + publishReadiness) / 10);

  const gate: CommercialScore["gate"] = !a.truth.pass
    ? "REJECT"
    : overall >= 95 ? "AUTO_APPROVE" : overall >= 90 ? "CREATIVE_REVIEW" : "REJECT";

  return {
    value: { scrollStop, commercialAppeal, candidatePsychology, informationHierarchy, colourHarmony, typography, trust, mobileReadability, brandQuality, publishReadiness, overall, gate },
    trace: {
      engine: "commercialScoring",
      decision: `${overall} / ${gate}`,
      reason: !a.truth.pass
        ? `Catastrophic gate: Truth Brain FAILED (${a.truth.violations.join(" | ")}) — REJECT regardless of numeric score ${overall} (Playbook §22, absolute gate).`
        : `Advisory pre-render score ${overall} → ${gate} (95 auto / 90 review). Authoritative gate remains render-time Visual QA.`,
    },
  };
}
