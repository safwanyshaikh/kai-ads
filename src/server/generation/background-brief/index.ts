/**
 * GPT Background Brief Generator — public surface.
 *
 * Pipeline: Source → Truth Brain → Creative Brain →
 *   GPT Background Brief Generator → GPT Image → Frozen Overlay → Final Ad
 */

export { generateGptBackgroundBrief } from "./gpt-background-brief-generator";
export {
  toCreativeBrainDecisions,
  type CreativeBrainAdapterInput,
} from "./creative-brain-adapter";
export type {
  AgencyPalette,
  ColourMood,
  CompositionProfile,
  ContentDensity,
  CreativeBrainVisualDecisions,
  EmotionalTone,
  GptBackgroundBrief,
  GptBackgroundBriefSections,
  GptBackgroundBriefTraceability,
  LightingKey,
  VisualStory,
} from "./types";
