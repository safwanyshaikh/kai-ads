/**
 * GPT Background Brief Generator (deterministic).
 *
 * Given the Creative Brain's VISUAL decisions, emit exactly one
 * production-ready GPT image prompt. Pure function: identical input always
 * yields identical output. No LLM call, no randomness, no I/O.
 *
 * The background exists only to create emotion. Every factual word —
 * positions, phone, email, interviews, benefits, employer branding, QR,
 * CTA — is placed later by the frozen overlay engine and is deliberately
 * unreachable from here (see types.ts).
 */

import type {
  AgencyPalette,
  ColourMood,
  CompositionProfile,
  ContentDensity,
  CreativeBrainVisualDecisions,
  EmotionalTone,
  GptBackgroundBrief,
  LightingKey,
  VisualStory,
} from "./types";

/** Subject description keyed by scene archetype. */
const HERO_BY_STORY: Record<VisualStory, string> = {
  WORKER_HERO:
    "a single industrial worker seen from behind and slightly to the side, standing on an elevated platform in clean high-visibility workwear and a hard hat, shoulders relaxed and confident, his gaze directed out across the landscape so the eye is led with him into the scene",
  TEAM: "a small group of industrial workers in clean high-visibility workwear and hard hats, seen from behind or in low silhouette, moving together through the site",
  REFINERY:
    "a lone worker as a small human figure for scale against the structures, seen from behind, in clean high-visibility workwear and a hard hat",
  OFFSHORE_PLATFORM:
    "an offshore worker seen from behind in clean high-visibility gear and hard hat, dwarfed by the platform structures",
  CONSTRUCTION:
    "a construction worker seen from behind in clean high-visibility workwear and hard hat, surveying the rising structure",
  MECHANICAL_CLOSEUP:
    "no human subject in focus — the machinery itself is the hero, with at most a gloved hand or a distant blurred figure for scale",
  SHIPYARD:
    "a shipyard worker seen from behind in clean high-visibility gear and hard hat, small against the hull",
};

/** Environment description keyed by scene archetype (used when the story is itself an environment). */
const ENVIRONMENT_BY_STORY: Partial<Record<VisualStory, string>> = {
  REFINERY:
    "a vast oil & gas refinery — distillation towers, stacks, pipe racks and structural steel receding into atmospheric haze, small warm safety lights glowing across the structures",
  OFFSHORE_PLATFORM:
    "a large offshore oil & gas platform surrounded by open sea — cranes, a flare stack, modular decks and walkways",
  CONSTRUCTION:
    "a large-scale construction site — tower cranes, rising concrete cores, structural steel and scaffolding stretching into the distance",
  SHIPYARD:
    "a massive shipyard — a dry dock, towering hull sections and gantry cranes",
  MECHANICAL_CLOSEUP:
    "heavy industrial machinery in tactile close detail — turbines, valves, brushed metal and precision engineering",
};

/** Environment fallback derived from the industry mood string. */
function environmentFromIndustry(industry: string): string {
  const i = industry.toLowerCase();
  // "refin(?!ed)" avoids matching the unrelated word "refined" (e.g. "a
  // refined, premium hospitality interior"), which is not an oil/gas signal.
  if (/(oil|gas|petro|refin(?!ed))/.test(i)) return ENVIRONMENT_BY_STORY.REFINERY!;
  if (/(offshore|marine|subsea)/.test(i)) return ENVIRONMENT_BY_STORY.OFFSHORE_PLATFORM!;
  if (/(construct|infrastructure|civil|building)/.test(i)) return ENVIRONMENT_BY_STORY.CONSTRUCTION!;
  if (/(ship|dock|vessel)/.test(i)) return ENVIRONMENT_BY_STORY.SHIPYARD!;
  return "a large, professional industrial facility with strong structural presence and atmospheric depth";
}

interface ColourMoodSpec {
  grading: string;
  defaultLighting: LightingKey;
}

