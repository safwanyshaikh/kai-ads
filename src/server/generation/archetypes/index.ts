import type { CompositionInput } from "./types";
import { renderVisualHero } from "./visual-hero";
import { renderStructuredProfessional } from "./structured-professional";
import { renderHighDensity } from "./high-density";
import { renderDtpNewspaper } from "./dtp-newspaper";
import {
  buildCompositionDirectives,
  enforceCompositionConstitution,
} from "./composition-constitution";

export * from "./types";
export { resolveAgencyVisualDna, type AgencyVisualDna, type VisualDnaOverrides } from "./visual-dna";
export { buildAdCopyPlan, type AdCopyPlan } from "./advertisement-intelligence";
export {
  ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH,
  buildCompositionDirectives,
  classifyContentDensity,
  enforceCompositionConstitution,
  CompositionConstitutionViolation,
  type CompositionDirectives,
  type ContentDensityClass,
  type FooterVariant,
  type InformationPriorityItem,
} from "./composition-constitution";
export {
  selectArchetype,
  archetypeUsesGeneratedImagery,
  buildImageBrief,
  recommendArchetype,
  styleForArchetype,
  type ArchetypeRecommendation,
  type ArchetypeSuitabilityInput,
  type ImageBriefContext,
} from "./archetype-selection";

/**
 * Creative Brain dispatch: routes the grounded facts + composition plan
 * to the archetype's own engine. Each engine is a genuinely separate
 * composition system (different SVG structure, different section
 * architecture, different typography), not a themed variant of one
 * template — see the module docblocks of the four engines.
 */
export function composeAdvertisement(input: CompositionInput): string {
  // ADVERTISEMENT COMPOSITION CONSTITUTION (docs/008): every render —
  // any archetype, any caller — goes through the directive decision
  // before composition and the constitutional gate after it. The
  // Typography Scale Engine's decision is folded into the headline
  // tuning so sparse sources scale UP instead of shrinking (Article III).
  const directives =
    input.plan.directives ??
    buildCompositionDirectives(input.facts, {
      archetype: input.plan.archetype,
      copy: input.plan.copy,
    });
  const govern: CompositionInput = {
    facts: input.facts,
    plan: {
      ...input.plan,
      directives,
      tuning: {
        ...input.plan.tuning,
        headlineScale: (input.plan.tuning?.headlineScale ?? 1) * directives.typographyScale,
      },
    },
  };
  let svg: string;
  switch (govern.plan.archetype) {
    case "VISUAL_HERO":
      svg = renderVisualHero(govern);
      break;
    case "STRUCTURED_PROFESSIONAL":
      svg = renderStructuredProfessional(govern);
      break;
    case "HIGH_DENSITY":
      svg = renderHighDensity(govern);
      break;
    case "DTP_NEWSPAPER":
      svg = renderDtpNewspaper(govern);
      break;
  }
  enforceCompositionConstitution(svg, input.facts, directives);
  return svg;
}
