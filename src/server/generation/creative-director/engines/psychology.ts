/**
 * Psychology engines — deterministic, single-responsibility, traceable.
 *   • opportunityRanking  — rank levers, pick exactly one hero, set prominence
 *   • candidatePsychology — the ONE dominant hook + motivation, DERIVED
 *                            from the locked hero lever
 *
 * Order matters and is enforced by the orchestrator: opportunityRanking
 * runs first and LOCKS the one hero lever (Decision Flow Stage 1);
 * candidatePsychology then composes the hook/motivation FROM that same
 * hero (Decision Flow Stage 2 "derive the emotional register from the
 * locked hero lever" + Stage 3 "compose the headline expressing the hero
 * lever + emotional register together"). Deriving the hook independently
 * of the hero — the previous design — risked the hook and the ranked
 * hero pointing at two different facts, which is exactly the "two-plus
 * claims competing for lead position" defect the Self-Review Checklist
 * (§21 item 1) and Failure Library FL-024 exist to catch.
 */

import type {
  CountryDecision, CreativeInput, EmployerDecision, EngineOutput, IndustryDecision,
  OpportunityLever, OpportunityRankingDecision, Prominence, ProjectDecision,
  PsychologyDecision, SalaryDecision, UrgencyDecision,
} from "../types";

export interface RankingInput {
  country: CountryDecision;
  salary: SalaryDecision;
  industry: IndustryDecision;
  project: ProjectDecision;
  employer: EmployerDecision;
  urgency: UrgencyDecision;
}

/**
 * Playbook §1 permanent rule: "Rank the levers (Country → Salary/Earning
 * → Industry → Project → Employer → Positions → Benefits → Interview →
 * Trust) — the rank order is a default priority, but any lever can win
 * if its grounded strength for this campaign clearly exceeds the
 * others."
 */
const DEFAULT_LEVER_ORDER: OpportunityLever[] = [
  "COUNTRY", "SALARY", "INDUSTRY", "PROJECT", "EMPLOYER", "POSITIONS", "BENEFITS", "INTERVIEW", "TRUST",
];

export function opportunityRanking(a: RankingInput): EngineOutput<OpportunityRankingDecision> {
  // Playbook §2 permanent rule, applied as explicit, auditable override
  // rules rather than tuned numeric weights:
  //   "Salary (when grounded) > country prestige > credible (non-magnet)
  //   employer name ... except that a genuine magnet-brand employer can
  //   outrank all three."
  let winner: OpportunityLever;
  let winnerReason: string;
  if (a.employer.brandStrength === "MAGNET") {
    winner = "EMPLOYER";
    winnerReason = "employer is a genuine magnet brand (Playbook §2: a magnet can outrank salary and country)";
  } else if (a.salary.hasSalary) {
    winner = "SALARY";
    winnerReason = "a grounded salary figure is present (Playbook §2: salary generally outranks country)";
  } else {
    winner = "COUNTRY";
    winnerReason = "no salary or magnet brand grounded; destination prestige is always available (Playbook §1 default lead)";
  }

  const ranked = [winner, ...DEFAULT_LEVER_ORDER.filter((l) => l !== winner)];
  const hero = ranked[0];

  const prominence = {
    employer: a.employer.prominence,
    country: (a.country.prestige === "PRIME" ? "HIGH" : a.country.prestige === "HIGH" ? "MEDIUM" : "LOW") as Prominence,
    industry: a.industry.prominence,
    project: a.project.prominence,
  };

  return {
    value: { ranked, hero, prominence },
    trace: {
      engine: "opportunityRanking",
      decision: `hero=${hero}`,
      reason: `One hero locked from the default priority order (Playbook §1), overridden because ${winnerReason}. Exactly one hero enforced (Self-Review §21.1).`,
    },
  };
}

export interface PsychologyInput {
  input: CreativeInput;
  country: CountryDecision;
  industry: IndustryDecision;
  project: ProjectDecision;
  employer: EmployerDecision;
  urgency: UrgencyDecision;
  opportunity: OpportunityRankingDecision;
}

/** Playbook §5: the emotional register a given hero lever implies. */
const EMOTION_BY_LEVER: Record<OpportunityLever, PsychologyDecision["motivation"]> = {
  COUNTRY: "OPPORTUNITY", // overwritten with the country's own tone below
  SALARY: "MONEY",
  INDUSTRY: "OPPORTUNITY",
  PROJECT: "MEGA_PROJECT",
  EMPLOYER: "PRESTIGE",
  POSITIONS: "OPPORTUNITY",
  BENEFITS: "STABLE",
  INTERVIEW: "URGENCY",
  TRUST: "STABLE",
};

/**
 * Composes the dominant hook FROM the locked hero lever — Decision Flow
 * Stage 3: "Compose the one specific, grounded headline claim expressing
 * the hero lever + emotional register together. Reject any hook that is
 * generic or unsupported by a grounded fact." (Playbook §4.)
 */
export function candidatePsychology(a: PsychologyInput): EngineOutput<PsychologyDecision> {
  const hero = a.opportunity.hero;
  let dominantHook: string;
  let motivation = EMOTION_BY_LEVER[hero];

  switch (hero) {
    case "SALARY":
      dominantHook = "Earning — salary opportunity";
      break;
    case "EMPLOYER":
      dominantHook = a.input.employer ?? a.input.industry;
      break;
    case "COUNTRY":
      dominantHook = `${a.country.country} · ${a.input.industry}`;
      motivation = a.country.emotionalTone;
      break;
    case "PROJECT":
      dominantHook = a.project.projectType;
      break;
    case "INDUSTRY":
      dominantHook = `${a.input.industry} opportunity in ${a.country.country}`;
      break;
    case "POSITIONS": {
      const count = a.input.positions.reduce((sum, p) => sum + (p.count ?? 1), 0);
      dominantHook = `${count} positions available`;
      break;
    }
    case "BENEFITS":
      dominantHook = "Complete benefits package";
      break;
    case "INTERVIEW":
      dominantHook = "Immediate interview";
      break;
    default: // TRUST
      dominantHook = `${a.input.agencyName} — verified opportunity`;
  }

  // Secondary hook: the next-strongest ranked lever, expressed briefly —
  // never the same fact as the hero (Playbook §4: hook and hero must
  // reinforce one idea, not repeat it).
  const secondaryLever = a.opportunity.ranked[1];
  const secondaryHook = secondaryLever
    ? secondaryHookFor(secondaryLever, a)
    : null;

  return {
    value: { dominantHook, secondaryHook, motivation },
    trace: {
      engine: "candidatePsychology",
      decision: dominantHook,
      reason: `Hook composed from the locked hero lever (${hero}), guaranteeing Stage 2/3 coherence with opportunityRanking (Decision Flow). Motivation ${motivation}.`,
    },
  };
}

function secondaryHookFor(lever: OpportunityLever, a: PsychologyInput): string | null {
  switch (lever) {
    case "SALARY": return "Earning opportunity";
    case "COUNTRY": return `${a.country.country} · ${a.input.industry}`;
    case "INDUSTRY": return a.input.industry;
    case "PROJECT": return a.project.projectType;
    case "EMPLOYER": return a.input.employer ?? null;
    case "INTERVIEW": return a.urgency.level !== "NONE" ? "Immediate interview" : "Career opportunity";
    default: return null;
  }
}
