/**
 * Master Advertisement Prompt Builder (Sprint 007 — GPT-Native
 * Advertisement Architecture).
 *
 * Builds ONE complete prompt — never assembled from independent
 * per-block prompts — instructing GPT Image to generate the COMPLETE,
 * publication-ready recruitment advertisement: full typography, layout,
 * composition, colour, hierarchy, and spacing. This is a deliberate
 * reversal of the legacy `buildImageBrief`/`generateGptBackgroundBrief`
 * contract (which forbids GPT from rendering any readable text) — that
 * contract is untouched for the legacy pipeline; this module is the ONLY
 * place in the codebase that asks GPT to render real, factual copy.
 *
 * Truth Brain discipline still applies: every fact placed in the prompt
 * comes verbatim from grounded `AdvertisementFacts` — this builder never
 * invents a position, benefit, salary figure, or trust claim. It also
 * never asks GPT to draw a QR code or any trust badge — that is reserved
 * for the KAI Trust Layer (trust-layer.ts), composited afterward.
 */

import type { AdvertisementFacts } from "../archetypes/types";
import type { CommercialAdvertisementBrief } from "./commercial-brief";

function formatPositions(positions: AdvertisementFacts["positions"]): string {
  if (positions.length === 0) return "(none provided)";
  return positions
    .map((p) => `- ${p.title}${p.count ? ` (${p.count} openings)` : ""}${p.experience ? `, ${p.experience}` : ""}`)
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
 * The reserved trust zone, shared with trust-layer.ts so the zone GPT is
 * told to leave clean is exactly the zone KAI composites into — this MUST
 * stay in sync between the prompt and the compositor.
 */
export const TRUST_ZONE = {
  widthPct: 30,
  heightPct: 22,
} as const;

/**
 * Builds the single master prompt. `widthPx`/`heightPx` inform GPT of the
 * target canvas aspect ratio; the KAI Trust Layer reserves a fixed zone
 * in the bottom-right for the verification QR + agency registration —
 * GPT is told exactly where that zone is so it never places headline
 * content there.
 */
export function buildMasterAdvertisementPrompt(
  brief: CommercialAdvertisementBrief,
  facts: AdvertisementFacts,
  ctx: { widthPx: number; heightPx: number },
): string {
  const trustZoneWidthPct = TRUST_ZONE.widthPct;
  const trustZoneHeightPct = TRUST_ZONE.heightPct;

  return `You are a Senior Recruitment Creative Director producing ONE complete, publication-ready commercial recruitment advertisement for the Gulf/GCC recruitment market. Generate the FULL advertisement — complete typography, complete layout, complete composition, complete colour palette, complete visual hierarchy, complete spacing — in a single image. This must be immediately publishable with no further editing (no Photoshop, no post-processing beyond a small trust badge described below).

CANVAS: ${ctx.widthPx}x${ctx.heightPx}px.

=== COMMERCIAL DIRECTION (from KAI's Creative Director Brain — follow exactly) ===
Commercial goal: ${brief.commercialGoal.summary}
Opportunity priority (most to least important lever): ${brief.opportunityPriority.ranked.join(" > ")}
Candidate psychology: dominant hook "${brief.candidatePsychology.dominantHook}"${brief.candidatePsychology.secondaryHook ? `, secondary hook "${brief.candidatePsychology.secondaryHook}"` : ""}, motivation: ${brief.candidatePsychology.motivation}
Visual story: ${brief.visualStory.story} (${brief.visualStory.personality} personality)
Hero strategy: ${brief.heroStrategy.subject}, placed ${brief.heroStrategy.placement}
Background: ${brief.backgroundStrategy.sceneSeed}
Industry style: ${brief.industryStyle.environment} (prominence: ${brief.industryStyle.prominence})
Country style: ${brief.countryStyle.country} — ${brief.countryStyle.prestige} prestige, premium colour cue "${brief.countryStyle.premiumColour}", emotional tone: ${brief.countryStyle.emotionalTone}
Employer brand weight: ${brief.employerBrandWeight.brandStrength} (prominence: ${brief.employerBrandWeight.prominence})
Salary emphasis: ${brief.salaryEmphasis.hasSalary ? "prominent" : "not provided — do not fabricate a figure"} (prominence: ${brief.salaryEmphasis.prominence})
Benefits emphasis: primary "${brief.benefitsEmphasis.primary ?? "none"}" (prominence: ${brief.benefitsEmphasis.prominence})
Project emphasis: ${brief.projectEmphasis.projectType} (prominence: ${brief.projectEmphasis.prominence})
Urgency: ${brief.urgency.level}${brief.urgency.driver ? ` (driver: ${brief.urgency.driver})` : ""}
Reading order (top to bottom, first to last attention): ${brief.readingOrder.join(" -> ")}
Typography direction: hero "${brief.typographyDirection.hero}", secondary "${brief.typographyDirection.secondary}", table/list "${brief.typographyDirection.table}", CTA "${brief.typographyDirection.cta}"
Colour direction: mood "${brief.colourDirection.mood}", dark tone ${brief.colourDirection.dark}, accent/gold tone ${brief.colourDirection.gold}
Whitespace direction: ${brief.whitespaceDirection.guidance}
Composition: ${brief.compositionDirection.family} layout, ${brief.compositionDirection.columns} column(s), hero on the ${brief.compositionDirection.heroPlacement}
CTA direction: ${brief.ctaDirection.kind} call-to-action, priority ${brief.ctaDirection.priority}
Mobile readability: these elements must remain legible at phone scale: ${brief.mobileReadability.mustSurvive.join(", ") || "(none specified)"}

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
Leave the bottom-right ${trustZoneWidthPct}% width x ${trustZoneHeightPct}% height of the canvas visually clean (a simple, uncluttered background continuation — no text, no shapes, no icons, no border). KAI will composite a verification QR code, agency registration number, and trust seal into that exact zone after you return the image. Do NOT draw any QR code, barcode, "verified" badge, checkmark seal, or any trust/certification graphic anywhere on the canvas — KAI owns all trust signalling.

=== HARD RULES ===
- Do not fabricate salary, vacancy counts, urgency, or benefits beyond what is listed above.
- Do not draw a QR code or any trust/verification badge anywhere.
- Do not leave the reserved trust zone occupied by other content.
- Spell every word exactly as given — this is a real commercial advertisement, not a mockup.
- The result must look like a premium, professionally designed commercial recruitment advertisement — not a document, not a form, not a slide.`;
}
