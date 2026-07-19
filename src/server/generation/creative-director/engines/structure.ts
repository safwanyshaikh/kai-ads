/**
 * Structure engines — deterministic, single-responsibility, traceable.
 *   • typographyStrategy — 5-font hierarchy assignment
 *   • layoutStrategy     — poster family + columns (by density + channel)
 *   • ctaStrategy        — CTA priority + kind
 *   • trustStrategy      — trust-building order
 *   • mobileStrategy     — must-survive vs may-shrink per channel
 */

import type {
  CreativeInput, CtaStrategyDecision, EngineOutput, LayoutStrategyDecision,
  MobileStrategyDecision, Prominence, TrustStrategyDecision, TypographyStrategyDecision,
  UrgencyDecision,
} from "../types";
import { CHANNEL_CONSTRAINTS } from "../knowledge";

/** The locked KAI 5-font system (doc 07/09). */
export function typographyStrategy(): EngineOutput<TypographyStrategyDecision> {
  return {
    value: { hero: "Anton", secondary: "Oswald", table: "Barlow Condensed", cta: "Archivo Black" },
    trace: { engine: "typographyStrategy", decision: "Anton/Oswald/Barlow/Archivo", reason: "Locked 5-font hierarchy: Anton hero, Oswald bars, Barlow positions, Archivo salary/CTA, Roboto Condensed body." },
  };
}

export function layoutStrategy(input: CreativeInput): EngineOutput<LayoutStrategyDecision> {
  const channel = input.channel ?? "DTP_NEWSPAPER";
  const totalTitles = input.positions.length;
  const columns = CHANNEL_CONSTRAINTS[channel].columns;
  const family =
    totalTitles <= 1 ? "SINGLE_ROLE_BOX"
    : totalTitles >= 25 || channel === "DTP_NEWSPAPER" && totalTitles >= 12 ? "MULTI_VACANCY_POSTER"
    : "DTP_GRID";
  return {
    value: { family, columns },
    trace: { engine: "layoutStrategy", decision: `${family} / ${columns}col`, reason: `${totalTitles} position group(s) on ${channel} → ${family} (${columns} columns).` },
  };
}

export function ctaStrategy(a: { urgency: UrgencyDecision; input: CreativeInput }): EngineOutput<CtaStrategyDecision> {
  const hasWalkIn = a.urgency.driver?.includes("walk-in") || a.urgency.driver?.includes("spot");
  const hasPhone = Boolean(a.input.positions.length || a.input.agencyName);
  const kind: CtaStrategyDecision["kind"] = hasWalkIn ? "WALK_IN" : "EMAIL";
  const priority: Prominence = a.urgency.level === "HIGH" ? "HIGH" : "MEDIUM";
  return {
    value: { priority, kind },
    trace: { engine: "ctaStrategy", decision: `${kind} / ${priority}`, reason: `CTA ${kind} at ${priority} priority (${a.urgency.level === "HIGH" ? "time-bound" : "standard"}); phone ${hasPhone}.` },
  };
}

export function trustStrategy(input: CreativeInput): EngineOutput<TrustStrategyDecision> {
  const order = ["AGENCY_LOGO", "AGENCY_NAME", "MEA_RA", "QR_VERIFY"];
  if (input.raLicenseId) order.push("SINCE_YEAR");
  return {
    value: { order, priority: "MEDIUM" },
    trace: { engine: "trustStrategy", decision: order.join(">"), reason: "Trust order: agency logo → name → MEA/RA → QR verify (→ since year). Present, credible, footer-weight." },
  };
}

export function mobileStrategy(input: CreativeInput): EngineOutput<MobileStrategyDecision> {
  const channel = input.channel ?? "DTP_NEWSPAPER";
  const c = CHANNEL_CONSTRAINTS[channel];
  return {
    value: { mustSurvive: c.mustSurvive, mayShrink: c.mayShrink },
    trace: { engine: "mobileStrategy", decision: channel, reason: `Channel ${channel}: must survive ${c.mustSurvive.join(", ")}; may shrink ${c.mayShrink.join(", ")}.` },
  };
}
