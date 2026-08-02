import {
  AUDIENCE_STRATEGY,
  HIRING_PATTERN_STRATEGY,
  INFORMATION_PRIORITY,
  PLANT_STATUS_STRATEGY,
  SCARCITY_STRATEGY,
  TRUST_STRATEGY,
} from "./strategy-map";
import { UNKNOWN, type Unknown } from "@/server/job-order-intelligence/determinations";
import { classifyDensity } from "@/server/generation/density-classification.service";

/**
 * Campaign Intelligence — the determinations.
 *
 *   ... -> Compliance Intelligence -> **Campaign Intelligence** -> ...
 *
 * Decides HOW a recruitment requirement should be communicated. It
 * generates no advertisement, selects no layout, and renders nothing. It
 * never decides typography, colour or position.
 *
 * WHAT MAKES THIS ENGINE SAFE
 *
 * It reasons over the OUTPUTS of JobOrder Intelligence and Compliance
 * Intelligence, never over raw text. Every determination declares which
 * upstream attributes it depends on, and two rules follow from that:
 *
 *   1. If any dependency is UNKNOWN, this determination is UNKNOWN. A
 *      campaign message cannot be derived from an industry nobody could
 *      establish.
 *   2. Confidence is capped by the LEAST confident dependency. A message
 *      derived from a plant status known at 70% is not knowable at 95%.
 *
 * That is the whole guessing-prevention mechanism, and it is structural
 * rather than a rule each determiner has to remember.
 */

export interface CampaignDetermination {
  attribute: string;
  /** The communication decision, or UNKNOWN. */
  value: string | Unknown;
  /** 0–100. Zero whenever the value is UNKNOWN. */
  confidencePct: number;
  /** Which upstream determinations this was derived from. */
  source: string;
  /** Plain-language explanation. Never empty. */
  reason: string;
  /** The upstream attributes depended on, for audit and for re-derivation. */
  dependsOn: string[];
}

/** One upstream determination, as Task 003 and Task 004 record them. */
export interface UpstreamDetermination {
  value: string;
  confidencePct: number;
}

export interface CampaignInput {
  /** JobOrder Intelligence determinations, keyed by attribute. */
  intelligence: Record<string, UpstreamDetermination | undefined>;
  /** Compliance Intelligence summary. */
  compliance: {
    /** COMPLIANCE_READINESS value: READY | ACTION_REQUIRED | BLOCKED | UNKNOWN. */
    readiness: string;
    agencyVerified: boolean;
  };
  /** Canonical JobOrder facts the campaign needs but intelligence does not carry. */
  jobOrder: {
    employerName: string | null;
    interviewDateStated: boolean;
    contactStated: boolean;
    positions: { title: string; count: number | null; salary: string | null }[];
  };
}

const upstream = (input: CampaignInput, attribute: string): UpstreamDetermination | null => {
  const determination = input.intelligence[attribute];
  if (!determination || determination.value === UNKNOWN) return null;
  return determination;
};

function unknownFor(attribute: string, dependsOn: string[], reason: string): CampaignDetermination {
  return {
    attribute,
    value: UNKNOWN,
    confidencePct: 0,
    source: dependsOn.length > 0 ? dependsOn.join(", ") : "none",
    reason,
    dependsOn,
  };
}

/**
 * Derives one determination from named upstream attributes.
 *
 * If any dependency is missing or UNKNOWN, the result is UNKNOWN and the
 * reason names exactly which input was absent — so a gap in the campaign
 * is traceable to the gap upstream that caused it, rather than appearing
 * as an unexplained blank.
 */
function derive(
  attribute: string,
  input: CampaignInput,
  dependsOn: string[],
  compute: (values: Record<string, string>) => { value: string; reason: string } | null,
): CampaignDetermination {
  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  let cap = 100;

  for (const dependency of dependsOn) {
    const determination = upstream(input, dependency);
    if (!determination) {
      missing.push(dependency);
      continue;
    }
    resolved[dependency] = determination.value;
    cap = Math.min(cap, determination.confidencePct);
  }

  if (missing.length > 0) {
    return unknownFor(
      attribute,
      dependsOn,
      `Cannot be determined because ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} UNKNOWN upstream. Reported as UNKNOWN rather than assumed — a communication decision built on an unknown fact is a guess presented as a strategy.`,
    );
  }

  const computed = compute(resolved);
  if (!computed) {
    return unknownFor(
      attribute,
      dependsOn,
      `No strategy is defined for ${dependsOn.map((dependency) => `${dependency} = "${resolved[dependency]}"`).join(", ")}. Reported as UNKNOWN rather than approximated from a neighbouring case.`,
    );
  }

  return {
    attribute,
    value: computed.value,
    // Capped by the least confident input: a campaign decision cannot be
    // more certain than the intelligence it rests on.
    confidencePct: cap,
    source: dependsOn.join(", "),
    reason: `${computed.reason} Confidence capped at ${cap}% by the least certain input (${dependsOn.map((dependency) => `${dependency} ${input.intelligence[dependency]?.confidencePct}%`).join(", ")}).`,
    dependsOn,
  };
}