const COLOUR_MOOD: Record<ColourMood, ColourMoodSpec> = {
  DESERT_GOLD: {
    grading:
      "committed desert gold and warm bronze — amber sky, honeyed light, deep warm shadows; rich, premium and filmic; strictly no cool green or blue cast anywhere in the frame",
    defaultLighting: "GOLDEN_HOUR",
  },
  WARM_INDUSTRIAL: {
    grading:
      "warm industrial tones — burnt amber, steel and ember highlights against deep shadow; heavy, premium and cinematic",
    defaultLighting: "GOLDEN_HOUR",
  },
  PREMIUM_CORPORATE: {
    grading:
      "clean premium corporate grade — controlled neutral tones with a single restrained warm accent; polished, confident and understated",
    defaultLighting: "OVERCAST",
  },
  HIGH_URGENCY: {
    grading:
      "high-contrast dramatic grade — deep blacks, hot directional highlights and a charged, urgent atmosphere",
    defaultLighting: "HARSH_MIDDAY",
  },
  TECHNICAL_BLUE: {
    grading:
      "cool technical blue-steel grade — precise, engineered and controlled, with clean metallic reflections",
    defaultLighting: "BLUE_HOUR",
  },
  OFFSHORE_STEEL: {
    grading:
      "cold offshore steel grade — grey-blue sea, brushed metal and diffused marine light",
    defaultLighting: "OVERCAST",
  },
};

const LIGHTING: Record<LightingKey, string> = {
  GOLDEN_HOUR:
    "low golden-hour sun, warm rim light catching the subject, long soft shadows and backlit atmospheric haze",
  SUNRISE: "soft dawn light, a cool-to-warm gradient sky and gentle drifting mist",
  OVERCAST: "soft diffused overcast light — even, professional and muted, with gentle shadows",
  BLUE_HOUR: "cool blue-hour twilight, a deep sky and glowing industrial lights across the structures",
  HARSH_MIDDAY: "hard high sun with strong directional shadows and intense specular highlights",
  NIGHT_INDUSTRIAL:
    "a night scene lit by industrial floodlights and safety lamps — deep shadow with glowing warm accents",
};

/**
 * Concise noun-phrases so the ranked tones fuse into ONE natural mood
 * sentence (lead → underpinned by → undercurrent), rather than a list.
 */
const EMOTION_NOUN: Record<EmotionalTone, string> = {
  MONEY: "the promise of well-paid, rewarding work",
  CAREER: "a career-defining opportunity",
  PRESTIGE: "prestige and world-class scale",
  URGENCY: "charged, decisive urgency",
  STABILITY: "solid, dependable permanence",
  MEGA_PROJECT: "monumental, awe-inspiring scale",
};

/** Fuse the ranked emotional tones into one flowing mood clause. */
function composeMood(tones: EmotionalTone[]): string {
  const [lead, second, third, ...rest] = tones;
  let mood = `The mood leads with ${EMOTION_NOUN[lead]}`;
  if (second) mood += `, underpinned by ${EMOTION_NOUN[second]}`;
  if (third) mood += `, with an undercurrent of ${EMOTION_NOUN[third]}`;
  for (const extra of rest) mood += `, and a trace of ${EMOTION_NOUN[extra]}`;
  return mood;
}

/**
 * Regional atmosphere derived from the destination mood string. Adds vivid,
 * grounded environmental character (never a fabricated fact). Empty when the
 * destination implies no distinctive climate cue.
 */
function regionalAtmosphere(destination: string): string {
  const d = destination.toLowerCase();
  if (/(saudi|uae|emirat|qatar|kuwait|oman|bahrain|gulf|dubai|abu dhabi|dammam|riyadh|jubail|middle east)/.test(d)) {
    return " A Gulf desert atmosphere pervades the frame — dry heat haze, fine dust in the air, and an immense, open landscape.";
  }
  if (/(singapore|malaysia|indonesia|philippines|vietnam|thailand)/.test(d)) {
    return " A humid tropical-industrial atmosphere — soft haze, dense air and lush distant light.";
  }
  return "";
}

