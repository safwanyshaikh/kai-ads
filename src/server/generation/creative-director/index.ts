/**
 * Creative Director Brain — public surface (Sprint 006, Phase A).
 *
 * The deterministic intelligence layer: a collection of single-responsibility,
 * independently-testable, traceable engines under one orchestrator, producing
 * one immutable `CreativeDirection`. NOT wired into production; flag-gated
 * (`CREATIVE_DIRECTOR_BRAIN`, default OFF).
 */

export { runCreativeDirector } from "./creative-director";
export {
  buildCreativeDirectorBrief,
  creativeDirectionToVisualDecisions,
  factsToCreativeInput,
} from "./pipeline-adapter";
export * from "./types";

// Engines exported individually so each is independently importable + testable.
export {
  countryIntelligence, currencyIntelligence, employerIntelligence, industryIntelligence,
} from "./engines/market";
export {
  salaryIntelligence, benefitsIntelligence, projectIntelligence, urgencyIntelligence,
} from "./engines/offer";
export { candidatePsychology, opportunityRanking } from "./engines/psychology";
export { visualStory, heroStrategy, backgroundStrategy, colourStrategy } from "./engines/visual";
export {
  typographyStrategy, layoutStrategy, ctaStrategy, trustStrategy, mobileStrategy,
} from "./engines/structure";
export { commercialScoring, truthValidation } from "./engines/quality";
