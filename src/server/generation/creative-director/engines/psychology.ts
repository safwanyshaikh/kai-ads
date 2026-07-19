/**
 * Psychology engines — deterministic, single-responsibility, traceable.
 *   • candidatePsychology — the ONE dominant hook + motivation
 *   • opportunityRanking  — rank levers, pick exactly one hero, set prominence
 *
 * These consume prior engine values (composed by the orchestrator) but remain
 * pure functions of their arguments, so they stay independently testable.
 */

import type {
  CountryDecision, CreativeInput, EmployerDecision, EngineOutput, IndustryDecision,
  OpportunityLever, OpportunityRankingDecision, Prominence, ProjectDecision,
  PsychologyDecision, SalaryDecision, UrgencyDecision,
} from "../types";

export interface PsychologyInput {
  input: CreativeInput;
  country: CountryDecision;
  salary: SalaryDecision;
  employer: EmployerDecision;
  urgency: UrgencyDecision;
}

export function candidatePsychology(a: PsychologyInput): EngineOutput<PsychologyDecision> {
  // Strongest grounded, legally-emphasizable lever leads. Never a number if
  // no salary exists; never an unknown brand.
  let dominantHook: string;
  let secondaryHook: string | null = null;
  let motivation = a.country.emotionalTone;

  if (a.salary.hasSalary) {
    dominantHook = "Earning — salary opportunity";
    motivation = "MONEY";
    secondaryHook = `${a.country.country} · ${a.input.industry}`;
  } else if (a.country.prestige === "PRIME") {
    dominantHook = `${a.country.country} · ${a.input.industry}`;
    motivation = a.country.emotionalTone;
    secondaryHook = a.urgency.level !== "NONE" ? "Immediate interview" : "Career opportunity";
  } else if (a.employer.brandStrength === "MAGNET") {
    dominantHook = a.input.employer ?? a.input.industry;
    motivation = "PRESTIGE";
    secondaryHook = `${a.country.country} · ${a.input.industry}`;
  } else {
    dominantHook = `${a.country.country} · ${a.input.industry}`;
    motivation = "CAREER";
  }
  return {
    value: { dominantHook, secondaryHook, motivation },
    trace: { engine: "candidatePsychology", decision: dominantHook, reason: `One dominant hook chosen from the strongest grounded lever (salary→money, else prime destination/sector, else magnet brand). Motivation ${motivation}.` },
  };
}

export interface RankingInput {
  country: CountryDecision;
  salary: SalaryDecision;
  industry: IndustryDecision;
  project: ProjectDecision;
  employer: EmployerDecision;
  urgency: UrgencyDecision;
}

const pScore: Record<Prominence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function opportunityRanking(a: RankingInput): EngineOutput<OpportunityRankingDecision> {
  const weights: Record<OpportunityLever, number> = {
    COUNTRY: a.country.prestige === "PRIME" ? 100 : a.country.prestige === "HIGH" ? 80 : 60,
    SALARY: a.salary.hasSalary ? 95 : 20,
    INDUSTRY: a.industry.attractiveness,
    PROJECT: a.project.attractiveness - 5,
    EMPLOYER: a.employer.brandStrength === "MAGNET" ? 90 : a.employer.brandStrength === "CREDIBLE" ? 55 : 25,
    POSITIONS: a.salary.vacancyProminence === "HIGH" ? 78 : a.salary.vacancyProminence === "MEDIUM" ? 62 : 45,
    BENEFITS: 50,
    INTERVIEW: a.urgency.level === "HIGH" ? 72 : a.urgency.level === "MEDIUM" ? 60 : 30,
    TRUST: 40,
  };
  const ranked = (Object.keys(weights) as OpportunityLever[]).sort((x, y) => weights[y] - weights[x]);
  const hero = ranked[0];
  const prominence = {
    employer: a.employer.prominence,
    country: (a.country.prestige === "PRIME" ? "HIGH" : a.country.prestige === "HIGH" ? "MEDIUM" : "LOW") as Prominence,
    industry: a.industry.prominence,
    project: a.project.prominence,
  };
  // Guard: employer must never out-rank the opportunity unless it is a magnet.
  const employerOverOpportunity = hero === "EMPLOYER" && a.employer.brandStrength !== "MAGNET";
  return {
    value: { ranked, hero: employerOverOpportunity ? ranked[1] : hero, prominence },
    trace: { engine: "opportunityRanking", decision: `hero=${employerOverOpportunity ? ranked[1] : hero}`, reason: `Ranked levers by grounded weight; one hero enforced; employer may only lead if MAGNET (guard ${employerOverOpportunity ? "applied" : "clear"}). pScore ref ${pScore.HIGH}.` },
  };
}
