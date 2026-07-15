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
 * (gpt-image-1). GPT is the primary advertisement designer: it generates
 * the COMPLETE commercial advertisement composition — layout, typography
 * hierarchy, imagery, text, visual storytelling, and full canvas design.
 *
 * KAI overlays only precision-critical elements afterwards: the exact
 * agency logo (real asset), the KAI verification QR, exact contact
 * details, and exact registration identity. GPT's text rendering may
 * have imperfections — KAI's deterministic precision layer guarantees
 * the elements where factual exactness is non-negotiable.
 *
 * The brief dynamically includes ALL grounded source facts so GPT can
 * design them into the composition. It does NOT ask for a background
 * or an image with empty zones — it asks for the finished advertisement.
 */
export function buildImageBrief(facts: AdvertisementFacts, context: ImageBriefContext = {}): string {
  const directives =
    context.directives ?? buildCompositionDirectives(facts, { archetype: "VISUAL_HERO", copy: context.copy });
  const palette = context.dna
    ? ` BRAND PALETTE — agency Visual DNA: primary ${context.dna.primaryColor}, secondary ${context.dna.secondaryColor}, accent ${context.dna.accentColor}. Use these to create strong professional identity throughout the design.`
    : "";
  const format = context.aspectRatio
    ? ` Canvas format: ${context.aspectRatio >= 1.2 ? "landscape" : context.aspectRatio <= 0.85 ? "portrait" : "square"} for social-media circulation (WhatsApp, Facebook, Instagram, LinkedIn).`
    : "";

  const positionLines = facts.positions.map((p) => {
    let line = p.title;
    if (p.experience) line += ` — ${p.experience}`;
    if (p.count) line += ` (${p.count} Nos)`;
    return line;
  });
  const positionBlock = positionLines.length <= 20
    ? positionLines.join("\n")
    : positionLines.slice(0, 20).join("\n") + `\n... and ${positionLines.length - 20} more positions`;

  const interviewBlock = facts.interview.length > 0
    ? facts.interview.map((e) => `${e.date}${e.location ? ` — ${e.location}` : ""}`).join("; ")
    : null;

  const benefitBlock = facts.benefits.length > 0
    ? facts.benefits.map((b) => b.label + (b.detail ? `: ${b.detail}` : "")).join("; ")
    : null;

  const densityGuidance =
    directives.contentDensityClass === "SPARSE"
      ? "Content is sparse — use dramatic imagery, bold typography, and graphic energy. Fill the canvas with visual power. Let the hook and destination dominate."
      : directives.contentDensityClass === "HIGH"
        ? "Content is dense — organize positions into clear categorized columns or sections. Use professional, structured typography. Every position must be readable."
        : "Balance compelling imagery with structured content sections. Use professional poster composition.";

  return (
    `You are a world-class overseas-recruitment advertising art director. Design and generate a COMPLETE, FINISHED, professionally produced recruitment advertisement.${format}` +
    ` This is the actual advertisement that a recruitment agency will publish — not a background, not a template, not a mockup.` +
    `\n\nDOMINANT HEADLINE (the single largest, most attention-stopping text on the canvas): "${directives.dominantHook}"` +
    `\n\nHIRING DESTINATION (must be immediately visible at headline-adjacent scale): ${facts.country}` +
    `\nINDUSTRY: ${facts.industry}` +
    (facts.employer ? `\nEMPLOYER / PROJECT: ${facts.employer}` : "") +
    `\n\nPOSITIONS (all must appear and be readable):\n${positionBlock}` +
    (interviewBlock ? `\n\nINTERVIEW: ${interviewBlock}` : "") +
    (benefitBlock ? `\n\nBENEFITS / COMPENSATION: ${benefitBlock}` : "") +
    (facts.footer ? `\n\nIMPORTANT NOTE: ${facts.footer}` : "") +
    `\n\nCONTACT (must be prominent — a candidate who wants to act must never hunt for it):` +
    (facts.contact.phone ? `\nPhone: ${facts.contact.phone}` : "") +
    (facts.contact.email ? `\nEmail: ${facts.contact.email}` : "") +
    (facts.contact.whatsapp ? `\nWhatsApp: ${facts.contact.whatsapp}` : "") +
    `\n\nAGENCY: ${facts.agencyName}` +
    (facts.raLicenseId ? ` — RA ${facts.raLicenseId}` : "") +
    (facts.fullRegistrationNumber ? `\nRegistration: ${facts.fullRegistrationNumber}` : "") +
    `${palette}` +
    `\n\nCOMMERCIAL DESIGN REQUIREMENTS:` +
    `\n- Professional Gulf overseas-recruitment poster/social-media advertisement grammar` +
    `\n- Scroll-stopping within one second on a mobile phone feed` +
    `\n- Candidate can understand the opportunity within three seconds` +
    `\n- ${densityGuidance}` +
    `\n- Strong visual storytelling: compelling ${facts.industry} environment imagery that tells the work-environment story` +
    `\n- Professional typography hierarchy: hook ≫ destination ≫ positions/details ≫ trust elements` +
    `\n- Full canvas utilization — no dead zones, no blank areas` +
    `\n- Contact details must be prominent with strong CTA treatment` +
    `\n- Agency identity in trust position (footer area), not dominating the top headline zone` +
    `\n\nIMPORTANT TEXT NOTE: Render ALL text clearly and readably. The platform will overlay the exact agency logo and a verification QR code in the bottom area afterwards — leave a small area (~100px) in the bottom-right corner for this QR overlay. All other text should be rendered by you as part of the complete advertisement design.` +
    `\n\nPROHIBITIONS: Do not fabricate any salary, vacancy count, urgency, benefit, or claim not listed above. Do not show close-up identifiable faces. Do not add any fact not provided. Every word must trace to the source facts above.`
  );
}
