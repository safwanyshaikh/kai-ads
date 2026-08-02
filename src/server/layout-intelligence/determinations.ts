import {
  AUDIENCE_LAYOUT_STRATEGY,
  CTA_PRIORITY_BY_HIRING_PATTERN,
  CTA_TEXT_TO_PATTERN,
  TRUST_PRESENTATION_BY_POSTURE,
  TRUST_TEXT_TO_POSTURE,
  WHITESPACE_BY_DENSITY,
  layoutFamilyFor,
  publicationTypesFor,
} from "./strategy-map";
import { UNKNOWN, type Unknown } from "@/server/job-order-intelligence/determinations";
import type { UpstreamDetermination } from "@/server/campaign-intelligence/determinations";

/**
 * Layout Intelligence — the determinations.
 *
 *   ... -> Campaign Intelligence -> **Layout Intelligence** -> Rendering Engine -> ...
 *
 * Decides HOW the campaign should be presented. It does not render,
 * generate images, edit, or publish anything — it produces a Publication
 * Strategy that the Rendering Engine consumes later.
 *
 * INPUT IS CAMPAIGN INTELLIGENCE ONLY
 *
 * This engine reads exclusively what Task 005 determined. It never
 * re-reads a JobOrder, a requirement source, or raw text — if a fact
 * matters to presentation, Campaign Intelligence already turned it into
 * a communication decision, and this engine works from that decision.
 *
 * UNKNOWN PROPAGATES, IDENTICALLY TO TASK 005
 *
 *   1. If a dependency is UNKNOWN, the presentation decision is UNKNOWN.
 *   2. Confidence is capped by the least confident dependency.
 *
 * NEVER A COORDINATE, A PIXEL, A CANVAS SIZE, OR A TEMPLATE
 *
 * Every value produced here is a strategic descriptor: "Bold,
 * high-legibility, industrial", never "48px Liberation Sans Bold".
 * Composition, palette values, positions and canvas dimensions belong to
 * the Rendering Engine, which runs after this stage and after Layout
 * Intelligence's own strategy has been read by it.
 */

export interface LayoutDetermination {
  attribute: string;
  value: string | Unknown;
  /** 0–100. Zero whenever the value is UNKNOWN. */
  confidencePct: number;
  source: string;
  reason: string;
  dependsOn: string[];
}

export interface LayoutInput {
  /** Campaign Intelligence determinations, keyed by attribute — the ONLY input this engine reads. */
  campaign: Record<string, UpstreamDetermination | undefined>;
}

const upstream = (input: LayoutInput, attribute: string): UpstreamDetermination | null => {
  const determination = input.campaign[attribute];
  if (!determination || determination.value === UNKNOWN) return null;
  return determination;
};

function unknownFor(attribute: string, dependsOn: string[], reason: string): LayoutDetermination {
  return { attribute, value: UNKNOWN, confidencePct: 0, source: dependsOn.join(", ") || "none", reason, dependsOn };
}

/**
 * Derives one determination from named Campaign Intelligence attributes.
 * Identical shape to Task 005's `derive` helper, applied one stage later.
 */
function derive(
  attribute: string,
  input: LayoutInput,
  dependsOn: string[],
  compute: (values: Record<string, string>) => { value: string; reason: string } | null,
): LayoutDetermination {
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
      `Cannot be determined because ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} UNKNOWN in Campaign Intelligence. Reported as UNKNOWN rather than assumed — a presentation decision built on an unknown communication strategy is a guess.`,
    );
  }

  const computed = compute(resolved);
  if (!computed) {
    return unknownFor(
      attribute,
      dependsOn,
      `No presentation strategy is defined for ${dependsOn.map((dependency) => `${dependency} = "${resolved[dependency]}"`).join(", ")}. Reported as UNKNOWN rather than approximated.`,
    );
  }

  return {
    attribute,
    value: computed.value,
    confidencePct: cap,
    source: dependsOn.join(", "),
    reason: `${computed.reason} Confidence capped at ${cap}% by the least certain Campaign Intelligence input (${dependsOn.map((dependency) => `${dependency} ${input.campaign[dependency]?.confidencePct}%`).join(", ")}).`,
    dependsOn,
  };
}

// ---------------------------------------------------------------------------
// Determinations
// ---------------------------------------------------------------------------

export function determinePublicationType(input: LayoutInput): LayoutDetermination {
  return derive("publicationType", input, ["audienceType", "campaignDensity"], (values) => {
    const types = publicationTypesFor(values.audienceType, values.campaignDensity);
    if (!types) return null;
    return {
      value: types.sort().join(", "),
      reason: `Audience is ${values.audienceType} at ${values.campaignDensity} campaign density.`,
    };
  });
}

export function determineLayoutFamily(input: LayoutInput): LayoutDetermination {
  return derive("layoutFamily", input, ["audienceType", "campaignDensity"], (values) => {
    const result = layoutFamilyFor(values.audienceType, values.campaignDensity);
    if (!result) return null;
    return { value: result.family, reason: result.rationale };
  });
}

