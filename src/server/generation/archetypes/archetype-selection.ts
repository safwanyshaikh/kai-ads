import type { AdvertisementStyle } from "@prisma/client";
import type { DensityLevel } from "../density-classification.service";
import type { AdvertisementArchetype, AdvertisementFacts } from "./types";
import type { AdCopyPlan } from "./advertisement-intelligence";
import type { AgencyVisualDna } from "./visual-dna";
import { buildCompositionDirectives, type CompositionDirectives } from "./composition-constitution";

/**
 * Creative Brain — archetype decision.
 *
 * Maps the recruiter-visible style (persisted Prisma enum, unchanged) +
 * the density classification onto one of the four real composition
 * engines. TYPOGRAPHY splits into two genuinely different systems by
 * density: a moderate requirement gets the card-based Structured
 * Professional layout, a mass-hiring requirement gets the table-based
 * High-Density layout — matching the reference set, where medium-count
 * ads use cards/sections and 15+-position ads use dense tables.
 */
export function selectArchetype(params: {
  style: AdvertisementStyle;
  density: DensityLevel;
}): AdvertisementArchetype {
  switch (params.style) {
    case "VISUAL":
      return "VISUAL_HERO";
    case "NEWSPAPER":
      return "DTP_NEWSPAPER";
    case "TYPOGRAPHY":
      return params.density === "HIGH" ? "HIGH_DENSITY" : "STRUCTURED_PROFESSIONAL";
  }
}

/** Only the Visual Hero archetype spends image-generation budget — the other three are deliberately imagery-light per their reference grammar (structured ads use cards, dense/DTP ads are typographic). */
export function archetypeUsesGeneratedImagery(archetype: AdvertisementArchetype): boolean {
  return archetype === "VISUAL_HERO";
}

/** The persisted style enum value each archetype maps back to — archetype stays presentation-layer, the Prisma enum stays untouched. */
export function styleForArchetype(archetype: AdvertisementArchetype): AdvertisementStyle {
  switch (archetype) {
    case "VISUAL_HERO":
      return "VISUAL";
    case "DTP_NEWSPAPER":
      return "NEWSPAPER";
    case "STRUCTURED_PROFESSIONAL":
    case "HIGH_DENSITY":
      return "TYPOGRAPHY";
  }
}

export interface ArchetypeSuitabilityInput {
  positionCount: number;
  totalHeadcount: number;
  benefitCount: number;
  interviewEventCount: number;
  hasSalarySignal: boolean;
  isUrgent: boolean;
  /** Aspect ratio of the target platform format (width / height). */
  aspectRatio: number;
}

