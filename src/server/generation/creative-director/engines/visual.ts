/**
 * Visual engines — deterministic, single-responsibility, traceable.
 *   • visualStory        — one scene + personality (never mix stories)
 *   • heroStrategy       — hero subject + placement
 *   • backgroundStrategy — GPT vs deterministic + scene seed
 *   • colourStrategy     — mood from country premium colour + industry, DNA-adjusted
 */

import type {
  BackgroundStrategyDecision, ColourStrategyDecision, CountryDecision, CreativeInput,
  EngineOutput, HeroStrategyDecision, IndustryDecision, Personality, ProjectDecision,
  UrgencyDecision, VisualStory, VisualStoryDecision,
} from "../types";
import { resolveIndustry } from "../knowledge";

export interface VisualStoryInput {
  input: CreativeInput; project: ProjectDecision; urgency: UrgencyDecision;
}

export function visualStory(a: VisualStoryInput): EngineOutput<VisualStoryDecision> {
  const i = resolveIndustry(a.input.industry);
  const story = i.defaultStory as VisualStory;
  let personality: Personality = "CORPORATE";
  const h = (a.input.header ?? "").toLowerCase();
  if (/shutdown|turnaround/.test(h)) personality = "SHUTDOWN";
  else if (a.urgency.level === "HIGH") personality = "WALK_IN_DRIVE";
  else if (/oil|gas|petro/i.test(a.input.industry) && a.project.attractiveness >= 90) personality = "MEGA_PROJECT";
  else if (/hotel|palace|hospitality/i.test(a.input.industry)) personality = "LUXURY_HOSPITALITY";
  else if (/hospital|health|medical/i.test(a.input.industry)) personality = "HEALTHCARE";
  else if (a.input.positions.length >= 10) personality = "MASS_HIRING";
  return {
    value: { story, personality },
    trace: { engine: "visualStory", decision: `${story} / ${personality}`, reason: `One visual story (${story}) from industry; personality ${personality} from project/urgency/volume.` },
  };
}

export function heroStrategy(story: VisualStory): EngineOutput<HeroStrategyDecision> {
  const subject =
    story === "REFINERY" || story === "WORKER_HERO" ? "a single industrial worker (from behind) surveying the site"
    : story === "OFFSHORE_PLATFORM" ? "an offshore worker against the platform"
    : story === "CONSTRUCTION" ? "a construction worker surveying the rising structure"
    : story === "HOTEL" ? "refined hospitality staff in a premium interior"
    : story === "HOSPITAL" ? "a medical professional in a clean modern ward"
    : story === "SHIPYARD" ? "a shipyard worker against the hull"
    : "the workplace environment as the hero";
  return {
    value: { subject, placement: "RIGHT" },
    trace: { engine: "heroStrategy", decision: subject, reason: `Aspirational hero for ${story}; placed RIGHT so the data column reads on the left.` },
  };
}

export function backgroundStrategy(industry: IndustryDecision): EngineOutput<BackgroundStrategyDecision> {
  return {
    value: { source: "GPT", sceneSeed: industry.environment },
    trace: { engine: "backgroundStrategy", decision: "GPT", reason: `Cinematic GPT background from the industry environment seed; deterministic gradient is the fallback (renderer concern).` },
  };
}

export interface ColourInput { country: CountryDecision; input: CreativeInput; }

export function colourStrategy(a: ColourInput): EngineOutput<ColourStrategyDecision> {
  // Base mood from the country's premium colour; agency DNA adjusts within.
  const mood = a.country.premiumColour;
  const dark = /gold|desert/i.test(mood) ? "#0C2E63" : /burgundy/i.test(mood) ? "#6E1023" : /deep blue/i.test(mood) ? "#0C2E63" : /forest/i.test(mood) ? "#123D28" : "#1c1c1e";
  const gold = "#C8971F";
  const agencyPaletteApplied = Boolean(a.input.agencyPalette);
  return {
    value: { mood, dark, gold, agencyPaletteApplied },
    trace: { engine: "colourStrategy", decision: mood, reason: `Mood from ${a.country.country}'s premium colour (${mood}); Agency DNA ${agencyPaletteApplied ? "adjusts within the approved palette" : "not supplied"} — colourMood never replaces DNA.` },
  };
}