/** Pass-through of Campaign Intelligence's own density, restated for layout purposes. */
export function determineInformationDensity(input: LayoutInput): LayoutDetermination {
  return derive("informationDensity", input, ["campaignDensity"], (values) => ({
    value: values.campaignDensity,
    reason: `Carried directly from Campaign Intelligence's communication load assessment (${values.campaignDensity}). This states how much information the layout must accommodate; it decides no dimension or arrangement.`,
  }));
}

/**
 * Reading direction.
 *
 * RTL only when the requirement's language strategy names Arabic and
 * does not name English. A corridor that requires both is treated as
 * LTR: mixed Arabic/English recruitment material in this market is
 * conventionally set left-to-right with Arabic passages embedded, and
 * asserting otherwise would be a guess this engine has no basis for.
 */
export function determineReadingDirection(input: LayoutInput): LayoutDetermination {
  return derive("readingDirection", input, ["languageStrategy"], (values) => {
    const mentionsArabic = /arabic/i.test(values.languageStrategy);
    const mentionsEnglish = /english/i.test(values.languageStrategy);

    if (mentionsArabic && !mentionsEnglish) {
      return {
        value: "Right-to-left",
        reason: `Language strategy is "${values.languageStrategy}" — Arabic only, so the layout reads right-to-left.`,
      };
    }
    return {
      value: "Left-to-right",
      reason: `Language strategy is "${values.languageStrategy}". English is present or no Arabic-only requirement was stated, so the layout reads left-to-right by this market's convention.`,
    };
  });
}

/** Pass-through of Campaign Intelligence's information ordering, restated as what should visually dominate. */
export function determineVisualHierarchy(input: LayoutInput): LayoutDetermination {
  return derive("visualHierarchy", input, ["informationPriority"], (values) => ({
    value: values.informationPriority,
    reason: `Carried directly from Campaign Intelligence's information priority. This states what must visually dominate, in order; it assigns no position or size.`,
  }));
}

export function determineHeroImageImportance(input: LayoutInput): LayoutDetermination {
  return derive("heroImageImportance", input, ["audienceType", "heroImageIntent"], (values) => {
    const strategy = AUDIENCE_LAYOUT_STRATEGY[values.audienceType];
    if (!strategy) return null;
    return {
      value: strategy.heroImportance,
      reason: `Audience is ${values.audienceType}, and Campaign Intelligence already established what the image should depict ("${values.heroImageIntent}"). ${strategy.rationale}`,
    };
  });
}

export function determineTextImageRatio(input: LayoutInput): LayoutDetermination {
  return derive("textImageRatio", input, ["audienceType"], (values) => {
    const strategy = AUDIENCE_LAYOUT_STRATEGY[values.audienceType];
    if (!strategy) return null;
    return { value: strategy.textImageRatio, reason: `Audience is ${values.audienceType}. ${strategy.rationale}` };
  });
}

export function determineQrImportance(input: LayoutInput): LayoutDetermination {
  return derive("qrImportance", input, ["trustStrategy"], (values) => {
    const posture = TRUST_TEXT_TO_POSTURE.get(values.trustStrategy);
    const strategy = posture ? TRUST_PRESENTATION_BY_POSTURE[posture] : undefined;
    if (!strategy) return null;
    return {
      value: strategy.qrImportance,
      reason: `Campaign trust strategy is "${values.trustStrategy}". ${strategy.rationale}`,
    };
  });
}

export function determineLogoImportance(input: LayoutInput): LayoutDetermination {
  return derive("logoImportance", input, ["employerBrandingPriority"], (values) => {
    if (values.employerBrandingPriority === "Employer-forward") {
      return {
        value: "Secondary — the employer's identity leads, the agency logo confirms who placed the campaign",
        reason: `Campaign branding priority is Employer-forward, so the agency logo supports rather than leads.`,
      };
    }
    if (values.employerBrandingPriority === "Agency-forward") {
      return {
        value: "Primary — no employer is named, so the agency's own identity carries the campaign's credibility",
        reason: `Campaign branding priority is Agency-forward: no employer is named on the requirement, so the agency logo is the strongest identity signal available.`,
      };
    }
    return null;
  });
}

export function determineTrustElementPriority(input: LayoutInput): LayoutDetermination {
  return derive("trustElementPriority", input, ["trustStrategy"], (values) => {
    const posture = TRUST_TEXT_TO_POSTURE.get(values.trustStrategy);
    const strategy = posture ? TRUST_PRESENTATION_BY_POSTURE[posture] : undefined;
    if (!strategy) return null;
    return {
      value: strategy.trustElementPriority,
      reason: `Campaign trust strategy is "${values.trustStrategy}". ${strategy.rationale}`,
    };
  });
}

export function determineCtaPriority(input: LayoutInput): LayoutDetermination {
  return derive("ctaPriority", input, ["ctaStrategy"], (values) => {
    const pattern = CTA_TEXT_TO_PATTERN.get(values.ctaStrategy);
    const strategy = pattern ? CTA_PRIORITY_BY_HIRING_PATTERN[pattern] : undefined;
    if (!strategy) return null;
    return {
      value: strategy.priority,
      reason: `Campaign CTA strategy is "${values.ctaStrategy}". ${strategy.rationale}`,
    };
  });
}