// ---------------------------------------------------------------------------
// Determinations
// ---------------------------------------------------------------------------

export function determineObjective(input: CampaignInput): CampaignDetermination {
  return derive("primaryCampaignObjective", input, ["hiringPattern"], (values) => {
    const strategy = HIRING_PATTERN_STRATEGY[values.hiringPattern];
    if (!strategy) return null;
    return {
      value: strategy.objective,
      reason: `Hiring pattern is "${values.hiringPattern}". ${strategy.rationale}`,
    };
  });
}

export function determinePrimaryMessage(input: CampaignInput): CampaignDetermination {
  return derive("primaryCommunicationMessage", input, ["plantStatus"], (values) => {
    const strategy = PLANT_STATUS_STRATEGY[values.plantStatus];
    if (!strategy) return null;
    const industry = upstream(input, "industry");
    const message = industry
      ? `${strategy.primaryMessage} — ${industry.value}`
      : strategy.primaryMessage;
    return {
      value: message,
      reason: `Plant status is "${values.plantStatus}". ${strategy.rationale}`,
    };
  });
}

export function determineSecondaryMessage(input: CampaignInput): CampaignDetermination {
  return derive("secondaryMessage", input, ["candidateScarcity"], (values) => {
    const strategy = SCARCITY_STRATEGY[values.candidateScarcity];
    if (!strategy) return null;
    return {
      value: strategy.secondaryMessage,
      reason: `Candidate scarcity is "${values.candidateScarcity}". ${strategy.rationale}`,
    };
  });
}

export function determineCandidateMotivation(input: CampaignInput): CampaignDetermination {
  return derive("candidateMotivation", input, ["plantStatus"], (values) => {
    const strategy = PLANT_STATUS_STRATEGY[values.plantStatus];
    if (!strategy) return null;
    return {
      value: strategy.candidateMotivation,
      reason: `Plant status is "${values.plantStatus}". ${strategy.rationale}`,
    };
  });
}

/**
 * Trust strategy, driven by Compliance Intelligence rather than by the
 * requirement's content.
 *
 * A live compliance violation stops the campaign outright: a campaign
 * built on an unresolved requirement publishes the violation.
 */
export function determineTrustStrategy(input: CampaignInput): CampaignDetermination {
  const dependsOn = ["compliance.readiness", "compliance.agencyVerified"];

  if (input.compliance.readiness === UNKNOWN) {
    return unknownFor(
      "trustStrategy",
      dependsOn,
      "Compliance readiness is UNKNOWN — the corridor is outside the compliance knowledge base. No trust posture can be set until compliance can be assessed, and assuming one would present an unchecked corridor as a cleared one.",
    );
  }

  const posture =
    input.compliance.readiness === "BLOCKED"
      ? TRUST_STRATEGY.BLOCKED
      : input.compliance.agencyVerified
        ? TRUST_STRATEGY.VERIFIED
        : TRUST_STRATEGY.UNVERIFIED;

  return {
    attribute: "trustStrategy",
    value: posture.value,
    confidencePct: 100,
    source: dependsOn.join(", "),
    reason: `Compliance readiness is "${input.compliance.readiness}" and the agency's verification is ${input.compliance.agencyVerified ? "current" : "not current"}. ${posture.rationale}`,
    dependsOn,
  };
}

/**
 * Whether the campaign leads with the employer or with the agency.
 *
 * Determined from whether an employer is actually named. This is not a
 * judgement about how well-known the employer is — the platform holds no
 * such data, and inventing a prominence ranking would be exactly the
 * guess this engine must not make.
 */
export function determineEmployerBrandingPriority(input: CampaignInput): CampaignDetermination {
  const named = Boolean(input.jobOrder.employerName?.trim());
  return {
    attribute: "employerBrandingPriority",
    value: named ? "Employer-forward" : "Agency-forward",
    confidencePct: 100,
    source: "job order record",
    reason: named
      ? `The requirement names its employer ("${input.jobOrder.employerName}"), which is the strongest credibility signal available, so the campaign can lead with it.`
      : "No employer is named on the requirement, so the campaign must lead with the agency's own credentials. Nothing is asserted about the employer's prominence — the platform holds no such data.",
    dependsOn: ["employer"],
  };
}

