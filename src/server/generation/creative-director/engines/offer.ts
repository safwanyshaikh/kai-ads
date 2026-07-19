/**
 * Offer engines — deterministic, single-responsibility, traceable.
 *   • salaryIntelligence   — salary/overtime/vacancy prominence (never invents)
 *   • benefitsIntelligence — rank grounded benefits (never invents)
 *   • projectIntelligence  — thematic project descriptor + attractiveness
 *   • urgencyIntelligence  — urgency level + driver
 */

import type {
  BenefitsDecision, CreativeInput, EngineOutput, Prominence, ProjectDecision,
  SalaryDecision, UrgencyDecision, UrgencyLevel,
} from "../types";
import { resolveIndustry } from "../knowledge";

/**
 * Priority order for benefit ranking (Playbook §14: "every grounded
 * benefit is displayed, ranked by category priority — never a subset
 * chosen for space convenience"). Order matches the locked Benefit
 * Intelligence priority list (Creative Director Module §8).
 */
const BENEFIT_ORDER: [RegExp, string][] = [
  [/salary/i, "Salary"], [/overtime|\bot\b/i, "Overtime"], [/food/i, "Food"],
  [/accommo|housing/i, "Accommodation"], [/transport/i, "Transportation"],
  [/medical|health/i, "Medical"], [/insurance/i, "Insurance"],
  [/air\s*ticket|ticket|flight/i, "Air Ticket"], [/leave|vacation/i, "Leave"],
  [/contract|duration|long\s*term/i, "Contract Duration"],
];

/** Playbook §11/§16: "density above roughly a dozen roles" is the mass-hiring threshold. */
const VACANCY_PROMINENCE_HIGH_THRESHOLD = 50;
const VACANCY_PROMINENCE_MEDIUM_THRESHOLD = 15;

export function salaryIntelligence(input: CreativeInput): EngineOutput<SalaryDecision> {
  const posHasSalary = input.positions.some((p) => (p.salary ?? "").trim().length > 0);
  const benefitsText = input.benefits.map((b) => `${b.label} ${b.detail ?? ""}`).join(" ");
  const salaryInBenefits = /salary|basic pay|\bsar\b|\baed\b|\bqar\b|\bkwd\b|\bbhd\b|\bomr\b/i.test(benefitsText);
  const hasSalary = posHasSalary || salaryInBenefits;
  const overtimePresent = /overtime|\bot\b/i.test(benefitsText) || input.positions.some((p) => /overtime|\bot\b/i.test(p.salary ?? ""));
  const vacancyCount = input.positions.reduce((a, p) => a + (p.count ?? 1), 0);
  const prominence: Prominence = hasSalary ? "HIGH" : "LOW";
  const vacancyProminence: Prominence =
    vacancyCount >= VACANCY_PROMINENCE_HIGH_THRESHOLD ? "HIGH"
    : vacancyCount >= VACANCY_PROMINENCE_MEDIUM_THRESHOLD ? "MEDIUM"
    : "LOW";
  return {
    value: { hasSalary, overtimePresent, prominence, vacancyCount, vacancyProminence },
    trace: { engine: "salaryIntelligence", decision: `salary=${hasSalary} ot=${overtimePresent} vac=${vacancyCount}`, reason: `Salary ${hasSalary ? "present → HIGH" : "absent → LOW (never fabricated, Playbook §2)"}; overtime ${overtimePresent}; ${vacancyCount} vacancies → ${vacancyProminence}.` },
  };
}

export function benefitsIntelligence(input: CreativeInput): EngineOutput<BenefitsDecision> {
  const text = input.benefits.map((b) => `${b.label} ${b.detail ?? ""}`);
  const ranked: string[] = [];
  for (const [re, label] of BENEFIT_ORDER) {
    if (text.some((t) => re.test(t))) ranked.push(label);
  }
  // Playbook §14: every grounded benefit is shown — keep any benefit that
  // didn't match a canonical bucket rather than silently dropping it.
  for (const b of input.benefits) {
    if (!ranked.some((r) => r.toLowerCase() === b.label.toLowerCase()) && !BENEFIT_ORDER.some(([re]) => re.test(b.label))) {
      ranked.push(b.label);
    }
  }
  const primary = ranked[0] ?? null;
  const prominence: Prominence = ranked.length >= 4 ? "HIGH" : ranked.length >= 2 ? "MEDIUM" : "LOW";
  return {
    value: { ranked, primary, prominence },
    trace: { engine: "benefitsIntelligence", decision: `${ranked.length} ranked; primary=${primary ?? "none"}`, reason: `Ranked ALL ${input.benefits.length} grounded benefit(s) by category priority; none omitted for space (Playbook §14); prominence ${prominence}.` },
  };
}

export function projectIntelligence(input: CreativeInput): EngineOutput<ProjectDecision> {
  const i = resolveIndustry(input.industry);
  const header = (input.header ?? "").toLowerCase();
  const shutdown = /shutdown|turnaround|\btar\b/.test(header);
  const projectType = shutdown ? "a major shutdown / turnaround project"
    : /oil|gas|petro|refin/i.test(input.industry) ? "a major oil & gas project"
    : `a major ${input.industry} project`;
  const attractiveness = Math.min(100, i.attractiveness + (shutdown ? 4 : 0));
  const prominence: Prominence = shutdown ? "MEDIUM" : attractiveness >= 85 ? "MEDIUM" : "LOW";
  return {
    value: { projectType, attractiveness, prominence },
    trace: { engine: "projectIntelligence", decision: projectType, reason: `Thematic project descriptor from industry${shutdown ? " + shutdown signal" : ""}; prominence ${prominence}.` },
  };
}

export function urgencyIntelligence(input: CreativeInput): EngineOutput<UrgencyDecision> {
  const signals = (input.sourceSignals ?? []).join(" ").toLowerCase() + " " + (input.header ?? "").toLowerCase();
  const spot = /spot\s*selection|walk[-\s]?in/.test(signals);
  const urgent = /urgent|immediate|mobiliz/.test(signals);
  const hasInterview = input.interview.some((i) => (i.date ?? "").trim().length > 0);
  let level: UrgencyLevel = "NONE";
  let driver: string | null = null;
  if (spot) { level = "HIGH"; driver = "spot selection / walk-in"; }
  else if (hasInterview) { level = "MEDIUM"; driver = "date-bound client interviews"; }
  else if (urgent) { level = "MEDIUM"; driver = "urgent mobilization"; }
  return {
    value: { level, driver },
    trace: { engine: "urgencyIntelligence", decision: level, reason: driver ? `Urgency ${level} — ${driver}.` : "No grounded urgency signal — CTA priority stays proportionate, never maximized by default (Playbook §13)." },
  };
}
