import type { AdvertisementFacts } from "./types";

/**
 * Advertisement Intelligence — the Creative Brain's copy-emphasis layer.
 *
 * Truth Brain decides WHAT is factual; this module decides what deserves
 * EMPHASIS. It never invents a fact: every output string is assembled
 * exclusively from grounded fact values plus a fixed, enumerable set of
 * presentation glue words ("Client interviews in", "&", "·") — the same
 * class of non-factual framing as "WE ARE HIRING". A test enforces that
 * no other words can appear.
 */
export interface AdCopyPlan {
  /** The display headline — the header stripped of listing boilerplate ("Hiring for", "Urgently required for", ...) so the substance leads. */
  primaryHeadline: string;
  /**
   * The poster hook, stacked for dominance: up to two uppercase-ready
   * lines a scrolling candidate reads in the first second — line 1 the
   * grounded project/role core, line 2 the country ("IN SAUDI ARABIA").
   * Benchmark grammar: real market ads stack these in huge two-color type.
   */
  hookLines: string[];
  /** Angled-ribbon interview hook ("CLIENT INTERVIEWS IN BARODA & MUMBAI" + dates line), or null without interview events. All values grounded. */
  interviewRibbon: { line1: string; line2: string | null } | null;
  /** Full-width benefit banner text (grounded compensation benefits joined with "+"), or null. */
  benefitBanner: string | null;
  /** One grounded supporting line for archetypes with a secondary slot, or null when nothing earns it. */
  secondaryHeadline: string | null;
  /** Which grounded angle leads the advertisement. */
  strongestSellingPoint:
    | "EMPLOYER_PROJECT"
    | "COMPENSATION"
    | "MULTI_CITY_INTERVIEWS"
    | "VACANCY_VOLUME"
    | "EXPERIENCE_PROFILE"
    | "NONE";
  emphasis: {
    country: boolean;
    employer: boolean;
    interview: boolean;
    benefit: boolean;
  };
}

const HEADER_BOILERPLATE = /^(urgently\s+)?(hiring|required|wanted|vacancy|vacancies|recruitment|openings?)\s*(for|:)?\s*/i;

/**
 * The header's factual core — boilerplate prefix and trailing country
 * removed. Shared with the source-fidelity gate so "what must appear in
 * the composition" and "what the copy plan may display" are the same
 * deterministic definition.
 */
export function coreHeaderText(header: string, country: string): string {
  const stripped = header.replace(HEADER_BOILERPLATE, "").trim();
  const base = stripped.length >= 8 ? stripped : header.trim();
  return stripTrailingCountry(base, country);
}

/** Strips trailing country from the headline when the country gets its own emphasis slot (every archetype renders country separately). */
function stripTrailingCountry(header: string, country: string): string {
  const trimmed = header.trim().replace(/[,\s]+$/, "");
  const lower = trimmed.toLowerCase();
  const countryLower = country.trim().toLowerCase();
  if (countryLower && lower.endsWith(countryLower)) {
    const cut = trimmed.slice(0, trimmed.length - country.trim().length).replace(/[,\s—–-]+$/, "");
    if (cut.length >= 8) return cut;
  }
  return trimmed;
}

export function buildAdCopyPlan(facts: AdvertisementFacts, opts?: { hasCompensationSignal?: boolean }): AdCopyPlan {
  // Primary headline: grounded header, minus listing boilerplate. If
  // stripping would gut it, the original header stands.
  const primaryHeadline = coreHeaderText(facts.header, facts.country);

  const interviewCities = [
    ...new Set(facts.interview.map((e) => e.location).filter((l): l is string => Boolean(l))),
  ];
  const hasCompensation = Boolean(opts?.hasCompensationSignal);
  const totalHeadcount = facts.positions.reduce((s, p) => s + (p.count ?? 0), 0);

  // Selling-point precedence, reference-market order: a named employer/
  // project outranks pay, pay outranks logistics, logistics outranks the
  // requirement profile. Only source-supported angles are candidates.
  const strongestSellingPoint: AdCopyPlan["strongestSellingPoint"] = facts.employer
    ? "EMPLOYER_PROJECT"
    : hasCompensation
      ? "COMPENSATION"
      : interviewCities.length >= 2
        ? "MULTI_CITY_INTERVIEWS"
        : totalHeadcount >= 20
          ? "VACANCY_VOLUME"
          : facts.footer
            ? "EXPERIENCE_PROFILE"
            : "NONE";

  // Secondary headline: the strongest angle NOT already carried by the
  // primary headline. Multi-city interviews are the classic overseas-
  // recruitment hook ("Client interviews in Baroda & Mumbai").
  let secondaryHeadline: string | null = null;
  if (interviewCities.length >= 2) {
    secondaryHeadline = `Client interviews in ${interviewCities.slice(0, -1).join(", ")} & ${interviewCities[interviewCities.length - 1]}`;
  } else if (hasCompensation) {
    const comp = facts.benefits.map((b) => b.label).find(Boolean);
    secondaryHeadline = comp ?? null;
  }

  // Poster hook stack: the headline core dominates line 1; the country
  // gets its own line ("IN <COUNTRY>" — "in" is presentation glue, the
  // country is grounded). If the core still ends with the country (rare),
  // it stays a single line.
  const hookLines: string[] = [primaryHeadline.toUpperCase()];
  if (facts.country && !primaryHeadline.toLowerCase().includes(facts.country.toLowerCase())) {
    hookLines.push(`IN ${facts.country.toUpperCase()}`);
  }

  // Angled interview ribbon — the market's classic urgency hook, grounded
  // in the actual cities and dates.
  const uniqueDates = [...new Set(facts.interview.map((e) => e.date).filter((d): d is string => Boolean(d)))];
  const interviewRibbon =
    interviewCities.length > 0
      ? {
          line1: `CLIENT INTERVIEW${interviewCities.length > 1 ? "S" : ""} IN ${interviewCities
            .map((c) => c.toUpperCase())
            .join(" & ")}`,
          line2: uniqueDates.length > 0 ? `ON ${uniqueDates.map((d) => d.toUpperCase()).join(" · ")}` : null,
        }
      : null;

  // Full-width benefit banner: grounded compensation benefits joined with
  // "+" (glue), uppercase — mirrors the market's yellow-on-green banner.
  const benefitBanner =
    hasCompensation && facts.benefits.length > 0
      ? facts.benefits
          .map((b) => b.label.toUpperCase())
          .join(" + ")
      : null;

  return {
    primaryHeadline,
    hookLines,
    interviewRibbon,
    benefitBanner,
    secondaryHeadline,
    strongestSellingPoint,
    emphasis: {
      country: Boolean(facts.country),
      employer: Boolean(facts.employer),
      interview: facts.interview.length > 0,
      benefit: facts.benefits.length > 0,
    },
  };
}
