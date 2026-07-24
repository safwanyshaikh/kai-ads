/**
 * Master Advertisement Prompt Builder (Sprint 007, rewritten Sprint 008
 * Workstreams C+D — Prompt DNA).
 *
 * Builds ONE complete prompt — never assembled from independent
 * per-block prompts — instructing GPT Image to generate the COMPLETE,
 * publication-ready recruitment advertisement.
 *
 * Workstream D law: the prompt speaks VISUAL CREATIVE LANGUAGE only.
 * No internal enum tokens, no engineering constants, no implementation
 * vocabulary may leak into it — every Creative Director decision is
 * translated into the language a senior art director would use when
 * briefing a photographer/designer. The Brain's intelligence is fully
 * preserved (Workstream C): hierarchy, storytelling, recruitment
 * psychology, luxury cues, and attention flow all derive from the
 * (unchanged) CreativeDirection — they are translated here, never
 * re-decided, and no layout is ever hardcoded.
 *
 * Truth Brain discipline still applies: every fact placed in the prompt
 * comes verbatim from grounded `AdvertisementFacts` — this builder never
 * invents a position, benefit, salary figure, or trust claim. It also
 * never asks GPT to draw a QR code or any trust badge — that is reserved
 * for the KAI Trust Layer (trust-layer.ts), composited afterward.
 */

import type { AdvertisementFacts } from "../archetypes/types";
import type { CommercialAdvertisementBrief } from "./commercial-brief";

/**
 * The reserved trust zone, shared with trust-layer.ts so the zone GPT is
 * told to leave clean is exactly the zone KAI composites into — this MUST
 * stay in sync between the prompt and the compositor.
 */
export const TRUST_ZONE = {
  widthPct: 30,
  heightPct: 22,
} as const;

