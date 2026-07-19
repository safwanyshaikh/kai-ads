/**
 * Creative Director Brain — orchestrator (Sprint 006, Phase A).
 *
 * Runs the deterministic engines in dependency order and assembles ONE
 * immutable `CreativeDirection`. Pure: identical input → identical output.
 * No LLM, no randomness, no I/O. Emits decisions only — never pixels, never
 * facts. This object is the sole input to the GPT Background Brief Generator,
 * layout selection, typography, renderer, and Visual QA.
 *
 * NOT wired into the production pipeline in Phase A. Flag-gated at the call
 * site (see env `CREATIVE_DIRECTOR_BRAIN`, default OFF).
 */

import type { CreativeDirection, CreativeInput, Trace } from "./types";
import { countryIntelligence, currencyIntelligence, employerIntelligence, industryIntelligence } from "./engines/market";
import { benefitsIntelligence, projectIntelligence, salaryIntelligence, urgencyIntelligence } from "./engines/offer";
import { candidatePsychology, opportunityRanking } from "./engines/psychology";
import { backgroundStrategy, colourStrategy, heroStrategy, visualStory } from "./engines/visual";
import { ctaStrategy, layoutStrategy, mobileStrategy, trustStrategy, typographyStrategy } from "./engines/structure";
import { commercialScoring, truthValidation } from "./engines/quality";

export function runCreativeDirector(input: CreativeInput): CreativeDirection {
  const trace: Trace[] = [];
  const push = <T>(o: { value: T; trace: Trace }): T => { trace.push(o.trace); return o.value; };

  // ── market ──
  const country = push(countryIntelligence(input));
  const currency = push(currencyIntelligence(input));
  const employer = push(employerIntelligence(input));
  const industry = push(industryIntelligence(input));

  // ── offer ──
  const salary = push(salaryIntelligence(input));
  const benefits = push(benefitsIntelligence(input));
  const project = push(projectIntelligence(input));
  const urgency = push(urgencyIntelligence(input));

  // ── psychology ── Decision Flow Stage 1 (lock the hero) runs before
  // Stage 2/3 (derive hook/emotion FROM that hero) — see psychology.ts.
  const opportunity = push(opportunityRanking({ country, salary, industry, project, employer, urgency }));
  const psychology = push(candidatePsychology({ input, country, industry, project, employer, urgency, opportunity }));

  // ── visual ──
  const vs = push(visualStory({ input, project, urgency }));
  const hero = push(heroStrategy(vs.story, vs.personality));
  const background = push(backgroundStrategy(industry));
  const colour = push(colourStrategy({ country, input }));

  // ── structure ──
  const typography = push(typographyStrategy());
  const layout = push(layoutStrategy(input));
  const cta = push(ctaStrategy({ urgency, input }));
  const trust = push(trustStrategy({ input, employer, country }));
  const mobile = push(mobileStrategy(input));

  // ── quality (last) ── truthValidation is the Brain's own catastrophic-
  // defect gate (Playbook §22) and must run BEFORE commercialScoring so
  // a truth failure can force the score's gate to REJECT outright.
  const truth = push(truthValidation({ input, currency, opportunity, employer, salary }));
  const commercialScore = push(commercialScoring({
    currency, salary, urgency, opportunity, employer, truth,
    positionsCount: input.positions.length, hasAgencyPalette: Boolean(input.agencyPalette),
  }));

  const direction: CreativeDirection = {
    country, currency, employer, industry, salary, benefits, project, urgency,
    psychology, opportunity, visualStory: vs, hero, background, typography, layout,
    colour, cta, trust, mobile, commercialScore, truth,
    traceability: Object.freeze(trace.slice()),
  };
  return Object.freeze(direction);
}
