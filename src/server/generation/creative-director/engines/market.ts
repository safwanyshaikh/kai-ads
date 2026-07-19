/**
 * Market engines — deterministic, single-responsibility, traceable.
 *   • countryIntelligence   — destination prestige, premium colour, tone, flag
 *   • currencyIntelligence  — validate country → currency (wrong = FAIL)
 *   • employerIntelligence  — brand strength → prominence
 *   • industryIntelligence  — attractiveness, environment, prominence
 */

import type {
  CountryDecision, CreativeInput, CurrencyDecision, EmployerDecision,
  EngineOutput, IndustryDecision, Prominence,
} from "../types";
import {
  CREDIBLE_EMPLOYERS, MAGNET_EMPLOYERS, formatSalary, resolveCountry, resolveIndustry,
} from "../knowledge";

export function countryIntelligence(input: CreativeInput): EngineOutput<CountryDecision> {
  const c = resolveCountry(input.country);
  if (!c) {
    return {
      value: { country: input.country, prestige: "STABLE", premiumColour: "Neutral", emotionalTone: "OPPORTUNITY", flagKey: "" },
      trace: { engine: "countryIntelligence", decision: input.country, reason: `Destination "${input.country}" not in the knowledge table; defaulting to STABLE prestige, neutral colour.` },
    };
  }
  return {
    value: { country: c.name, prestige: c.prestige, premiumColour: c.premiumColour, emotionalTone: c.emotionalTone, flagKey: c.flagKey },
    trace: { engine: "countryIntelligence", decision: `${c.name} / ${c.prestige}`, reason: `${c.name} → prestige ${c.prestige}, premium colour ${c.premiumColour}, tone ${c.emotionalTone}.` },
  };
}

export function currencyIntelligence(input: CreativeInput): EngineOutput<CurrencyDecision> {
  const c = resolveCountry(input.country);
  if (!c) {
    return {
      value: { currency: "UNKNOWN", valid: false, format: "" },
      trace: { engine: "currencyIntelligence", decision: "UNKNOWN / FAIL", reason: `No currency can be validated for "${input.country}" — wrong/undeterminable currency is a FAIL.` },
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
    return { value: { brandStrength: "UNKNOWN", prominence: "LOW" }, trace: { engine: "employerIntelligence", decision: "UNKNOWN / LOW", reason: "No employer supplied; opportunity leads, not a brand." } };
  }
  if (MAGNET_EMPLOYERS.test(emp)) {
    return { value: { brandStrength: "MAGNET", prominence: "HIGH" }, trace: { engine: "employerIntelligence", decision: "MAGNET / HIGH", reason: `"${emp}" is a candidate-magnet brand; it may lead the ad.` } };
  }
  if (CREDIBLE_EMPLOYERS.test(emp)) {
    return { value: { brandStrength: "CREDIBLE", prominence: "MEDIUM", }, trace: { engine: "employerIntelligence", decision: "CREDIBLE / MEDIUM", reason: `"${emp}" is credible but not a magnet; use as credibility, not hero.` } };
  }
  return { value: { brandStrength: "UNKNOWN", prominence: "LOW" }, trace: { engine: "employerIntelligence", decision: "UNKNOWN / LOW", reason: `"${emp}" not recognized as a candidate magnet; demote to a trust line.` } };
}

export function industryIntelligence(input: CreativeInput): EngineOutput<IndustryDecision> {
  const i = resolveIndustry(input.industry);
  const prominence: Prominence = i.attractiveness >= 85 ? "HIGH" : i.attractiveness >= 72 ? "MEDIUM" : "LOW";
  return {
    value: { attractiveness: i.attractiveness, environment: i.environment, prominence },
    trace: { engine: "industryIntelligence", decision: `${input.industry} / ${i.attractiveness}`, reason: `${input.industry} attractiveness ${i.attractiveness} → prominence ${prominence}; environment seed set.` },
  };
}