interface CompositionSpec {
  top: string;
  left: string;
  right: string;
  bottom: string;
}

const COMPOSITION: Record<CompositionProfile, CompositionSpec> = {
  HERO_RIGHT_DATA_LEFT: {
    top: "TOP SAFE ZONE — keep the upper-left visually quiet (open sky or atmospheric haze) so a large headline overlay will read clearly",
    left: "LEFT SAFE ZONE — keep the left ~60% relatively uncluttered through the mid-frame (haze, tonal ground, or softly-lit distant structures) to host a column of overlaid text",
    right:
      "RIGHT HERO ZONE — concentrate the hero subject and the strongest detail in the right third as the dominant focal point, gaze or motion leading inward across the frame",
    bottom:
      "BOTTOM FOOTER ZONE — let the lower band fall into deep, clean shadow so an overlaid contact/trust footer will sit on it",
  },
  HERO_LEFT_DATA_RIGHT: {
    top: "TOP SAFE ZONE — keep the upper-right visually quiet (open sky or haze) for a large headline overlay",
    left: "LEFT HERO ZONE — concentrate the hero subject and strongest detail in the left third as the dominant focal point, gaze or motion leading inward",
    right:
      "RIGHT SAFE ZONE — keep the right ~60% relatively uncluttered through the mid-frame to host a column of overlaid text",
    bottom:
      "BOTTOM FOOTER ZONE — let the lower band fall into deep, clean shadow for an overlaid contact/trust footer",
  },
  HERO_CENTER: {
    top: "TOP SAFE ZONE — an open, quiet upper band for a centred headline overlay",
    left: "keep the left margin calm and free of competing detail",
    right: "keep the right margin calm and free of competing detail",
    bottom:
      "BOTTOM FOOTER ZONE — a darker, clean lower band for an overlaid contact/trust footer; the hero sits centred between the two safe bands",
  },
  SYMMETRIC_BANDS: {
    top: "TOP BAND — a strong but text-safe upper band for a headline overlay",
    left: "keep both side margins clean",
    right: "keep both side margins clean",
    bottom:
      "BOTTOM BAND — a darker professional footer-weight band; the middle band carries the ambient hero imagery with room for overlaid content",
  },
};

/** Density-adaptive composition guidance (mirrors the Constitution's density engine). */
const DENSITY_GUIDANCE: Record<ContentDensity, string> = {
  SPARSE:
    "Sparse content — fill the canvas with dramatic, bold imagery and depth; leave generous, intentional calm areas in the safe zones for overlaid text.",
  MEDIUM:
    "Medium content — balance compelling imagery with clear, calm compositional zones so overlaid text reads easily.",
  HIGH:
    "Dense content — keep the mid and lower zones cleaner and calmer to host wide bands of overlaid text; concentrate the drama in the hero zone.",
};

/** Agency Visual DNA clause — biases the grade toward the agency palette, never renders colour as shapes/text. */
function agencyIdentityClause(palette: AgencyPalette): string {
  return (
    ` AGENCY VISUAL IDENTITY — subtly bias the overall grade toward the agency's approved palette ` +
    `(primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}) so the image reads as part of the agency's family, ` +
    `WITHOUT overriding the cinematic mood above and WITHOUT rendering these colours as blocks, swatches, bars, or graphic shapes.`
  );
}

/** Fixed negative prompt — Truth Brain + image hygiene. Never varies. */
const NEGATIVE_PROMPT =
  "NO text, NO letters, NO numbers, NO logos, NO signage, NO nameplates, NO QR codes, NO labels, NO UI, NO watermark, NO company branding, NO readable markings, NO placeholder or pseudo-text, NO fabricated information, NO close-up identifiable human faces, NO unsafe or absurd depictions. The canvas must be purely visual: imagery, colour, light, composition and atmosphere. All factual text is added later by the composition engine.";