export function determineUrgencyStrategy(input: CampaignInput): CampaignDetermination {
  return derive("recruitmentUrgencyStrategy", input, ["urgency", "plantStatus"], (values) => {
    const strategy = PLANT_STATUS_STRATEGY[values.plantStatus];
    if (!strategy) return null;

    // A stated urgency escalates the schedule-driven baseline; it never
    // manufactures one where the work itself has no deadline.
    const escalated = values.urgency === "Immediate" || values.urgency === "High";
    return {
      value: escalated ? `${strategy.urgencyStrategy}, stated as ${values.urgency.toLowerCase()} priority` : strategy.urgencyStrategy,
      reason: escalated
        ? `Plant status is "${values.plantStatus}" and the requirement states ${values.urgency.toLowerCase()} urgency. ${strategy.rationale} The stated urgency sharpens that schedule; it does not invent one.`
        : `Plant status is "${values.plantStatus}" and no elevated urgency was stated. ${strategy.rationale}`,
    };
  });
}

export function determineCtaStrategy(input: CampaignInput): CampaignDetermination {
  return derive("ctaStrategy", input, ["hiringPattern"], (values) => {
    const strategy = HIRING_PATTERN_STRATEGY[values.hiringPattern];
    if (!strategy) return null;

    const caveats: string[] = [];
    if (!input.jobOrder.interviewDateStated) {
      caveats.push("no interview date is on the requirement, so the call cannot state one");
    }
    if (!input.jobOrder.contactStated) {
      caveats.push("no contact is on the requirement, so the agency's own contact must be used");
    }

    return {
      value: strategy.ctaStrategy,
      reason: `Hiring pattern is "${values.hiringPattern}". ${strategy.rationale}${caveats.length > 0 ? ` Note: ${caveats.join("; ")}.` : ""}`,
    };
  });
}

/**
 * Language strategy.
 *
 * UNKNOWN when no language was stated. JobOrder Intelligence
 * deliberately refuses to infer a language from the destination, and
 * this engine will not undo that refusal by picking one — the campaign
 * language is a recruiter decision, not an inference.
 */
export function determineLanguageStrategy(input: CampaignInput): CampaignDetermination {
  return derive("languageStrategy", input, ["languagesRequired"], (values) => ({
    value: `Communicate in ${values.languagesRequired}`,
    reason: `The requirement states a language requirement of ${values.languagesRequired}, so the campaign is written to match it.`,
  }));
}

export function determineAudienceType(input: CampaignInput): CampaignDetermination {
  return derive("audienceType", input, ["tradeCategories"], (values) => {
    const present = values.tradeCategories.split(",").map((category) => category.trim());
    // Most specialised audience present wins: a requirement mixing
    // helpers and instrument technicians must speak to the technicians,
    // because they are the ones who will not otherwise recognise it.
    const matched = AUDIENCE_STRATEGY.find((strategy) =>
      strategy.categories.some((category) => present.includes(category)),
    );
    if (!matched) return null;
    return {
      value: matched.audience,
      reason: `Trade categories are ${present.join(", ")}. ${matched.rationale} The most specialised audience present governs, because they are the readers least likely to recognise a generically-written campaign as theirs.`,
    };
  });
}

export function determineCommunicationTone(input: CampaignInput): CampaignDetermination {
  return derive("communicationTone", input, ["tradeCategories"], (values) => {
    const present = values.tradeCategories.split(",").map((category) => category.trim());
    const matched = AUDIENCE_STRATEGY.find((strategy) =>
      strategy.categories.some((category) => present.includes(category)),
    );
    if (!matched) return null;
    return {
      value: matched.tone,
      reason: `Audience is ${matched.audience}. ${matched.rationale}`,
    };
  });
}

export function determineInformationPriority(input: CampaignInput): CampaignDetermination {
  const audience = determineAudienceType(input);
  if (audience.value === UNKNOWN) {
    return unknownFor(
      "informationPriority",
      ["audienceType"],
      "Information priority follows from the audience, and the audience is UNKNOWN.",
    );
  }

  const priority = INFORMATION_PRIORITY[audience.value as string];
  if (!priority) {
    return unknownFor(
      "informationPriority",
      ["audienceType"],
      `No information priority is defined for audience "${audience.value}".`,
    );
  }

  return {
    attribute: "informationPriority",
    value: priority.join(" > "),
    confidencePct: audience.confidencePct,
    source: "audienceType",
    reason: `Audience is ${audience.value}, which reads in this order: ${priority.join(", then ")}. This is the order the facts should be communicated in — it says what matters most to this reader, not where anything is placed.`,
    dependsOn: ["audienceType"],
  };
}

/**
 * Campaign density — how much information the campaign has to carry.
 *
 * NOT a layout decision. It states the communication load; how that load
 * is arranged on a page is decided by Layout Intelligence, which runs
 * later. The existing density classifier is reused rather than
 * reimplemented so the two stages measure the same thing.
 */
