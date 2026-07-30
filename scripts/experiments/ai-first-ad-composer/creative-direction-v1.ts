/**
 * Creative Direction v1 — FROZEN.
 *
 * The output of the 30-concept Prompt Engineering Experiment and its
 * clustering into 5 design families (Structured Corporate, Industrial
 * Photographic Realism, Human-Centered Trust, Premium/Luxury Brand,
 * Campaign/High-Energy). This is reference context for the Creative
 * Planner below, not a template and not renderer input — the planner
 * still infers every decision from the raw recruiter text; this just
 * tells it which patterns were found to work and which to avoid.
 *
 * Frozen after CEO approval. Do not edit without a new experiment run.
 */
export const CREATIVE_DIRECTION_V1 = `
KAI Structured-Premium Recruitment Composition (Creative Direction v1)

Strongest family: Structured Corporate — validated against two live agency
advertisements and against 30 generated concepts across 5 design families.
Combine, in order of weight:

1. A short hook line above the job-title headline (urgency/opportunity
   statement), so the reading order is hook -> headline -> body -> CTA,
   not a cold start on the job title.
2. Card- or rule-separated sections: position list, requirements, and
   contact each sit in a distinct visually bounded region. Never one
   undifferentiated block of text.
3. A labeled CTA band ("APPLY NOW" / "HOW TO APPLY") precedes the raw
   contact details at the bottom.
4. Photographic artwork is atmosphere, never the sole legibility
   mechanism — always behind a guaranteed-contrast surface for text.
5. At most one purposeful human element, shown performing one of the
   actual listed trades — never a generic stock portrait, never sized to
   compete with the position list.
6. At most one restrained metallic/gold accent line, used sparingly as a
   divider or badge outline — never a full dark-luxury palette, which
   works against a blue-collar technical audience.
7. Explicitly excluded: hazard-stripe motifs, neon glow, cartoon-style
   colour blocking, phone-mockup framing inside the advertisement itself.
   These tested as the least agency-credible and least resembling of any
   live sample advertisement.
`.trim();