/** Optional tenant brand identity (Agency Visual DNA), Workstream C/P10. */
export interface BrandContext {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

// ─────────────── Workstream D: enum → creative-language translation ───────────────
// Every map below converts an internal decision token into art-director
// language. Unknown/future tokens fall back to a safe generic phrase so a
// new enum value can never leak raw into a prompt.

const LEVER_PHRASES: Record<string, string> = {
  EMPLOYER: "the employer's name and reputation",
  COUNTRY: "the destination country",
  SALARY: "the salary offer",
  INDUSTRY: "the industry and its world of work",
  PROJECT: "the scale of the project",
  POSITIONS: "the open positions",
  BENEFITS: "the benefits package",
  INTERVIEW: "the interview call-to-action",
  TRUST: "the agency's credentials",
};
const leverPhrase = (lever: string) => LEVER_PHRASES[lever] ?? "the opportunity";

const PROMINENCE_PHRASES: Record<string, string> = {
  HIGH: "commanding, impossible to miss",
  MEDIUM: "clearly present, supporting the lead",
  LOW: "quiet and understated",
};
const prominencePhrase = (p: string) => PROMINENCE_PHRASES[p] ?? "balanced";

const PERSONALITY_MOODS: Record<string, string> = {
  EXECUTIVE: "refined executive gravitas — restrained, confident, expensive-looking",
  CORPORATE: "polished corporate professionalism with warm human energy",
  PREMIUM: "luxury-brand restraint: generous space, precise detail, quiet confidence",
  MASS_HIRING: "high-energy opportunity drive — bold, direct, urgent momentum",
  WALK_IN_DRIVE: "event-poster excitement: a date to show up for, energy of a crowd",
  SHUTDOWN: "industrial intensity — hard hats, floodlights, deadline energy",
  MEGA_PROJECT: "epic scale and awe — vast structures, small human figures, grandeur",
  URGENT_MOBILIZATION: "immediate departure energy — packed bags, decisive action",
  LUXURY_HOSPITALITY: "five-star hospitality elegance — marble, warm light, impeccable service",
  GOVERNMENT: "institutional dignity and formality",
  HEALTHCARE: "clinical calm, care, and human warmth",
};
const personalityMood = (p: string) =>
  PERSONALITY_MOODS[p] ?? "premium commercial confidence";

const URGENCY_PHRASES: Record<string, string> = {
  NONE: "no artificial urgency — let the opportunity speak calmly",
  LOW: "a gentle sense of timeliness",
  MEDIUM: "clear momentum — this opportunity is moving",
  HIGH: "genuine urgency — act-now energy throughout the design",
};
const urgencyPhrase = (u: string) => URGENCY_PHRASES[u] ?? "measured energy";

const CTA_PHRASES: Record<string, string> = {
  WALK_IN: "a walk-in interview invitation — the date and venue treated like an event announcement",
  EMAIL: "an email application call-to-action, easy to read and copy",
  WHATSAPP: "a WhatsApp contact call-to-action, instantly actionable from a phone",
  PHONE: "a phone-call call-to-action with the number given real presence",
  MIXED: "layered contact options, the easiest action most prominent",
};
const ctaPhrase = (kind: string) => CTA_PHRASES[kind] ?? "a clear, instantly findable way to apply";

/**
 * Density strategy (Workstream C, quality-audit RC4): the composition
 * guidance changes with how much factual content must be carried —
 * described in creative language, never as a layout grid spec.
 */
function compositionGuidance(density: "SPARSE" | "MEDIUM" | "HIGH", positionCount: number): string {
  switch (density) {
    case "SPARSE":
      return "With only a role or two to present, design this as a cinematic hero poster: one dominant image story, a headline with real scale, generous breathing room, and the few facts given jewel-like prominence. Nothing floats in emptiness — the composition is tight and intentional.";
    case "MEDIUM":
      return "Design this as a premium recruitment poster: a strong visual story on top, and the positions presented as a clean, confident listing that a candidate scans in seconds. Balance imagery and information — neither suffocates the other.";
    case "HIGH":
      return `This advertisement carries ${positionCount} positions — treat it like a beautifully set magazine or premium newspaper listing: disciplined columns, immaculate alignment, generous line spacing, every single position legible at arm's length. Imagery becomes a powerful but compact banner; the typography of the listing IS the design.`;
  }
}

function formatPositions(positions: AdvertisementFacts["positions"]): string {
  if (positions.length === 0) return "(none provided)";
  return positions
    .map((p) => `- ${p.title}${p.count ? ` (${p.count} openings)` : ""}${p.experience ? `, ${p.experience}` : ""}${p.salary ? ` — ${p.salary}` : ""}`)
    .join("\n");
}

function formatBenefits(benefits: AdvertisementFacts["benefits"]): string {
  if (benefits.length === 0) return "(none provided)";
  return benefits.map((b) => `- ${b.label}${b.detail ? `: ${b.detail}` : ""}`).join("\n");
}

function formatInterview(interview: AdvertisementFacts["interview"]): string {
  if (interview.length === 0) return "(none provided)";
  return interview.map((i) => `- ${[i.date, i.location].filter(Boolean).join(" at ")}`).join("\n");
}

function formatContact(contact: AdvertisementFacts["contact"]): string {
  const parts = [
    contact.name ? `Name: ${contact.name}` : null,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.whatsapp ? `WhatsApp: ${contact.whatsapp}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "(none provided)";
}

/**
 * Builds the single master prompt. `widthPx`/`heightPx` describe the
 * final delivery canvas; `brand` (optional) carries the agency's Visual
 * DNA palette so the advertisement belongs to the agency, not just to
 * the industry.
 */
export function buildMasterAdvertisementPrompt(
  brief: CommercialAdvertisementBrief,
  facts: AdvertisementFacts,
  ctx: { widthPx: number; heightPx: number; brand?: BrandContext | null },
): string {
  const readingFlow = brief.readingOrder.map(leverPhrase).join(", then ");
  const density = brief.whitespaceDirection.density;
  const positionCount = facts.positions.length;

  const brandDirection = ctx.brand
    ? `\nAgency brand palette (weave these into accents, bands, and typographic color — the ad must feel like it belongs to this agency): primary ${ctx.brand.primaryColor}, secondary ${ctx.brand.secondaryColor}, accent ${ctx.brand.accentColor}. The agency's logo will be added by the publisher afterwards — do not draw or invent any logo.`
    : "\nDo not draw or invent any logo — the agency's real logo is added by the publisher afterwards.";

  return `You are a senior recruitment creative director producing ONE complete, publication-ready commercial recruitment advertisement for the Gulf/GCC overseas-recruitment market. Create the FULL advertisement — finished typography, finished layout, finished composition, a complete colour story, clear visual hierarchy, and professional spacing — as a single image. It must look like the work of a premium advertising agency: photorealistic imagery, magazine-quality typesetting, never clip-art, never template-like, never "AI-looking". It must be immediately publishable with no further editing.

CANVAS: ${ctx.widthPx}x${ctx.heightPx} pixels.

=== CREATIVE DIRECTION ===
Lead with ${leverPhrase(brief.opportunityPriority.hero)} — that is what stops a candidate's scroll. The dominant headline hook is "${brief.candidatePsychology.dominantHook}"${brief.candidatePsychology.secondaryHook ? `, supported by "${brief.candidatePsychology.secondaryHook}"` : ""}.
Scene and story: ${brief.backgroundStrategy.sceneSeed}. Place ${brief.heroStrategy.subject.toLowerCase()} as the human anchor of the image${brief.heroStrategy.placement !== "NONE" ? `, weighted toward the ${brief.heroStrategy.placement.toLowerCase()} of the frame with the information flowing beside it` : ""}.
Mood and personality: ${personalityMood(brief.visualStory.personality)}.
Destination feel: ${brief.countryStyle.country} — carry its "${brief.countryStyle.premiumColour}" premium tone through the palette. Colour story: a deep grounding tone around ${brief.colourDirection.dark} with a rich accent around ${brief.colourDirection.gold}.${brandDirection}
Energy: ${urgencyPhrase(brief.urgency.level)}${brief.urgency.driver ? ` (the real reason: ${brief.urgency.driver})` : ""}.
The eye should travel through the advertisement in this order: ${readingFlow}.
Employer presence: ${prominencePhrase(brief.employerBrandWeight.prominence)}. Salary presence: ${brief.salaryEmphasis.hasSalary ? prominencePhrase(brief.salaryEmphasis.prominence) : "no salary is stated — do not fabricate one"}. Benefits presence: ${prominencePhrase(brief.benefitsEmphasis.prominence)}${brief.benefitsEmphasis.primary ? `, led by "${brief.benefitsEmphasis.primary}"` : ""}.
Call to action: ${ctaPhrase(brief.ctaDirection.kind)}.
${compositionGuidance(density, positionCount)}
Typography: publish-quality throughout — a commanding headline with real presence, confident secondary type, and immaculately legible small text. Every word spelled exactly as given. At phone-thumbnail size, the headline and the destination must still read instantly.
Photography: photorealistic, culturally accurate for Gulf industrial work, correct safety equipment where workers appear, believable faces and hands, natural professional lighting. No plastic skin, no distorted anatomy, no cartoon rendering.

=== FACTUAL CONTENT — render EVERY item below verbatim, spelled exactly as given. Do not invent, add, omit, or alter any fact. ===
Header: ${facts.header}
Employer: ${facts.employer ?? "(not provided — do not invent one)"}
Industry: ${facts.industry}
Country: ${facts.country}
Positions:
${formatPositions(facts.positions)}
Benefits:
${formatBenefits(facts.benefits)}
Interview details:
${formatInterview(facts.interview)}
Contact: ${formatContact(facts.contact)}
Footer / registration text: ${facts.footer ?? "(none provided)"}
Agency name: ${facts.agencyName}

=== RESERVED TRUST ZONE — DO NOT DRAW ANYTHING HERE ===
Leave the bottom-right ${TRUST_ZONE.widthPct}% width x ${TRUST_ZONE.heightPct}% height of the canvas visually clean (a simple, uncluttered continuation of the background — no text, no shapes, no icons, no border). The publisher will place a verification QR code, the agency's registration details, and a trust seal into that exact zone after you return the image. Do NOT draw any QR code, barcode, "verified" badge, checkmark seal, or any trust/certification graphic anywhere on the canvas.

=== HARD RULES ===
- Do not fabricate salary, vacancy counts, urgency, or benefits beyond what is listed above.
- Do not draw a QR code, logo, or any trust/verification badge anywhere.
- Do not place content inside the reserved trust zone.
- Spell every word exactly as given — this is a real commercial advertisement, not a mockup.
- The result must look like a premium, professionally designed commercial recruitment advertisement — not a document, not a form, not a slide.`;
}
