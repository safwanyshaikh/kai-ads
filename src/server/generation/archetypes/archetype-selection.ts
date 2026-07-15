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
 * (gpt-image-1). HYBRID ARCHITECTURE: GPT generates the premium TEXT-FREE
 * creative visual canvas — industry imagery, visual storytelling,
 * commercial composition, depth, lighting, and art direction. KAI
 * deterministically composes ALL factual typography, contact details,
 * positions, interview dates, benefits, agency identity, and verification
 * elements on top.
 *
 * GPT MUST NOT render any readable text, numbers, logos, or factual
 * recruitment copy. This prevents hallucinated text, misspellings,
 * corrupted typography, and fabricated content — every factual word
 * comes from deterministic rendering against source-grounded data.
 *
 * The brief tells GPT the thematic context (industry, country, project
 * type) so it can create relevant visual storytelling, but does NOT pass
 * the actual factual strings (positions, phone numbers, dates, etc.)
 * since GPT must not attempt to render them.
 */
export function buildImageBrief(facts: AdvertisementFacts, context: ImageBriefContext = {}): string {
  const directives =
    context.directives ?? buildCompositionDirectives(facts, { archetype: "VISUAL_HERO", copy: context.copy });
  const palette = context.dna
    ? ` BRAND PALETTE — agency Visual DNA: primary ${context.dna.primaryColor}, secondary ${context.dna.secondaryColor}, accent ${context.dna.accentColor}. Use these to influence the visual tone and professional identity of the canvas.`
    : "";
  const format = context.aspectRatio
    ? ` Canvas format: ${context.aspectRatio >= 1.2 ? "landscape" : context.aspectRatio <= 0.85 ? "portrait" : "square"} for social-media circulation (WhatsApp, Facebook, Instagram, LinkedIn).`
    : "";

  const positionCount = facts.positions.length;
  const densityGuidance =
    directives.contentDensityClass === "SPARSE"
      ? `This is a SPARSE requirement (${positionCount} positions) — use dramatic, bold imagery that fills the canvas with visual power. Create strong compositional zones with depth and atmosphere. Leave generous, visually intentional text-safe areas (upper third for headline, mid-section for content, bottom strip for trust/contact).`
      : directives.contentDensityClass === "HIGH"
        ? `This is a HIGH-DENSITY requirement (${positionCount} positions) — create a professional, structured visual canvas with clear visual segmentation. Reserve wide horizontal bands for dense text content. The top zone should be a strong visual statement; the middle and lower zones should be clean, lighter backgrounds suitable for readable text overlay.`
        : `This is a MEDIUM-DENSITY requirement (${positionCount} positions) — balance compelling imagery with clear compositional zones for text overlay. Use professional poster composition with distinct visual sections.`;

  return (
    `You are a world-class overseas-recruitment advertising art director. Create the complete premium VISUAL DESIGN and ART DIRECTION of an overseas recruitment advertisement.${format}` +
    `\n\nCRITICAL RULE: Render NO readable text, NO letters, NO numbers, NO logos, NO QR codes, and NO factual recruitment copy anywhere on the canvas. All text and factual information will be added deterministically afterwards by the composition engine. Reserve visually intentional text-safe zones for this deterministic typography.` +
    `\n\nTHEMATIC CONTEXT (for visual storytelling only — do NOT render any of this as text):` +
    `\n- Industry: ${facts.industry}` +
    `\n- Destination country: ${facts.country}` +
    (facts.employer ? `\n- Project/employer context: ${facts.employer}` : "") +
    `\n- This is a ${facts.industry} recruitment opportunity in ${facts.country}` +
    `${palette}` +
    `\n\nVISUAL DESIGN REQUIREMENTS:` +
    `\n- ${densityGuidance}` +
    `\n- Strong visual storytelling: compelling ${facts.industry} environment, workplace atmosphere, or project scale imagery` +
    `\n- Commercially sophisticated lighting, depth, contrast, and visual direction` +
    `\n- Professional Gulf overseas-recruitment poster composition grammar` +
    `\n- Scroll-stopping within one second on a mobile phone feed` +
    `\n- Full canvas utilization — no dead zones, no blank areas` +
    `\n- Mobile-first social-media composition` +
    `\n\nCOMPOSITION ZONES (these must be visually designed-in, NOT added as overlays):` +
    `\n- UPPER ZONE (~30-35% of canvas): dramatic visual with intentional text-safe area for a large headline overlay — use depth, atmosphere, or a strong visual gradient that allows white or light text to read clearly` +
    `\n- MIDDLE ZONE (~35-40%): professional visual treatment with areas where text can overlay readably — consider using subtle scrims, tonal shifts, or compositional divisions that create text-ready zones while maintaining visual continuity` +
    `\n- LOWER ZONE (~25-30%): darker, professional foundation area suitable for contact information and trust elements overlay — a dark bar, deep tone, or professional footer-weight visual zone` +
    `\n\nPROHIBITIONS:` +
    `\n- Do NOT render any text, letters, numbers, or typographic elements` +
    `\n- Do NOT render any logos, badges, QR codes, or brand marks` +
    `\n- Do NOT show close-up identifiable human faces` +
    `\n- Do NOT include any signage, nameplates, hard hats with text, or equipment labels with readable text` +
    `\n- Do NOT include decorative pseudo-text, placeholder text, or text-like shapes` +
    `\n- The canvas must be purely visual: imagery, color, light, composition, atmosphere`
  );
}
