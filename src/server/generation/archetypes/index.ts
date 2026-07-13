import type { CompositionInput } from "./types";
import { renderVisualHero } from "./visual-hero";
import { renderStructuredProfessional } from "./structured-professional";
import { renderHighDensity } from "./high-density";
import { renderDtpNewspaper } from "./dtp-newspaper";

export * from "./types";
export {
  selectArchetype,
  archetypeUsesGeneratedImagery,
  buildImageBrief,
  recommendArchetype,
  styleForArchetype,
  type ArchetypeRecommendation,
  type ArchetypeSuitabilityInput,
} from "./archetype-selection";

/**
 * Creative Brain dispatch: routes the grounded facts + composition plan
 * to the archetype's own engine. Each engine is a genuinely separate
 * composition system (different SVG structure, different section
 * architecture, different typography), not a themed variant of one
 * template — see the module docblocks of the four engines.
 */
export function composeAdvertisement(input: CompositionInput): string {
  switch (input.plan.archetype) {
    case "VISUAL_HERO":
      return renderVisualHero(input);
    case "STRUCTURED_PROFESSIONAL":
      return renderStructuredProfessional(input);
    case "HIGH_DENSITY":
      return renderHighDensity(input);
    case "DTP_NEWSPAPER":
      return renderDtpNewspaper(input);
  }
}
