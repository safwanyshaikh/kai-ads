import type { AdvertisementStyle } from "@prisma/client";
import type { DensityLevel } from "../density-classification.service";
import type { AdvertisementArchetype, AdvertisementFacts } from "./types";

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
 * Creative Brain — image brief for the KAI Creative Engine (gpt-image-1).
 *
 * The brief describes ENVIRONMENT only (industry, country context, work
 * setting) — presentation, not facts. It explicitly prohibits text,
 * logos, brands, and signage so no employer identity or factual claim
 * can ever be fabricated inside the image (ADR-006: imagery is a
 * decorative layer; every fact is deterministic SVG text on top).
 */
export function buildImageBrief(facts: AdvertisementFacts): string {
  const trades = facts.positions
    .slice(0, 3)
    .map((p) => p.title)
    .join(", ");
  const tradeClause = trades ? ` The scene should evoke work such as: ${trades}.` : "";
  return (
    `A dramatic, professional, photorealistic photograph of a ${facts.industry} work environment in ${facts.country} — ` +
    `industrial setting, equipment, and atmosphere relevant to that industry.${tradeClause} ` +
    `Cinematic lighting, strong depth, suitable as the hero background of a recruitment advertisement with dark overlay at the bottom. ` +
    `Strictly no readable text, no logos, no watermarks, no signage, no visible brand names, no close-up identifiable faces.`
  );
}
