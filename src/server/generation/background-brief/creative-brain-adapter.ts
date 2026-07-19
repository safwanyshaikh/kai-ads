/**
 * Creative Brain → GPT Background Brief adapter.
 *
 * Bridges the production side (grounded facts + the Constitution's copy and
 * composition directives + Agency Visual DNA) into the generator's
 * CreativeBrainVisualDecisions. This is the "Creative Brain decides
 * direction" step, expressed deterministically until a standalone Creative
 * Brain component exists.
 *
 * Responsibility split (approved):
 *   • Creative Brain (this adapter) — decides the creative DIRECTION.
 *   • Agency Visual DNA — applies the agency's identity (palette only).
 *   • Overlay Engine (frozen) — guarantees truth and precision.
 *
 * Truth boundary — the adapter READS grounded facts but emits ONLY
 * non-factual creative signals. It never places positions, phone, email,
 * interview details, salary, employer name, agency name, QR, RA or CTA into
 * the decisions: `industry`, `destination` and `projectType` are thematic
 * mood strings, and `projectType` is derived from industry (never from
 * roles or the header) so no factual overlay content can leak downstream.
 */

import type { AdCopyPlan } from "../archetypes/advertisement-intelligence";
import type { CompositionDirectives } from "../archetypes/composition-constitution";
import type { AgencyVisualDna } from "../archetypes/visual-dna";
import type { AdvertisementFacts } from "../archetypes/types";
import type {
  ColourMood,
  CreativeBrainVisualDecisions,
  EmotionalTone,
  VisualStory,
} from "./types";

/** True when the destination is a Gulf / desert market (drives gold mood). */
function isGulfDestination(country: string): boolean {
  return /(saudi|uae|emirat|qatar|kuwait|oman|bahrain|gulf|dubai|abu dhabi|dammam|riyadh|jubail)/i.test(
    country,
  );
}

/** Deterministic creative direction from the grounded industry + destination. */
function deriveColourMood(industry: string, country: string): ColourMood {
  const i = industry.toLowerCase();
  if (/(offshore|marine|subsea)/.test(i)) return "OFFSHORE_STEEL";
  if (isGulfDestination(country)) return "DESERT_GOLD";
  if (/(oil|gas|petro|refin)/.test(i)) return "WARM_INDUSTRIAL";
  if (/(construct|infrastructure|civil|building)/.test(i)) return "WARM_INDUSTRIAL";
  return "WARM_INDUSTRIAL";
}

function deriveVisualStory(industry: string): VisualStory {
  const i = industry.toLowerCase();
  if (/(offshore|marine|subsea)/.test(i)) return "OFFSHORE_PLATFORM";
  if (/(construct|infrastructure|civil|building)/.test(i)) return "CONSTRUCTION";
  if (/(ship|dock|vessel)/.test(i)) return "SHIPYARD";
  return "WORKER_HERO";
}

/** A THEMATIC project descriptor — industry only, never roles or header text. */
function deriveProjectType(industry: string): string {
  const i = industry.toLowerCase();
  if (/(oil|gas|petro|refin)/.test(i)) return "a major oil & gas project";
  if (/(offshore|marine|subsea)/.test(i)) return "an offshore energy project";
  if (/(construct|infrastructure|civil|building)/.test(i)) return "a large construction project";
  if (/(ship|dock|vessel)/.test(i)) return "a major shipyard project";
  return `a major ${industry} project`;
}

/**
 * Ranked emotional direction from grounded emphasis. The strongest grounded
 * selling point leads; prestige is added for premium Gulf sectors;
 * date-bound interviews add controlled urgency.
 */
function deriveEmotionalDirection(
  facts: AdvertisementFacts,
  copy: AdCopyPlan,
): EmotionalTone[] {
  const tones: EmotionalTone[] = [];
  const moneyLed =
    copy.strongestSellingPoint === "COMPENSATION" || facts.benefits.length > 0;

  if (moneyLed) tones.push("MONEY");
  else tones.push("CAREER");

  if (isGulfDestination(facts.country) || /(oil|gas|petro)/i.test(facts.industry)) {
    tones.push("PRESTIGE");
  }
  if (facts.interview.length > 0) tones.push("URGENCY");

  // Guarantee at least one, and de-duplicate while preserving order.
  return [...new Set(tones.length ? tones : (["CAREER"] as EmotionalTone[]))];
}

export interface CreativeBrainAdapterInput {
  facts: AdvertisementFacts;
  copy: AdCopyPlan;
  directives: CompositionDirectives;
  dna?: AgencyVisualDna | null;
  aspectRatio?: number;
}

/**
 * Produce the generator's visual decisions from production artifacts, with
 * FULL PARITY: content density and Agency Visual DNA palette are carried
 * through so nothing is lost between the Creative Brain and the prompt.
 */
export function toCreativeBrainDecisions(
  input: CreativeBrainAdapterInput,
): CreativeBrainVisualDecisions {
  const { facts, copy, directives, dna, aspectRatio } = input;

  const colourMood = deriveColourMood(facts.industry, facts.country);
  const visualStory = deriveVisualStory(facts.industry);

  return {
    // Intent only (never rendered) — thematic, no roles/positions.
    primaryHook: `${facts.country} · ${facts.industry}`,
    emotionalDirection: deriveEmotionalDirection(facts, copy),
    colourMood,
    visualStory,
    visualWeight: "The opportunity and the hero worker — not the employer brand",
    attentionPath: [
      "Hero subject as the dominant focal point",
      "Industrial environment receding into atmospheric haze",
      "Open sky / distant light",
    ],
    industry: facts.industry,
    destination: facts.country,
    projectType: deriveProjectType(facts.industry),
    compositionPriority: "HERO_RIGHT_DATA_LEFT",
    // FULL PARITY — density guidance carried through.
    contentDensityClass: directives.contentDensityClass,
    // FULL PARITY — Agency Visual DNA palette (colours only, no name).
    agencyPalette: dna
      ? { primary: dna.primaryColor, secondary: dna.secondaryColor, accent: dna.accentColor }
      : undefined,
    aspectRatio: aspectRatio ?? 1,
  };
}
