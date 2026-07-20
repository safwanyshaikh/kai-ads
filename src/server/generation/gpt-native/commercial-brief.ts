/**
 * Commercial Advertisement Brief (Sprint 007 — GPT-Native Advertisement
 * Architecture).
 *
 * A pure, deterministic shape-adapter — exactly like
 * creative-director/pipeline-adapter.ts's `creativeDirectionToVisualDecisions`
 * — that restructures the EXISTING, UNCHANGED `CreativeDirection` output
 * (produced by `runCreativeDirector()`, the Creative Director Brain) into
 * the 25-field brief the GPT-native master prompt is built from.
 *
 * This module adds NO new intelligence: every value below already exists
 * on `CreativeDirection`. It only renames/regroups fields into the
 * vocabulary a "Senior Recruitment Creative Director" brief uses, per the
 * Sprint 007 mandate. Do not add scoring, ranking, or classification logic
 * here — that belongs in the Brain's engines, not this adapter.
 */

import type { CreativeDirection } from "../creative-director/types";

export interface CommercialGoal {
  hero: string; // the single opportunity lever the ad must sell first
  motivation: string; // the dominant emotional driver
  summary: string;
}

export interface OpportunityPriority {
  ranked: string[]; // levers, most to least important
  hero: string;
  prominence: Record<"employer" | "country" | "industry" | "project", string>;
}

export interface CandidatePsychology {
  dominantHook: string;
  secondaryHook: string | null;
  motivation: string;
}

export interface VisualStoryDirection {
  story: string;
  personality: string;
}

export interface HeroStrategy {
  subject: string;
  placement: string;
}

export interface BackgroundStrategy {
  source: string;
  sceneSeed: string;
}

export interface IndustryStyle {
  environment: string;
  attractiveness: number;
  prominence: string;
}

export interface CountryStyle {
  country: string;
  prestige: string;
  premiumColour: string;
  emotionalTone: string;
  flagKey: string;
}

export interface EmployerBrandWeight {
  brandStrength: string;
  prominence: string;
}

export interface SalaryEmphasis {
  hasSalary: boolean;
  overtimePresent: boolean;
  prominence: string;
  vacancyCount: number;
  vacancyProminence: string;
}

export interface BenefitsEmphasis {
  ranked: string[];
  primary: string | null;
  prominence: string;
}

export interface ProjectEmphasis {
  projectType: string;
  attractiveness: number;
  prominence: string;
}

export interface UrgencyDirection {
  level: string;
  driver: string | null;
}

export interface VisualHierarchy {
  order: string[]; // reading-priority order of content blocks, hero lever first
}

export interface TypographyDirection {
  hero: string;
  secondary: string;
  table: string;
  cta: string;
}

export interface ColourDirection {
  mood: string;
  dark: string;
  gold: string;
  agencyPaletteApplied: boolean;
}

export interface WhitespaceDirection {
  density: "SPARSE" | "MEDIUM" | "HIGH";
  guidance: string;
}

export interface CompositionDirection {
  family: string;
  columns: number;
  heroPlacement: string;
}

export interface CtaDirection {
  priority: string;
  kind: string;
}

export interface TrustPlacement {
  order: string[];
  priority: string;
  /** GPT must leave this zone visually clean — KAI composites the Trust Layer here. Never drawn by GPT itself. */
  reservedZone: "BOTTOM_RIGHT";
}

export interface MobileReadability {
  mustSurvive: string[];
  mayShrink: string[];
}

export interface CommercialAdvertisementBrief {
  commercialGoal: CommercialGoal;
  opportunityPriority: OpportunityPriority;
  candidatePsychology: CandidatePsychology;
  visualStory: VisualStoryDirection;
  heroStrategy: HeroStrategy;
  backgroundStrategy: BackgroundStrategy;
  industryStyle: IndustryStyle;
  countryStyle: CountryStyle;
  employerBrandWeight: EmployerBrandWeight;
  salaryEmphasis: SalaryEmphasis;
  benefitsEmphasis: BenefitsEmphasis;
  projectEmphasis: ProjectEmphasis;
  urgency: UrgencyDirection;
  visualHierarchy: VisualHierarchy;
  readingOrder: string[];
  typographyDirection: TypographyDirection;
  colourDirection: ColourDirection;
  whitespaceDirection: WhitespaceDirection;
  compositionDirection: CompositionDirection;
  ctaDirection: CtaDirection;
  trustPlacement: TrustPlacement;
  mobileReadability: MobileReadability;
  printReadiness: boolean;
  socialReadiness: boolean;
  publicationReadiness: boolean;
  commercialScore: number;
}

