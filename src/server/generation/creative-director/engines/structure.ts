/**
 * Structure engines — deterministic, single-responsibility, traceable.
 *   • typographyStrategy — 5-font hierarchy assignment
 *   • layoutStrategy     — poster family + columns (by density + channel)
 *   • ctaStrategy        — CTA priority + kind
 *   • trustStrategy      — trust-building order + proportionate priority
 *   • mobileStrategy     — must-survive vs may-shrink per channel
 */

import type {
  CountryDecision, CreativeInput, CtaStrategyDecision, EmployerDecision, EngineOutput,
  LayoutStrategyDecision, MobileStrategyDecision, Prominence, TrustStrategyDecision,
  TypographyStrategyDecision, UrgencyDecision,
} from "../types";
import { CHANNEL_CONSTRAINTS } from "../knowledge";

/** Playbook §7 permanent rule: locked 5-role hierarchy, never a per-campaign choice. */
export function typographyStrategy(): EngineOutput<TypographyStrategyDecision> {
  return {
    value: { hero: "Anton", secondary: "Oswald", table: "Barlow Condensed", cta: "Archivo Black" },
    trace: { engine: "typographyStrategy", decision: "Anton/Oswald/Barlow/Archivo", reason: "Locked 5-font hierarchy (Playbook §7): Anton hero, Oswald bars, Barlow positions, Archivo salary/CTA, Roboto Condensed body." },
  };
}

/** Playbook §16 permanent rule: "density above roughly a dozen roles favors newspaper grammar." */
const SINGLE_ROLE_THRESHOLD = 1;
const NEWSPAPER_MASS_THRESHOLD = 12;
const MULTI_VACANCY_THRESHOLD = 25;

export function layoutStrategy(input: CreativeInput): EngineOutput<LayoutStrategyDecision> {
  const channel = input.channel ?? "DTP_NEWSPAPER";
  const totalTitles = input.positions.length;
  const columns = CHANNEL_CONSTRAINTS[channel].columns;
  const family =
    totalTitles <= SINGLE_ROLE_THRESHOLD ? "SINGLE_ROLE_BOX"
    : totalTitles >= MULTI_VACANCY_THRESHOLD || (channel === "DTP_NEWSPAPER" && totalTitles >= NEWSPAPER_MASS_THRESHOLD) ? "MULTI_VACANCY_POSTER"
    : "DTP_GRID";
  return {
    value: { family, columns },
    trace: { engine: "layoutStrategy", decision: `${family} / ${columns}col`, reason: `${totalTitles} position group(s) on ${channel} → ${family} (${columns} columns); density-adaptive per Playbook §11/§16.` },
  };
}

/**
 * Playbook §13 permanent rule: "CTA prominence is proportional to
 * genuine, grounded urgency — never maximized by default." The previous
 * implementation never produced LOW priority (defaulting NONE-urgency
 * requirements to MEDIUM, contradicting "never maximized by default")
 * and never produced WHATSAPP even on a WhatsApp channel — the `kind`
 * type's WHATSAPP/PHONE/MIXED options were dead code.
 */
export function ctaStrategy(a: { urgency: UrgencyDecision; input: CreativeInput }): EngineOutput<CtaStrategyDecision> {
  const hasWalkIn = a.urgency.driver?.includes("walk-in") || a.urgency.driver?.includes("spot");
  const hasPhone = Boolean(a.input.positions.length || a.input.agencyName);

  let kind: CtaStrategyDecision["kind"];
  if (a.input.channel === "WHATSAPP") kind = "WHATSAPP";
  else if (hasWalkIn) kind = "WALK_IN";
  else kind = "EMAIL";

  const priority: Prominence =
    a.urgency.level === "HIGH" ? "HIGH"
    : a.urgency.level === "MEDIUM" ? "MEDIUM"
    : "LOW";

  return {
    value: { priority, kind },
    trace: { engine: "ctaStrategy", decision: `${kind} / ${priority}`, reason: `CTA ${kind} at ${priority} priority, proportional to grounded urgency (${a.urgency.level}) per Playbook §13 — never maximized by default; phone ${hasPhone}.` },
  };
}

/**
 * Playbook §12 permanent rule: "Trust elements occupy one protected,
 * proportionate footer zone — always present, never expanding to
 * dominate." Priority is capped at MEDIUM (trust must never outrank the
 * offer itself, so HIGH is never assigned here) and drops to LOW when
 * the opportunity already carries its own strong credibility signal (a
 * magnet employer in a PRIME-prestige country) and needs less extra
 * reassurance — never the reverse (trust is never elevated to compensate
 * for a weak offer; that is the offer's job, not the footer's).
 */
export function trustStrategy(a: { input: CreativeInput; employer: EmployerDecision; country: CountryDecision }): EngineOutput<TrustStrategyDecision> {
  const order = ["AGENCY_LOGO", "AGENCY_NAME", "MEA_RA", "QR_VERIFY"];
  if (a.input.raLicenseId) order.push("SINCE_YEAR");

  const alreadyCredible = a.employer.brandStrength === "MAGNET" && a.country.prestige === "PRIME";
  const priority: Prominence = alreadyCredible ? "LOW" : "MEDIUM";

  return {
    value: { order, priority },
    trace: { engine: "trustStrategy", decision: order.join(">"), reason: `Trust order: agency logo → name → MEA/RA → QR verify (→ since year). Priority ${priority} — proportionate, never expanding to dominate (Playbook §12); capped below HIGH${alreadyCredible ? "; lowered further since the offer itself already carries strong credibility (magnet employer + PRIME country)" : ""}.` },
  };
}

export function mobileStrategy(input: CreativeInput): EngineOutput<MobileStrategyDecision> {
  const channel = input.channel ?? "DTP_NEWSPAPER";
  const c = CHANNEL_CONSTRAINTS[channel];
  return {
    value: { mustSurvive: c.mustSurvive, mayShrink: c.mayShrink },
    trace: { engine: "mobileStrategy", decision: channel, reason: `Channel ${channel}: must survive ${c.mustSurvive.join(", ")}; may shrink ${c.mayShrink.join(", ")} — two-tier system per Playbook §15.` },
  };
}