export interface ArchetypeRecommendation {
  recommendedArchetype: AdvertisementArchetype;
  suitabilityScores: Record<AdvertisementArchetype, number>;
  reasons: string[];
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Creative Brain — content-aware archetype suitability.
 *
 * Not every archetype suits every requirement: a five-position project
 * posting doesn't belong in the 20-30-row High-Density table, and a
 * 25-trade mass-hiring drive would be unreadable as a Visual Hero. Each
 * archetype is scored from the requirement's actual content shape, and
 * the recruiter can still manually override the recommendation (the API
 * layer keeps accepting an explicit style).
 */
export function recommendArchetype(input: ArchetypeSuitabilityInput): ArchetypeRecommendation {
  const reasons: string[] = [];
  const { positionCount, totalHeadcount, benefitCount, interviewEventCount, hasSalarySignal, isUrgent } = input;

  // VISUAL_HERO — strongest for 1-2 focal roles on social formats; each
  // extra position dilutes the hero's single-message impact.
  let hero = 72;
  if (positionCount <= 2) hero += 18;
  else if (positionCount <= 5) hero += 4;
  else hero -= (positionCount - 5) * 6;
  if (hasSalarySignal) hero -= 4; // a figure competes with imagery
  if (input.aspectRatio < 1.1) hero += 4; // portrait/square social canvases showcase imagery best

  // STRUCTURED_PROFESSIONAL — the professional default for 2-9 position
  // project recruitment with sections to organize.
  let structured = 70;
  if (positionCount >= 2 && positionCount <= 9) structured += 16;
  if (benefitCount > 0) structured += 4;
  if (interviewEventCount > 0) structured += 4;
  if (positionCount > 12) structured -= (positionCount - 12) * 4;
  if (hasSalarySignal || isUrgent) structured += 4; // fast-scan card layout carries the key figure well

  // HIGH_DENSITY — earns its table only with genuinely dense content.
  let dense = 30;
  dense += Math.min(55, Math.max(0, (positionCount - 5) * 7));
  dense += Math.min(15, Math.max(0, (totalHeadcount - 20) * 0.5));
  if (positionCount <= 5 && totalHeadcount <= 15) {
    reasons.push(
      `High-Density scored low: ${positionCount} positions / ~${totalHeadcount} headcount does not justify a vacancy table.`,
    );
  }

  // DTP_NEWSPAPER — traditional print/WhatsApp circulation; likes text
  // density and is the classic form for larger multi-trade listings.
  let dtp = 62;
  if (positionCount >= 6) dtp += 10;
  if (benefitCount + interviewEventCount >= 3) dtp += 6;
  if (input.aspectRatio >= 1.3) dtp -= 6; // print grammar is weakest on wide screens

  const suitabilityScores: Record<AdvertisementArchetype, number> = {
    VISUAL_HERO: clamp(hero),
    STRUCTURED_PROFESSIONAL: clamp(structured),
    HIGH_DENSITY: clamp(dense),
    DTP_NEWSPAPER: clamp(dtp),
  };

  const recommendedArchetype = (Object.entries(suitabilityScores) as [AdvertisementArchetype, number][]).reduce(
    (best, next) => (next[1] > best[1] ? next : best),
  )[0];

  reasons.unshift(
    `Recommended ${recommendedArchetype} for ${positionCount} position(s), ~${totalHeadcount} headcount, ${benefitCount} benefit(s), ${interviewEventCount} interview event(s).`,
  );

  return { recommendedArchetype, suitabilityScores, reasons };
}

/**
 * Optional creative context for the image brief. Everything here is
 * derived from grounded facts or tenant identity — never invented — and
 * everything is optional so the brief degrades gracefully to an
 * environment-only brief when a caller has no context yet.
 */
export interface ImageBriefContext {
  copy?: AdCopyPlan | null;
  dna?: AgencyVisualDna | null;
  directives?: CompositionDirectives;
  /** width / height of the target platform format. */
  aspectRatio?: number;
}

/**
 * Creative Brain — creative-director brief for the KAI Creative Engine
 * (gpt-image-1). GPT is asked to design the MAIN visual advertisement
 * canvas — composition, hierarchy, zone architecture, lighting, energy —
 * not a decorative stock background. Dynamically constructed from the
 * grounded facts, the Brain B hook, the Constitution's directives
 * (density class, information priority) and the Agency Visual DNA.
 *
 * Text-precision law (ADR-006, Composition Constitution): the truthful
 * hook is communicated as OVERLAY CONTEXT only — quoted, and explicitly
 * forbidden from being rendered. The brief prohibits ALL text, logos,
 * signage, and brand names inside the image; every fact, the real logo,
 * and the real verification QR are guaranteed deterministically on top,
 * inside the text-safe zones this brief instructs GPT to design in.
 */
export function buildImageBrief(facts: AdvertisementFacts, context: ImageBriefContext = {}): string {
  const directives =
    context.directives ?? buildCompositionDirectives(facts, { archetype: "VISUAL_HERO", copy: context.copy });
  const trades = facts.positions
    .slice(0, 3)
    .map((p) => p.title)
    .join(", ");
  const densityGuidance =
    directives.contentDensityClass === "SPARSE"
      ? "Content is sparse, so the imagery and graphic energy must carry MORE of the canvas — bolder, closer, more dramatic."
      : directives.contentDensityClass === "HIGH"
        ? "Content is dense, so keep the composition's zones calmer and cleaner to leave room for structured overlays."
        : "Balance imagery drama with clean zones for the structured overlays.";
  const palette = context.dna
    ? ` BRAND PALETTE — the agency's Visual DNA; echo these subtly in lighting and graphic tones, never as flat fills over the whole frame: primary ${context.dna.primaryColor}, secondary ${context.dna.secondaryColor}, accent ${context.dna.accentColor}.`
    : "";
  const format = context.aspectRatio
    ? ` The canvas is a ${context.aspectRatio >= 1.2 ? "landscape" : context.aspectRatio <= 0.85 ? "portrait" : "square"} social-media format.`
    : "";
  return (
    `You are a world-class overseas-recruitment advertising creative director and visual designer. ` +
    `Design the MAIN VISUAL ADVERTISEMENT CANVAS for a premium overseas recruitment advertisement — a complete, art-directed advertising composition, not a stock photo and not a plain background.${format} ` +
    `AUDIENCE AND OPPORTUNITY (grounded facts only): skilled candidates${trades ? ` in trades such as ${trades}` : ""} considering overseas work; hiring destination ${facts.country}; industry ${facts.industry}. ` +
    `The advertisement's dominant truthful hook — which will be overlaid afterwards in exact typography by the platform, so you must NOT render it or any other text — is: "${directives.dominantHook}". Let its subject and energy drive the scene. ` +
    `COMMERCIAL REQUIREMENTS: full-bleed cinematic ${facts.industry} environment with dramatic depth, premium lighting, and a sense of scale and opportunity; professional Gulf overseas-recruitment poster grammar; scroll-stopping within one second on a mobile feed and comprehensible within three; mobile-first contrast; full canvas utilisation with no dead, flat, or purposeless areas. ${densityGuidance} ` +
    `TEXT-SAFE ZONE ARCHITECTURE (exact text, the real agency logo, and the real verification QR are overlaid deterministically afterwards — design these zones INTO the composition): ` +
    `top ~40-45% of the frame: a bright, clean, high-contrast, uncluttered zone (open sky or light backdrop) as the dominant headline zone for very large stacked type; ` +
    `around the vertical midpoint: a strong horizontal energy band where a diagonal announcement ribbon will sit; ` +
    `lower third: a darker, grounded zone with rich structural detail over which positions, benefits, and contact panels remain readable; ` +
    `bottom ~10%: a calm dark zone for the agency trust strip and verification QR.${palette} ` +
    `ABSOLUTE PROHIBITIONS (truth law): render no readable text, letters, numerals, or typography of any kind anywhere in the image; no logos, no watermarks, no signage, no visible brand names; no close-up identifiable faces; never depict money, salaries, documents, or any factual claim — every fact is guaranteed by the platform's deterministic overlay.`
  );
}