function formatWord(aspectRatio: number): string {
  if (aspectRatio >= 1.2) return "landscape";
  if (aspectRatio <= 0.85) return "portrait";
  return "square";
}

/**
 * Generate a production-ready GPT image prompt from Creative Brain visual
 * decisions. Deterministic and side-effect-free.
 */
export function generateGptBackgroundBrief(
  decisions: CreativeBrainVisualDecisions,
): GptBackgroundBrief {
  if (!decisions.emotionalDirection.length) {
    throw new Error("generateGptBackgroundBrief: emotionalDirection must have at least one tone.");
  }

  const aspectRatio = decisions.aspectRatio ?? 1;
  const mood = COLOUR_MOOD[decisions.colourMood];
  const resolvedLighting = decisions.lighting ?? mood.defaultLighting;

  const heroDesc = HERO_BY_STORY[decisions.visualStory];
  const environmentDesc =
    ENVIRONMENT_BY_STORY[decisions.visualStory] ?? environmentFromIndustry(decisions.industry);

  // Fuse the ranked emotions into one flowing mood clause (primary-weighted).
  const moodClause = composeMood(decisions.emotionalDirection);
  const atmosphere = regionalAtmosphere(decisions.destination);

  const comp = COMPOSITION[decisions.compositionPriority];

  // ---- Sections ----
  const scene =
    `SCENE — Cinematic, photorealistic ${formatWord(aspectRatio)} photograph for a premium overseas-recruitment poster. ` +
    `A single, dignified moment set in ${decisions.industry} in ${decisions.destination}, in the context of ${decisions.projectType}. ` +
    `${moodClause}. Editorial, filmic, one-second scroll-stopping impact.`;

  const hero = `HERO — ${heroDesc}. The human presence is aspirational, never posed for the camera; it invites the viewer to picture themselves in the role.`;

  const environment = `ENVIRONMENT — ${environmentDesc}.${atmosphere} Convey real scale, depth and atmosphere so the place itself communicates the opportunity.`;

  const lighting = `LIGHTING — ${LIGHTING[resolvedLighting]}. Shot on a full-frame camera, roughly a 50mm lens, sharp on the focal subject and softening into the haze, high dynamic range, fine natural grain.`;

  const colourGrading =
    `COLOUR GRADING — ${mood.grading}.` +
    (decisions.agencyPalette ? agencyIdentityClause(decisions.agencyPalette) : "");

  const densityLine = decisions.contentDensityClass
    ? `\n${DENSITY_GUIDANCE[decisions.contentDensityClass]}`
    : "";
  const composition =
    `COMPOSITION — Design these zones into the photograph itself (do NOT add them as overlays):\n` +
    `- ${comp.top}\n- ${comp.left}\n- ${comp.right}\n- ${comp.bottom}\n` +
    `Give the greatest visual weight to the hero subject and the sense of place; do not let any single background structure overpower the human focal point.` +
    densityLine;

  const negativePrompt = `NEGATIVE PROMPT — ${NEGATIVE_PROMPT}`;

  const prompt = [scene, hero, environment, lighting, colourGrading, composition, negativePrompt].join(
    "\n\n",
  );

  return {
    prompt,
    sections: { scene, hero, environment, lighting, colourGrading, composition, negativePrompt },
    traceability: {
      primaryHook: decisions.primaryHook,
      visualWeight: decisions.visualWeight,
      visualFocalPath: decisions.attentionPath,
      emotionalDirection: decisions.emotionalDirection,
      colourMood: decisions.colourMood,
      visualStory: decisions.visualStory,
      compositionProfile: decisions.compositionPriority,
      resolvedLighting,
      contentDensityClass: decisions.contentDensityClass ?? null,
      agencyPaletteApplied: Boolean(decisions.agencyPalette),
    },
  };
}