export function determineCampaignDensity(input: CampaignInput): CampaignDetermination {
  if (input.jobOrder.positions.length === 0) {
    return unknownFor(
      "campaignDensity",
      ["positions"],
      "The requirement has no positions, so there is no communication load to assess.",
    );
  }

  const density = classifyDensity(
    input.jobOrder.positions.map((position) => ({
      title: position.title,
      ...(position.count === null ? {} : { count: position.count }),
    })),
  );

  const statedHeadcount = input.jobOrder.positions.reduce(
    (sum, position) => sum + (position.count ?? 0),
    0,
  );

  return {
    attribute: "campaignDensity",
    value: density,
    confidencePct: 100,
    source: "job order record",
    reason: `${input.jobOrder.positions.length} position line${input.jobOrder.positions.length === 1 ? "" : "s"} and ${statedHeadcount} stated position${statedHeadcount === 1 ? "" : "s"} give a ${density} communication load. This states how much information the campaign must carry; how it is arranged is decided later.`,
    dependsOn: ["positions"],
  };
}

/**
 * Hero image intent — what the picture should be OF.
 *
 * Subject matter only. No composition, no palette, no placement: those
 * are Layout Intelligence's and the Rendering Engine's decisions, and
 * stating them here would cross the line this engine must not cross.
 */
export function determineHeroImageIntent(input: CampaignInput): CampaignDetermination {
  return derive("heroImageIntent", input, ["industry", "plantStatus", "tradeCategories"], (values) => {
    const strategy = PLANT_STATUS_STRATEGY[values.plantStatus];
    if (!strategy) return null;

    const disciplines = values.tradeCategories
      .split(",")
      .map((category) => category.trim())
      .slice(0, 3);

    return {
      value: `${values.industry} — ${strategy.imageContext}, with ${disciplines.join(" and ")} workers at task`,
      reason: `Industry is ${values.industry}, plant status is ${values.plantStatus}, and the disciplines present are ${disciplines.join(", ")}. The image should show the work the candidate would actually be doing, so that a qualified reader recognises the job before reading a word.`,
    };
  });
}

export function determineVisualFocus(input: CampaignInput): CampaignDetermination {
  return derive("visualFocus", input, ["hiringPattern"], (values) => {
    const strategy = HIRING_PATTERN_STRATEGY[values.hiringPattern];
    if (!strategy) return null;
    return {
      value: strategy.visualFocus,
      reason: `Hiring pattern is "${values.hiringPattern}". ${strategy.rationale} The subject of the image should match the shape of the hire.`,
    };
  });
}

export function determineImageContext(input: CampaignInput): CampaignDetermination {
  return derive("suggestedImageContext", input, ["plantStatus"], (values) => {
    const strategy = PLANT_STATUS_STRATEGY[values.plantStatus];
    if (!strategy) return null;

    const plantType = upstream(input, "plantType");
    const setting = plantType ? `${plantType.value.toLowerCase()} — ${strategy.imageContext}` : strategy.imageContext;

    return {
      value: setting,
      reason: `Plant status is "${values.plantStatus}"${plantType ? ` at a ${plantType.value.toLowerCase()}` : ""}. This describes the setting the image should depict; nothing about how it is composed.`,
    };
  });
}

// ---------------------------------------------------------------------------
// The full assessment
// ---------------------------------------------------------------------------

export interface CampaignAssessment {
  determinations: CampaignDetermination[];
  /** Mean confidence across determinations that resolved to a value. */
  overallConfidencePct: number;
  unknownAttributes: string[];
}

/**
 * Runs every campaign determination.
 *
 * Order is fixed and the output is a plain list, so the same inputs
 * always produce the same campaign in the same order.
 */
export function assessCampaign(input: CampaignInput): CampaignAssessment {
  const determinations: CampaignDetermination[] = [
    determineObjective(input),
    determinePrimaryMessage(input),
    determineSecondaryMessage(input),
    determineCandidateMotivation(input),
    determineTrustStrategy(input),
    determineEmployerBrandingPriority(input),
    determineUrgencyStrategy(input),
    determineCtaStrategy(input),
    determineLanguageStrategy(input),
    determineAudienceType(input),
    determineCommunicationTone(input),
    determineInformationPriority(input),
    determineCampaignDensity(input),
    determineHeroImageIntent(input),
    determineVisualFocus(input),
    determineImageContext(input),
  ];

  const resolved = determinations.filter((determination) => determination.value !== UNKNOWN);

  return {
    determinations,
    overallConfidencePct:
      resolved.length === 0
        ? 0
        : Math.round(resolved.reduce((sum, d) => sum + d.confidencePct, 0) / resolved.length),
    unknownAttributes: determinations
      .filter((determination) => determination.value === UNKNOWN)
      .map((determination) => determination.attribute),
  };
}
