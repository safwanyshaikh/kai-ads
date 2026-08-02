/**
 * Layout Intelligence — the presentation strategy tables.
 *
 *   ... -> Campaign Intelligence -> **Layout Intelligence** -> Rendering Engine -> ...
 *
 * DATA, NOT CODE. Every presentation decision is a lookup below, keyed on
 * what Campaign Intelligence already determined. A new audience or
 * campaign shape is a new row, never a new branch.
 *
 * THE LINE THIS ENGINE MUST NOT CROSS
 *
 * It decides HOW the campaign should be presented, in strategic terms
 * only: never a coordinate, a pixel, a canvas size, a font name, or a
 * colour value. "Bold, high-legibility, industrial" is a typography
 * strategy; "Liberation Sans Bold, 48px" is a rendering decision and
 * belongs to the Rendering Engine, which runs later. Every table below
 * is checked against that line in tests/layout-intelligence.test.ts.
 *
 * SHARED VOCABULARY, NOT SHARED GUESSING
 *
 * Where a lookup keys on a value Campaign Intelligence produces (a CTA
 * strategy sentence, a trust posture sentence), the key is derived
 * PROGRAMMATICALLY from campaign-intelligence/strategy-map.ts rather than
 * retyped here. If Task 005's wording changes, this module's keys change
 * with it instead of silently going stale.
 */

import { HIRING_PATTERN_STRATEGY, TRUST_STRATEGY } from "@/server/campaign-intelligence/strategy-map";

// ---------------------------------------------------------------------------
// Audience-driven presentation strategy
// ---------------------------------------------------------------------------

export const AUDIENCE_LAYOUT_STRATEGY: Record<
  string,
  {
    heroImportance: string;
    textImageRatio: string;
    typographyStrategy: string;
    colourMood: string;
    rationale: string;
  }
> = {
  "Licensed healthcare professionals": {
    heroImportance: "Medium — credentials and role read before imagery",
    textImageRatio: "Text-forward",
    typographyStrategy: "Formal, precise, clinical — no decorative treatment",
    colourMood: "Clean and clinical, calm rather than energetic",
    rationale:
      "This audience reads for licensing terms first. A striking image does not substitute for a legible role and requirement, and a clinical register signals the professionalism the candidate is themselves held to.",
  },
  "Supervisory and management professionals": {
    heroImportance: "Low to Medium — restraint over spectacle",
    textImageRatio: "Text-forward",
    typographyStrategy: "Refined, minimal, restrained — no urgency markers",
    colourMood: "Understated and formal, deliberately unflashy",
    rationale:
      "A management candidate is usually employed and reading discreetly. A loud, image-led treatment reads as a mass-market post and undermines the discretion this audience requires to respond at all.",
  },
  "Certified technical specialists": {
    heroImportance: "Medium — the certification is the hook, not the picture",
    textImageRatio: "Balanced, slightly text-forward",
    typographyStrategy: "Technical and precise — trade codes and certifications must be crisp",
    colourMood: "Industrial and precise, neither muted nor decorative",
    rationale:
      "This audience self-identifies by ticket and trade code. Those need to be immediately legible; the image supports recognition of the work, it does not replace the credential.",
  },
  "Skilled trades workforce": {
    heroImportance: "High — the work itself is the strongest recruiting signal",
    textImageRatio: "Balanced",
    typographyStrategy: "Bold, high-legibility, direct — no subtlety",
    colourMood: "Bold and industrial, high contrast",
    rationale:
      "Trade and pay are read fast, often on a shared phone in a group chat. Boldness and a strong work image carry more of the message than fine print does.",
  },
  "General workforce": {
    heroImportance: "High — accessibility and immediate recognisability matter most",
    textImageRatio: "Image-forward",
    typographyStrategy: "Plain, large, unambiguous — no jargon, no subtlety",
    colourMood: "Warm and approachable, high contrast for readability",
    rationale:
      "This is the widest and least literate-by-assumption audience the platform serves. The image has to communicate the opportunity before a single word is read.",
  },
};

/**
 * Layout family, jointly keyed on audience and communication load.
 *
 * The same audience needs a different family depending on how much has
 * to be said: a single senior vacancy and forty distinct trades are not
 * laid out the same way even when both are read by the same kind of
 * candidate.
 */