export function determineTypographyStrategy(input: LayoutInput): LayoutDetermination {
  return derive("typographyStrategy", input, ["audienceType", "communicationTone"], (values) => {
    const strategy = AUDIENCE_LAYOUT_STRATEGY[values.audienceType];
    if (!strategy) return null;
    return {
      value: strategy.typographyStrategy,
      reason: `Audience is ${values.audienceType}, communication tone is "${values.communicationTone}". This is a strategic register only — no font, size or weight is specified here; that is the Rendering Engine's decision.`,
    };
  });
}

/** Restates Campaign Intelligence's language decision for layout purposes — which languages the presentation must carry. */
export function determineLanguageStrategy(input: LayoutInput): LayoutDetermination {
  return derive("languageStrategy", input, ["languageStrategy"], (values) => ({
    value: values.languageStrategy,
    reason: `Carried directly from Campaign Intelligence's language strategy. This states which language(s) the layout must present; wording and translation are decided when content is produced.`,
  }));
}

export function determineMultiLanguageRequirement(input: LayoutInput): LayoutDetermination {
  return derive("multiLanguageRequirement", input, ["languageStrategy"], (values) => {
    const match = values.languageStrategy.match(/^Communicate in (.+)$/i);
    const languages = (match ? match[1] : values.languageStrategy).split(",").map((language) => language.trim()).filter(Boolean);

    if (languages.length >= 2) {
      return {
        value: `Yes — ${languages.length} languages (${languages.join(", ")}) must be visually accommodated`,
        reason: `Campaign language strategy names ${languages.length} languages. Multiple languages on one layout need visual separation, so this is flagged rather than left implicit.`,
      };
    }
    return {
      value: "No — single language",
      reason: `Campaign language strategy names one language (${languages.join(", ") || values.languageStrategy}), so no multi-language accommodation is needed.`,
    };
  });
}

export function determineColourMood(input: LayoutInput): LayoutDetermination {
  return derive("colourMood", input, ["audienceType", "communicationTone"], (values) => {
    const strategy = AUDIENCE_LAYOUT_STRATEGY[values.audienceType];
    if (!strategy) return null;
    return {
      value: strategy.colourMood,
      reason: `Audience is ${values.audienceType}, tone is "${values.communicationTone}". This is a mood only — no colour value, palette or hex code is specified here.`,
    };
  });
}

export function determineWhitespaceStrategy(input: LayoutInput): LayoutDetermination {
  return derive("whitespaceStrategy", input, ["campaignDensity"], (values) => {
    const strategy = WHITESPACE_BY_DENSITY[values.campaignDensity];
    if (!strategy) return null;
    return { value: strategy.strategy, reason: `Campaign density is ${values.campaignDensity}. ${strategy.rationale}` };
  });
}

/**
 * Mobile-first vs print-first.
 *
 * Derived from this engine's OWN layout-family determination rather than
 * from Campaign Intelligence directly: the family already resolved the
 * audience/density combination into one presentation shape, and print
 * orientation follows from that shape, not from either input alone.
 */
export function determineMobileOrPrintFirst(input: LayoutInput): LayoutDetermination {
  const family = determineLayoutFamily(input);
  if (family.value === UNKNOWN) {
    return unknownFor(
      "mobileOrPrintFirst",
      ["layoutFamily"],
      "This follows from the layout family, and the layout family is UNKNOWN.",
    );
  }

  const printFirst = family.value === "Newspaper Classified";
  return {
    attribute: "mobileOrPrintFirst",
    value: printFirst ? "Print-first" : "Mobile-first",
    confidencePct: family.confidencePct,
    source: "layoutFamily",
    reason: printFirst
      ? `Layout family is "${family.value}", which is a print-native format read on paper first.`
      : `Layout family is "${family.value}", which is distributed and read predominantly on a phone.`,
    dependsOn: ["layoutFamily"],
  };
}

// ---------------------------------------------------------------------------
// The full assessment
// ---------------------------------------------------------------------------

export interface LayoutAssessment {
  determinations: LayoutDetermination[];
  overallConfidencePct: number;
  unknownAttributes: string[];
}

/**
 * Runs every layout determination.
 *
 * Order is fixed and the output is a plain list, so the same Campaign
 * Intelligence inputs always produce the same Publication Strategy in
 * the same order.
 */
export function assessLayout(input: LayoutInput): LayoutAssessment {
  const determinations: LayoutDetermination[] = [
    determinePublicationType(input),
    determineLayoutFamily(input),
    determineInformationDensity(input),
    determineReadingDirection(input),
    determineVisualHierarchy(input),
    determineHeroImageImportance(input),
    determineTextImageRatio(input),
    determineQrImportance(input),
    determineLogoImportance(input),
    determineTrustElementPriority(input),
    determineCtaPriority(input),
    determineTypographyStrategy(input),
    determineLanguageStrategy(input),
    determineMultiLanguageRequirement(input),
    determineColourMood(input),
    determineWhitespaceStrategy(input),
    determineMobileOrPrintFirst(input),
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
