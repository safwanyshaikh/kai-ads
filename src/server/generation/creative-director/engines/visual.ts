/**
 * Visual engines — deterministic, single-responsibility, traceable.
 *   • visualStory        — one scene + personality (never mix stories)
 *   • heroStrategy       — hero subject + placement, matched to personality
 *   • backgroundStrategy — GPT vs deterministic + scene seed
 *   • colourStrategy     — mood from country premium colour + industry, DNA-adjusted
 */

import type {
  BackgroundStrategyDecision, ColourStrategyDecision, CountryDecision, CreativeInput,
  EngineOutput, HeroStrategyDecision, IndustryDecision, Personality, ProjectDecision,
  UrgencyDecision, VisualStory, VisualStoryDecision,
} from "../types";
import { COLOUR_DARK_TONE, COLOUR_DARK_TONE_FALLBACK, resolveIndustry } from "../knowledge";

export interface VisualStoryInput {
  input: CreativeInput; project: ProjectDecision; urgency: UrgencyDecision;
}

/** Playbook §11/§16: "roughly a dozen roles" is the mass-hiring density threshold. */
const MASS_HIRING_POSITION_THRESHOLD = 10;

/**
 * Playbook §19 permanent rule: "Ad personality ... is derived from
 * headcount + urgency + industry signals TOGETHER — never assumed from
 * the archetype alone." Its own worked example: "A 20-role Bus Driver
 * walk-in requirement → urgent mobilization / mass hiring personality" —
 * i.e. large headcount + real urgency together must resolve to
 * URGENT_MOBILIZATION, not plain WALK_IN_DRIVE (which is for a small-
 * scale walk-in, e.g. the Royal Palace Hotel 3-position example).
 * That distinct personality previously existed only in the type union
 * and was never actually reachable.
 */
export function visualStory(a: VisualStoryInput): EngineOutput<VisualStoryDecision> {
  const i = resolveIndustry(a.input.industry);
  const story = i.defaultStory as VisualStory;
  const h = (a.input.header ?? "").toLowerCase();
  const massHeadcount = a.input.positions.length >= MASS_HIRING_POSITION_THRESHOLD;

  let personality: Personality;
  let reason: string;
  if (/shutdown|turnaround/.test(h)) {
    personality = "SHUTDOWN";
    reason = "shutdown/turnaround signal in the header";
  } else if (/oil|gas|petro/i.test(a.input.industry) && a.project.attractiveness >= 90) {
    personality = "MEGA_PROJECT";
    reason = "high-attractiveness oil & gas project";
  } else if (massHeadcount && a.urgency.level === "HIGH") {
    personality = "URGENT_MOBILIZATION";
    reason = `${a.input.positions.length} positions + HIGH urgency together (Playbook §19 Bus Driver example)`;
  } else if (/hotel|palace|hospitality/i.test(a.input.industry)) {
    personality = "LUXURY_HOSPITALITY";
    reason = "hospitality industry";
  } else if (/hospital|health|medical/i.test(a.input.industry)) {
    personality = "HEALTHCARE";
    reason = "healthcare industry";
  } else if (a.urgency.level === "HIGH") {
    personality = "WALK_IN_DRIVE";
    reason = "HIGH urgency at ordinary headcount";
  } else if (massHeadcount) {
    personality = "MASS_HIRING";
    reason = `${a.input.positions.length} positions, no urgency signal`;
  } else {
    personality = "CORPORATE";
    reason = "no distinguishing personality signal";
  }

  return {
    value: { story, personality },
    trace: { engine: "visualStory", decision: `${story} / ${personality}`, reason: `One visual story (${story}) from industry (Playbook §6/§17); personality ${personality} — ${reason} (Playbook §19: headcount + urgency + industry together).` },
  };
}

/**
 * Playbook §3 permanent rule: "chosen to match the ad's dominant
 * emotional hook and industry reality — never generic, never mixed."
 * Its own contrasting examples: a mega-project/shutdown wants "the lone
 * worker dwarfed by structure"; a mass-hiring/walk-in drive wants "a
 * small group in motion." The previous implementation ignored
 * personality entirely and always returned the same lone-worker subject
 * for every REFINERY/WORKER_HERO story regardless of scale or urgency.
 */
export function heroStrategy(story: VisualStory, personality: Personality): EngineOutput<HeroStrategyDecision> {
  let subject: string;
  if (personality === "MASS_HIRING" || personality === "URGENT_MOBILIZATION" || personality === "WALK_IN_DRIVE") {
    subject = "a small group of workers in motion, moving together through the site";
  } else if (personality === "SHUTDOWN" || personality === "MEGA_PROJECT") {
    subject = "a lone worker dwarfed by the structure, small against the scale of the project";
  } else if (story === "HOTEL") {
    subject = "refined hospitality staff in a premium interior";
  } else if (story === "HOSPITAL") {
    subject = "a medical professional in a clean modern ward";
  } else if (story === "OFFSHORE_PLATFORM") {
    subject = "an offshore worker against the platform";
  } else if (story === "CONSTRUCTION") {
    subject = "a construction worker surveying the rising structure";
  } else if (story === "SHIPYARD") {
    subject = "a shipyard worker against the hull";
  } else if (story === "REFINERY" || story === "WORKER_HERO") {
    subject = "a single industrial worker (from behind) surveying the site";
  } else {
    subject = "the workplace environment as the hero";
  }
  return {
    value: { subject, placement: "RIGHT" },
    trace: { engine: "heroStrategy", decision: subject, reason: `Hero matched to personality ${personality} (Playbook §3: hero must reflect the emotional/scale lead, not the industry stereotype alone), story ${story}; placed RIGHT so the data column reads on the left.` },
  };
}

export function backgroundStrategy(industry: IndustryDecision): EngineOutput<BackgroundStrategyDecision> {
  return {
    value: { source: "GPT", sceneSeed: industry.environment },
    trace: { engine: "backgroundStrategy", decision: "GPT", reason: `Cinematic GPT background from the industry environment seed; deterministic gradient is the fallback (renderer concern).` },
  };
}

export interface ColourInput { country: CountryDecision; input: CreativeInput; }

/**
 * Playbook §8 permanent rule + Failure Library FL-009/FL-010: "one
 * grading commitment per ad ... never two unreconciled colour
 * temperatures in the same frame." The dark tone is now looked up from
 * the locked, internally-consistent COLOUR_DARK_TONE table (knowledge.ts)
 * instead of loose regex guessing, so a warm mood (Desert Gold) can never
 * again resolve to a cool dark tone by accident — the exact mechanism
 * behind the V12 green-cast failure.
 */
export function colourStrategy(a: ColourInput): EngineOutput<ColourStrategyDecision> {
  const mood = a.country.premiumColour;
  const dark = COLOUR_DARK_TONE[mood] ?? COLOUR_DARK_TONE_FALLBACK;
  const gold = "#C8971F";
  const agencyPaletteApplied = Boolean(a.input.agencyPalette);
  return {
    value: { mood, dark, gold, agencyPaletteApplied },
    trace: { engine: "colourStrategy", decision: mood, reason: `Mood from ${a.country.country}'s locked premium colour (${mood}, Playbook §18); dark tone ${dark} chosen to match — no competing warm/cool cast (Playbook §8, FL-009/FL-010). Agency DNA ${agencyPaletteApplied ? "adjusts within the approved palette" : "not supplied"} — colourMood never replaces DNA.` },
  };
}