function densityFromVacancyCount(vacancyCount: number): "SPARSE" | "MEDIUM" | "HIGH" {
  return vacancyCount <= 2 ? "SPARSE" : vacancyCount <= 12 ? "MEDIUM" : "HIGH";
}

/**
 * CreativeDirection -> CommercialAdvertisementBrief. Pure mapping, no
 * facts, no AI, no randomness — reusing decisions the Brain already made.
 */
export function buildCommercialAdvertisementBrief(
  direction: CreativeDirection,
): CommercialAdvertisementBrief {
  const density = densityFromVacancyCount(direction.salary.vacancyCount);

  // Reading order: the opportunity hero lever leads, then the rest of the
  // ranked levers, then trust last (trust is placed, never led with).
  const readingOrder = [
    direction.opportunity.hero,
    ...direction.opportunity.ranked.filter((lever) => lever !== direction.opportunity.hero && lever !== "TRUST"),
    "TRUST",
  ];

  return {
    commercialGoal: {
      hero: direction.opportunity.hero,
      motivation: direction.psychology.motivation,
      summary: `Sell ${direction.opportunity.hero} first — dominant hook: ${direction.psychology.dominantHook}.`,
    },
    opportunityPriority: {
      ranked: direction.opportunity.ranked,
      hero: direction.opportunity.hero,
      prominence: direction.opportunity.prominence,
    },
    candidatePsychology: {
      dominantHook: direction.psychology.dominantHook,
      secondaryHook: direction.psychology.secondaryHook,
      motivation: direction.psychology.motivation,
    },
    visualStory: {
      story: direction.visualStory.story,
      personality: direction.visualStory.personality,
    },
    heroStrategy: {
      subject: direction.hero.subject,
      placement: direction.hero.placement,
    },
    backgroundStrategy: {
      source: direction.background.source,
      sceneSeed: direction.background.sceneSeed,
    },
    industryStyle: {
      environment: direction.industry.environment,
      attractiveness: direction.industry.attractiveness,
      prominence: direction.industry.prominence,
    },
    countryStyle: {
      country: direction.country.country,
      prestige: direction.country.prestige,
      premiumColour: direction.country.premiumColour,
      emotionalTone: direction.country.emotionalTone,
      flagKey: direction.country.flagKey,
    },
    employerBrandWeight: {
      brandStrength: direction.employer.brandStrength,
      prominence: direction.employer.prominence,
    },
    salaryEmphasis: {
      hasSalary: direction.salary.hasSalary,
      overtimePresent: direction.salary.overtimePresent,
      prominence: direction.salary.prominence,
      vacancyCount: direction.salary.vacancyCount,
      vacancyProminence: direction.salary.vacancyProminence,
    },
    benefitsEmphasis: {
      ranked: direction.benefits.ranked,
      primary: direction.benefits.primary,
      prominence: direction.benefits.prominence,
    },
    projectEmphasis: {
      projectType: direction.project.projectType,
      attractiveness: direction.project.attractiveness,
      prominence: direction.project.prominence,
    },
    urgency: {
      level: direction.urgency.level,
      driver: direction.urgency.driver,
    },
    visualHierarchy: {
      order: readingOrder,
    },
    readingOrder,
    typographyDirection: {
      hero: direction.typography.hero,
      secondary: direction.typography.secondary,
      table: direction.typography.table,
      cta: direction.typography.cta,
    },
    colourDirection: {
      mood: direction.colour.mood,
      dark: direction.colour.dark,
      gold: direction.colour.gold,
      agencyPaletteApplied: direction.colour.agencyPaletteApplied,
    },
    whitespaceDirection: {
      density,
      guidance:
        density === "HIGH"
          ? "High position count — prioritize a dense, legible table-style layout over open whitespace."
          : density === "MEDIUM"
            ? "Balance whitespace with a moderate amount of listed content."
            : "Generous whitespace — few positions, let the hero and headline breathe.",
    },
    compositionDirection: {
      family: direction.layout.family,
      columns: direction.layout.columns,
      heroPlacement: direction.hero.placement,
    },
    ctaDirection: {
      priority: direction.cta.priority,
      kind: direction.cta.kind,
    },
    trustPlacement: {
      order: direction.trust.order,
      priority: direction.trust.priority,
      reservedZone: "BOTTOM_RIGHT",
    },
    mobileReadability: {
      mustSurvive: direction.mobile.mustSurvive,
      mayShrink: direction.mobile.mayShrink,
    },
    printReadiness: direction.commercialScore.gate !== "REJECT",
    socialReadiness: direction.commercialScore.gate !== "REJECT",
    publicationReadiness: direction.commercialScore.gate === "AUTO_APPROVE" && direction.truth.pass,
    commercialScore: direction.commercialScore.overall,
  };
}
