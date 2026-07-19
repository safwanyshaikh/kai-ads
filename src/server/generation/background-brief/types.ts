/**
 * GPT Background Brief Generator — types.
 *
 * Pipeline position:
 *   Source → Truth Brain → Creative Brain → **GPT Background Brief Generator**
 *          → GPT Image → Frozen Overlay → Final Ad
 *
 * This component is deterministic. Its ONLY input is the Creative Brain's
 * VISUAL decisions. It produces the text prompt for the KAI Creative Engine
 * (gpt-image-1) and nothing else.
 *
 * HARD BOUNDARY — the background exists only to create emotion. This
 * generator MUST NEVER receive or know any FACTUAL OVERLAY CONTENT, which
 * belongs exclusively to the frozen overlay engine:
 *   phone · email · interview dates/cities · positions · salary ·
 *   employer name · agency name · QR · CTA · RA license.
 * The input schema below intentionally has no field capable of carrying
 * them, so the boundary is enforced by construction, not convention.
 *
 * FULL PARITY (approved architectural decision) — the generator DOES
 * receive two non-factual signals so no information is lost between the
 * Creative Brain and the prompt:
 *   • Agency Visual DNA as a COLOUR PALETTE only (hex identity, never the
 *     agency's name or any renderable text) — it biases the cinematic mood
 *     within the agency's approved colours (the product moat), it does not
 *     replace `colourMood`.
 *   • Content density class — adapts the composition guidance.
 * Colours and a density enum are identity/layout signals, not factual
 * copy: they can never be rendered as words, and the negative prompt bans
 * all text regardless.
 */

/** Ranked emotional pull the imagery must evoke (mood only, never printed). */
export type EmotionalTone =
  | "MONEY"
  | "CAREER"
  | "PRESTIGE"
  | "URGENCY"
  | "STABILITY"
  | "MEGA_PROJECT";

/** Committed colour story for grading + default lighting. */
export type ColourMood =
  | "DESERT_GOLD"
  | "WARM_INDUSTRIAL"
  | "PREMIUM_CORPORATE"
  | "HIGH_URGENCY"
  | "TECHNICAL_BLUE"
  | "OFFSHORE_STEEL";

/** The scene archetype the imagery is built around. */
export type VisualStory =
  | "WORKER_HERO"
  | "TEAM"
  | "REFINERY"
  | "OFFSHORE_PLATFORM"
  | "CONSTRUCTION"
  | "MECHANICAL_CLOSEUP"
  | "SHIPYARD";

/** Time-of-day / light treatment. Optional — derived from colour mood if absent. */
export type LightingKey =
  | "GOLDEN_HOUR"
  | "SUNRISE"
  | "OVERCAST"
  | "BLUE_HOUR"
  | "HARSH_MIDDAY"
  | "NIGHT_INDUSTRIAL";

/**
 * Where the hero sits and where the overlay-safe quiet zones must fall.
 * These describe VISUAL zones only (open sky, shadow, quiet ground) — the
 * generator never learns what factual copy the overlay later places there.
 */
export type CompositionProfile =
  | "HERO_RIGHT_DATA_LEFT"
  | "HERO_LEFT_DATA_RIGHT"
  | "HERO_CENTER"
  | "SYMMETRIC_BANDS";

/** Content volume that must fit — mirrors the Constitution's density engine. */
export type ContentDensity = "SPARSE" | "MEDIUM" | "HIGH";

/**
 * The agency's approved colour identity (Agency Visual DNA), palette only.
 * Deliberately carries NO agency name and nothing renderable as text — it
 * biases the grade so every ad stays recognizably the agency's.
 */
export interface AgencyPalette {
  primary: string;
  secondary: string;
  accent: string;
}

/**
 * The Creative Brain's VISUAL decisions — the sole input to the generator.
 *
 * `industry`, `destination` and `projectType` are thematic mood strings
 * (used to colour the scene, never rendered as text). `primaryHook`,
 * `visualWeight` and `attentionPath` are intent signals: they shape
 * emphasis and are echoed back in traceability, but are NOT injected into
 * the image prompt as caption-like text.
 */
export interface CreativeBrainVisualDecisions {
  /** Intent only. The emotional lead of the ad. Never rendered as text. */
  primaryHook: string;
  /** Ranked, most-important first. At least one tone required. */
  emotionalDirection: EmotionalTone[];
  colourMood: ColourMood;
  visualStory: VisualStory;
  /** Free description of the single dominant element. Intent only. */
  visualWeight: string;
  /**
   * The VISUAL focal path only (where the eye travels through the imagery),
   * e.g. ["Hero worker (right)", "Refinery towers into haze", "Warm sky"].
   * The data/overlay attention path (positions, CTA, QR) does NOT belong here.
   */
  attentionPath: string[];
  /** Thematic mood only. e.g. "Oil & Gas". */
  industry: string;
  /** Thematic mood only. e.g. "Saudi Arabia". */
  destination: string;
  /** Thematic mood only. e.g. "Shutdown / maintenance turnaround". */
  projectType: string;
  compositionPriority: CompositionProfile;
  /**
   * Content density (FULL PARITY) — adapts the composition guidance so the
   * imagery leaves the right amount of calm space for the overlay.
   */
  contentDensityClass?: ContentDensity;
  /**
   * Agency Visual DNA palette (FULL PARITY) — biases the grade toward the
   * agency's approved colours. Identity only; never rendered as text.
   */
  agencyPalette?: AgencyPalette;
  /** Optional explicit lighting; falls back to the colour mood's default. */
  lighting?: LightingKey;
  /** width / height. Defaults to 1 (square). */
  aspectRatio?: number;
}

/** The seven structured sections that make up the prompt. */
export interface GptBackgroundBriefSections {
  scene: string;
  hero: string;
  environment: string;
  lighting: string;
  colourGrading: string;
  composition: string;
  negativePrompt: string;
}

/** Non-prompt provenance — lets a reviewer see which decisions drove the brief. */
export interface GptBackgroundBriefTraceability {
  primaryHook: string;
  visualWeight: string;
  visualFocalPath: string[];
  emotionalDirection: EmotionalTone[];
  colourMood: ColourMood;
  visualStory: VisualStory;
  compositionProfile: CompositionProfile;
  resolvedLighting: LightingKey;
  contentDensityClass: ContentDensity | null;
  agencyPaletteApplied: boolean;
}

export interface GptBackgroundBrief {
  /** The full production-ready GPT image prompt. */
  prompt: string;
  /** The same prompt, decomposed into its seven authored sections. */
  sections: GptBackgroundBriefSections;
  /** Provenance for review — never sent to the image model. */
  traceability: GptBackgroundBriefTraceability;
}
