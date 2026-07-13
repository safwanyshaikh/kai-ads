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
