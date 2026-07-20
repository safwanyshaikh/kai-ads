/**
 * Creative Director → existing pipeline adapter (Sprint 006, Phase B).
 *
 * Bridges the immutable `CreativeDirection` into the renderer's EXISTING
 * background-brief format. It:
 *   • runs the Brain on grounded facts,
 *   • maps `CreativeDirection` → the existing generator's input type,
 *   • reuses `generateGptBackgroundBrief()` to produce the SAME brief string
 *     the pipeline already consumes.
 *
 * No renderer logic changes. No AI. No business-logic duplication (the brief
 * text is still produced by the one existing generator). NOT called unless the
 * `CREATIVE_DIRECTOR_BRAIN` flag is ON.
 */

import type { AdvertisementFacts } from "../archetypes/types";
import type { AgencyVisualDna } from "../archetypes/visual-dna";
import {
  generateGptBackgroundBrief,
  type ColourMood,
  type ContentDensity,
  type CreativeBrainVisualDecisions,
  type EmotionalTone as GenEmotionalTone,
  type VisualStory as GenVisualStory,
} from "../background-brief";
import { runCreativeDirector } from "./creative-director";
import type { CreativeDirection, CreativeInput, EmotionalTone, VisualStory } from "./types";

/** AdvertisementFacts → CreativeInput (the Brain's grounded input). Pure mapping. */
export function factsToCreativeInput(
  facts: AdvertisementFacts,
  opts?: { channel?: CreativeInput["channel"]; aspectRatio?: number; agencyPalette?: CreativeInput["agencyPalette"] },
): CreativeInput {
  return {
    employer: facts.employer ?? null,
    industry: facts.industry,
    country: facts.country,
    header: facts.header ?? null,
    positions: facts.positions.map((p) => ({ title: p.title, count: p.count, salary: p.salary })),
    benefits: facts.benefits.map((b) => ({ label: b.label, detail: b.detail })),
    interview: facts.interview.map((i) => ({ date: i.date, location: i.location })),
    agencyName: facts.agencyName,
    raLicenseId: facts.raLicenseId ?? null,
    agencyPalette: opts?.agencyPalette ?? null,
    channel: opts?.channel ?? "DTP_NEWSPAPER",
    aspectRatio: opts?.aspectRatio,
  };
}

const EMOTION_MAP: Record<EmotionalTone, GenEmotionalTone> = {
  MONEY: "MONEY", HIGH_INCOME: "MONEY",
  OPPORTUNITY: "CAREER", MODERN_CAREER: "CAREER", CAREER: "CAREER",
  PRESTIGE: "PRESTIGE", PREMIUM: "PRESTIGE",
  URGENCY: "URGENCY", STABLE: "STABILITY", MEGA_PROJECT: "MEGA_PROJECT",
};

const STORY_MAP: Record<VisualStory, GenVisualStory> = {
  WORKER_HERO: "WORKER_HERO", TEAM: "TEAM", REFINERY: "REFINERY",
  OFFSHORE_PLATFORM: "OFFSHORE_PLATFORM", CONSTRUCTION: "CONSTRUCTION",
  SHIPYARD: "SHIPYARD", MECHANICAL_CLOSEUP: "MECHANICAL_CLOSEUP",
  // generator has no dedicated scene for these → nearest human-hero mapping
  ROYAL_PALACE: "TEAM", HOSPITAL: "TEAM", HOTEL: "TEAM", AIRPORT: "TEAM",
  METRO: "CONSTRUCTION", FACTORY: "WORKER_HERO",
};

function colourMoodFrom(direction: CreativeDirection): ColourMood {
  const m = direction.colour.mood.toLowerCase();
  if (direction.visualStory.story === "OFFSHORE_PLATFORM") return "OFFSHORE_STEEL";
  if (/desert|gold/.test(m) && /oil|gas|petro/i.test(direction.industry.environment)) return "DESERT_GOLD";
  if (/desert|gold/.test(m)) return "DESERT_GOLD";
  if (/deep blue|technical/.test(m)) return "TECHNICAL_BLUE";
  if (/burgundy|premium|blue \+ gold|red \+ white/.test(m)) return "PREMIUM_CORPORATE";
  return "WARM_INDUSTRIAL";
}

function densityFrom(direction: CreativeDirection): ContentDensity {
  const n = direction.salary.vacancyCount;
  return n <= 2 ? "SPARSE" : n <= 12 ? "MEDIUM" : "HIGH";
}

/** CreativeDirection → the existing generator's visual-decisions input. */
export function creativeDirectionToVisualDecisions(
  direction: CreativeDirection,
  ctx?: { agencyPalette?: CreativeBrainVisualDecisions["agencyPalette"]; aspectRatio?: number },
): CreativeBrainVisualDecisions {
  return {
    primaryHook: direction.psychology.dominantHook,
    emotionalDirection: [
      EMOTION_MAP[direction.psychology.motivation],
      ...direction.opportunity.ranked.includes("INTERVIEW") && direction.urgency.level !== "NONE" ? (["URGENCY"] as GenEmotionalTone[]) : [],
    ].filter((v, i, arr) => arr.indexOf(v) === i),
    colourMood: colourMoodFrom(direction),
    visualStory: STORY_MAP[direction.visualStory.story],
    visualWeight: `Opportunity hero: ${direction.opportunity.hero} — not the employer brand`,
    attentionPath: [
      direction.hero.subject,
      direction.industry.environment,
      "Open sky / distant light",
    ],
    industry: direction.industry.environment.includes("oil") ? "Oil & Gas" : direction.industry.environment,
    destination: direction.country.country,
    projectType: direction.project.projectType,
    compositionPriority: direction.hero.placement === "LEFT" ? "HERO_LEFT_DATA_RIGHT" : "HERO_RIGHT_DATA_LEFT",
    contentDensityClass: densityFrom(direction),
    agencyPalette: ctx?.agencyPalette,
    aspectRatio: ctx?.aspectRatio,
  };
}

/**
 * Pipeline entry (flag-gated): grounded facts → Brain → adapter → EXISTING
 * generator → the same background-brief string. Returns the brief plus the
 * `CreativeDirection` (for evidence/traceability).
 */
export function buildCreativeDirectorBrief(
  facts: AdvertisementFacts,
  ctx?: { dna?: AgencyVisualDna | null; aspectRatio?: number; channel?: CreativeInput["channel"] },
): { prompt: string; direction: CreativeDirection } {
  const agencyPalette = ctx?.dna
    ? { primary: ctx.dna.primaryColor, secondary: ctx.dna.secondaryColor, accent: ctx.dna.accentColor }
    : undefined;
  const input = factsToCreativeInput(facts, { channel: ctx?.channel, aspectRatio: ctx?.aspectRatio, agencyPalette });
  const direction = runCreativeDirector(input);
  const decisions = creativeDirectionToVisualDecisions(direction, { agencyPalette, aspectRatio: ctx?.aspectRatio });
  return { prompt: generateGptBackgroundBrief(decisions).prompt, direction };
}
