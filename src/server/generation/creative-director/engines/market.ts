/**
 * Market engines — deterministic, single-responsibility, traceable.
 *   • countryIntelligence   — destination prestige, premium colour, tone, flag
 *   • currencyIntelligence  — validate country → currency (wrong = FAIL)
 *   • employerIntelligence  — brand strength → prominence
 *   • industryIntelligence  — attractiveness, environment, prominence
 *
 * Playbook §17/§18: country and industry are LOCKED, table-driven
 * classifications — never re-improvised per campaign. These two engines
 * are therefore deterministic lookups by construction; the only
 * "logic" is honestly reporting confidence and applying the locked
 * fallback rule (specific match wins, generic fallback only when no
 * confident match exists — never a default preference).
 */

import type {
  CountryDecision, CreativeInput, CurrencyDecision, EmployerDecision,
  EngineOutput, IndustryDecision, Prominence,
} from "../types";
import {
  CREDIBLE_EMPLOYERS, MAGNET_EMPLOYERS, formatSalary, industryHasConfidentMatch,
  resolveCountry, resolveIndustry,
} from "../knowledge";

/** Playbook §17: attractiveness bands that set industry prominence. */
const INDUSTRY_PROMINENCE_HIGH_THRESHOLD = 85;
const INDUSTRY_PROMINENCE_MEDIUM_THRESHOLD = 72;

export function countryIntelligence(input: CreativeInput): EngineOutput<CountryDecision> {
  const c = resolveCountry(input.country);
  if (!c) {
    return {
      value: { country: input.country, prestige: "STABLE", premiumColour: "Neutral", emotionalTone: "OPPORTUNITY", flagKey: "" },
      trace: { engine: "countryIntelligence", decision: input.country, reason: `Destination "${input.country}" not in the locked country table (Playbook §18); defaulting to STABLE prestige, neutral colour — currencyIntelligence still hard-fails this destination.` },
    };
  }
  return {
    value: { country: c.name, prestige: c.prestige, premiumColour: c.premiumColour, emotionalTone: c.emotionalTone, flagKey: c.flagKey },
    trace: { engine: "countryIntelligence", decision: `${c.name} / ${c.prestige}`, reason: `${c.name} → prestige ${c.prestige}, premium colour ${c.premiumColour}, tone ${c.emotionalTone} (Playbook §18 locked table).` },
  };
}

export function currencyIntelligence(input: CreativeInput): EngineOutput<CurrencyDecision> {
  const c = resolveCountry(input.country);
  if (!c) {
    return {
      value: { currency: "UNKNOWN", valid: false, format: "" },
      trace: { engine: "currencyIntelligence", decision: "UNKNOWN / FAIL", reason: `No currency can be validated for "${input.country}" — wrong/undeterminable currency is a hard FAIL (Failure Library FL-023; never inferred loosely).` },
    };
  }
  return {
    value: { currency: c.currency, valid: true, format: formatSalary(c.currency, 12000) },
    trace: { engine: "currencyIntelligence", decision: `${c.currency} / VALID`, reason: `${c.name} uses ${c.currency}; example format ${formatSalary(c.currency, 12000)}.` },
  };
}

export function employerIntelligence(input: CreativeInput): EngineOutput<EmployerDecision> {
  const emp = (input.employer ?? "").trim();
  if (!emp) {
    return { value: { brandStrength: "UNKNOWN", prominence: "LOW" }, trace: { engine: "employerIntelligence", decision: "UNKNOWN / LOW", reason: "No employer supplied; opportunity leads, not a brand (Playbook §1)." } };
  }
  if (MAGNET_EMPLOYERS.test(emp)) {
    return { value: { brandStrength: "MAGNET", prominence: "HIGH" }, trace: { engine: "employerIntelligence", decision: "MAGNET / HIGH", reason: `"${emp}" is a candidate-magnet brand; it may lead the ad (Playbook §2: a genuine magnet brand can outrank salary and country).` } };
  }
  if (CREDIBLE_EMPLOYERS.test(emp)) {
    return { value: { brandStrength: "CREDIBLE", prominence: "MEDIUM", }, trace: { engine: "employerIntelligence", decision: "CREDIBLE / MEDIUM", reason: `"${emp}" is credible but not a magnet; use as credibility, not hero (Failure Library FL-002: employer must not dominate opportunity).` } };
  }
  return { value: { brandStrength: "UNKNOWN", prominence: "LOW" }, trace: { engine: "employerIntelligence", decision: "UNKNOWN / LOW", reason: `"${emp}" not recognized as a candidate magnet; demote to a trust line.` } };
}

export function industryIntelligence(input: CreativeInput): EngineOutput<IndustryDecision> {
  const i = resolveIndustry(input.industry);
  const confident = industryHasConfidentMatch(input.industry);
  const prominence: Prominence =
    i.attractiveness >= INDUSTRY_PROMINENCE_HIGH_THRESHOLD ? "HIGH"
    : i.attractiveness >= INDUSTRY_PROMINENCE_MEDIUM_THRESHOLD ? "MEDIUM"
    : "LOW";
  return {
    value: { attractiveness: i.attractiveness, environment: i.environment, prominence },
    trace: {
      engine: "industryIntelligence",
      decision: `${input.industry} / ${i.attractiveness}`,
      reason: confident
        ? `${input.industry} attractiveness ${i.attractiveness} → prominence ${prominence}; specific industry match (Playbook §17).`
        : `"${input.industry}" matched no specific industry — generic fallback used as a safety net, never a default preference (Playbook §17).`,
    },
  };
}