export function layoutFamilyFor(
  audience: string,
  density: string,
): { family: string; rationale: string } | null {
  if (audience === "Supervisory and management professionals" || audience === "Licensed healthcare professionals") {
    return {
      family: "Corporate Premium",
      rationale: `${audience} respond to restraint regardless of how much content there is — a dense professional listing still reads as a formal notice, not a poster.`,
    };
  }

  if (audience === "Certified technical specialists") {
    return {
      family: density === "HIGH" ? "High Density" : "Industrial Premium",
      rationale:
        density === "HIGH"
          ? "A high volume of specialist trades needs the compact, information-dense treatment even for a technical audience — legibility of each line outranks visual polish at this volume."
          : "A specialist audience at a manageable volume is best served by a premium industrial treatment that gives each credential room to be read clearly.",
    };
  }

  if (audience === "Skilled trades workforce") {
    return {
      family: density === "HIGH" ? "High Density" : "Industrial Premium",
      rationale:
        density === "HIGH"
          ? "A large multi-trade drive needs every line legible in a compact space — a bulk requirement, not a poster for one role."
          : "A moderate trade requirement reads well as a bold, work-led premium layout with room to breathe.",
    };
  }

  if (audience === "General workforce") {
    return {
      family: density === "HIGH" ? "Newspaper Classified" : "High Density",
      rationale:
        density === "HIGH"
          ? "At this volume and for this audience, the classified format is the one this readership already knows how to scan."
          : "A general-workforce requirement at moderate volume still needs a dense, no-frills treatment; this audience is not reading for polish.",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Publication type
// ---------------------------------------------------------------------------

/** Base channel recommendation by audience, before density modulation. */
const PUBLICATION_BY_AUDIENCE: Record<string, string[]> = {
  "Licensed healthcare professionals": ["LinkedIn", "Assignment Abroad"],
  "Supervisory and management professionals": ["LinkedIn"],
  "Certified technical specialists": ["LinkedIn", "WhatsApp", "Assignment Abroad"],
  "Skilled trades workforce": ["WhatsApp", "Status", "Facebook"],
  "General workforce": ["WhatsApp", "Status", "Facebook"],
};

/**
 * Density modulation.
 *
 * A HIGH-density bulk drive needs the widest possible local reach
 * regardless of audience, so print and newspaper classifieds are added.
 * A LOW-density, small requirement rarely justifies print spend, so they
 * are withheld even for an audience that would otherwise get them.
 */
export function publicationTypesFor(audience: string, density: string): string[] | null {
  const base = PUBLICATION_BY_AUDIENCE[audience];
  if (!base) return null;

  const types = new Set(base);
  if (density === "HIGH") {
    types.add("Newspaper");
    types.add("Print");
  }
  return [...types];
}

// ---------------------------------------------------------------------------
// CTA priority — derived from Campaign Intelligence's own CTA strategies
// ---------------------------------------------------------------------------

/**
 * Reverse-maps each hiring-pattern's CTA STRATEGY SENTENCE (from Task
 * 005) to what a layout should do about it. Built from
 * HIRING_PATTERN_STRATEGY's own values rather than retyped, so a wording
 * change upstream cannot silently desynchronize this table.
 */
export const CTA_PRIORITY_BY_HIRING_PATTERN: Record<string, { priority: string; rationale: string }> = {
  "Bulk Mobilization": {
    priority: "Primary — venue and date must be immediately visible",
    rationale: "At this volume the call is the whole point of the post: where and when to show up.",
  },
  "Specialist Hiring": {
    priority: "Primary — named contact and certification must be immediately visible",
    rationale: "A small qualified pool needs to see their own credential and a way to reach a person, not a queue.",
  },
  "Management Hiring": {
    priority: "Secondary, understated — a discreet contact route, not a headline call",
    rationale: "A prominent call-to-action reads as mass recruitment and will suppress response from this audience.",
  },
  "Team Hiring": {
    priority: "Primary — trade, experience and the scheduled interview must be visible",
    rationale: "A team-sized hire needs enough qualified applicants to select from, without the machinery of a bulk drive.",
  },
};

/** Text -> hiring-pattern key, built from the single source of truth. */
export const CTA_TEXT_TO_PATTERN: Map<string, string> = new Map(
  Object.entries(HIRING_PATTERN_STRATEGY).map(([pattern, strategy]) => [strategy.ctaStrategy, pattern]),
);

// ---------------------------------------------------------------------------
// Trust presentation — derived from Campaign Intelligence's trust strategy
// ---------------------------------------------------------------------------

export const TRUST_PRESENTATION_BY_POSTURE: Record<
  string,
  { qrImportance: string; trustElementPriority: string; rationale: string }
> = {
  BLOCKED: {
    qrImportance: "Not applicable — the campaign does not proceed to publication",
    trustElementPriority: "Not applicable — compliance must be resolved first",
    rationale: "A trust element on a blocked campaign would present an unresolved violation as though it were cleared.",
  },
  UNVERIFIED: {
    qrImportance: "Present but secondary — the licence number carries the disclosure",
    trustElementPriority: "Licence disclosure first; no verification mark",
    rationale: "The registration number can be shown because it is on file; the verification mark must wait for verification.",
  },
  VERIFIED: {
    qrImportance: "Critical — the verification mark is the campaign's strongest differentiator",
    trustElementPriority: "Verification mark first, licence number second, logo third",
    rationale: "Against unlicensed operators the candidate is also reading, an independently checkable mark is the single strongest trust signal available.",
  },
};

/** Trust-strategy sentence -> posture key, built from the single source of truth. */
export const TRUST_TEXT_TO_POSTURE: Map<string, string> = new Map(
  Object.entries(TRUST_STRATEGY).map(([posture, strategy]) => [strategy.value, posture]),
);

// ---------------------------------------------------------------------------
// Density-driven whitespace
// ---------------------------------------------------------------------------

export const WHITESPACE_BY_DENSITY: Record<string, { strategy: string; rationale: string }> = {
  LOW: {
    strategy: "Generous — the low content volume allows the layout to breathe",
    rationale: "With little to say, empty space reads as quality rather than as waste.",
  },
  MEDIUM: {
    strategy: "Moderate — balanced between legibility and information volume",
    rationale: "Enough content to need discipline, not so much that space becomes a luxury.",
  },
  HIGH: {
    strategy: "Minimal — every line of a bulk requirement needs the space it can get",
    rationale: "At high density, generous whitespace would force type below a legible size or drop content.",
  },
};
