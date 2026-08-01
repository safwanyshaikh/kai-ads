import {
  contrastRatio,
  DISPLAY_CONTRAST_MIN,
  FACT_CONTRAST_MIN,
  parseHex,
  type ContrastViolation,
} from "./contrast";

/**
 * Design DNA — CONFIGURATION DATA, NOT A TEMPLATE ENGINE.
 *
 * This file defines values. It contains no drawing code, no layout
 * algorithm, no composition logic and no branching on which advertisement
 * is being produced. Every mark on every KAI advertisement is still drawn
 * by the one Rendering Engine in `pipeline/fact-layer.ts` and
 * `pipeline/branding-overlay.ts`, using the same capacity solve, the same
 * legibility floor, the same anti-clipping rules and the same
 * fail-loud LayoutCapacityError.
 *
 * A DNA supplies that single engine with the constants it previously
 * hardcoded: which colour plays which role, how big the type scale is,
 * how much of the canvas the hero gets, whether a ribbon is drawn. Adding
 * a DNA can therefore never add a rendering path — there is nowhere for
 * one to live. If a visual idea cannot be expressed as values here, the
 * correct response is to widen this schema and teach the ONE engine to
 * read it, never to add a second engine.
 *
 * Relationship to KDL v1.0 (docs/012). KDL §3.1 locked four hexes because
 * a locked list is a provable guarantee. Design DNA keeps the guarantee
 * and changes how it is proved: the KAI palette remains the default and
 * every alternative palette must pass the Contrast Law in `contrast.ts`
 * before `registry.ts` will accept it. Legibility is now enforced
 * mechanically for every DNA that ships rather than by hand for one.
 */

/** The five production packs. */
export type DnaPack =
  | "PREMIUM_SOCIAL"
  | "ASSIGNMENT_ABROAD_DTP"
  | "CORPORATE_PREMIUM"
  | "CONSTRUCTION"
  | "OIL_AND_GAS";

export const DNA_PACKS: DnaPack[] = [
  "PREMIUM_SOCIAL",
  "ASSIGNMENT_ABROAD_DTP",
  "CORPORATE_PREMIUM",
  "CONSTRUCTION",
  "OIL_AND_GAS",
];

/**
 * Which of the engine's two compositions a DNA speaks. This is not a
 * choice of engine — both are rendered by the same functions, from the
 * same facts, through the same QR, verification and Vision QA.
 */
export type DnaComposition = "PREMIUM_CAMPAIGN" | "AAT_DTP";

/**
 * Palette ROLES. The engine never names a colour; it asks the palette for
 * the role it needs, which is what lets one renderer wear fifty looks
 * without a single conditional.
 */
export interface DnaPalette {
  /** Bars, rules, headings, primary factual text. */
  ink: string;
  /** Straps, vacancy cells, the hero numeral. */
  accent: string;
  /** Text sitting on `accent`. */
  accentText: string;
  /** Secondary factual text (role detail, salary column). */
  muted: string;
  /** Card and table-field fill. */
  paper: string;
  /** The body surface beneath the hero. */
  surface: string;
  /** Alternating band / soft fill. */
  tint: string;
  /** Hairlines and dividers. */
  rule: string;
  /** Text sitting on `ink`. */
  reversed: string;
}

/** Type scale, as fractions of canvas width (KDL §3.2). */
export interface DnaTypeScale {
  D1: number;
  H1: number;
  H2: number;
  H3: number;
  BodyL: number;
  Body: number;
  Caption: number;
}

export interface DnaLayout {
  /** Outer margin as a fraction of W. */
  margin: number;
  /** Column gutter as a fraction of W. */
  gutter: number;
  /** Fraction of H given to the hero for 1–12 roles. */
  heroFractionSparse: number;
  /** Fraction of H given to the hero for 13+ roles. */
  heroFractionDense: number;
  /** Hard cap on hero height, as a fraction of W. */
  heroCapSparse: number;
  heroCapDense: number;
  /** Header slab height as a fraction of H (capped at 0.15W by the engine). */
  headerHeight: number;
  /** Card/box corner radius as a fraction of W. 0 is a square corner. */
  cornerRadius: number;
  /** Multiplier on the density tier's row gap. 1 is the engine default. */
  rowGapScale: number;
}

/** The seam between the artwork band and the body surface. */
export type DnaSeam = "DIAGONAL_LEFT" | "DIAGONAL_RIGHT" | "FLAT" | "STEP";

/** The marketing ribbon above the headline. */
export type DnaRibbon = "NOTCHED_LEFT" | "NOTCHED_RIGHT" | "BAR" | "NONE";

/** How the verified vacancy count is set. */
export type DnaNumeral = "DISPLAY" | "COMPACT" | "NONE";

/** How a position row is dressed. */
export type DnaRowStyle = "CARD" | "RULED" | "BANDED" | "PLAIN";

/** How benefits are set. */
export type DnaBenefitStyle = "ICON_BAR" | "TEXT_STRIP" | "CHIPS";

/** Where the hero text sits. */
export type DnaHeroAlign = "LEFT" | "CENTRE";

/**
 * POSTER — the artwork spans the full canvas (down to the branding strip);
 * every fact is set directly on it, over a continuous scrim, the way a
 * real social recruitment poster is built. No seam, no separate body
 * surface, no white card holding the position list.
 *
 * DOCUMENT — the artwork occupies a bounded hero region; the position
 * list, benefits and interview sit on a separate flat body surface below
 * a seam. Reads as a typeset document with a photograph at the top —
 * correct for the classified/print packs, wrong for a feed.
 *
 * PREMIUM_CAMPAIGN's engine default is POSTER, matching the reference
 * recruitment-poster genre; a DNA can opt into DOCUMENT deliberately for
 * a client-deck or print-adjacent feel.
 */
export type DnaLayoutStyle = "POSTER" | "DOCUMENT";

export interface DnaMotifs {
  layoutStyle: DnaLayoutStyle;
  seam: DnaSeam;
  ribbon: DnaRibbon;
  /** Ribbon copy. Marketing language, never a verified fact. */
  ribbonText: string;
  numeral: DnaNumeral;
  rowStyle: DnaRowStyle;
  benefitStyle: DnaBenefitStyle;
  heroAlign: DnaHeroAlign;
  /** Headline letter-spacing in px at the rendered size. */
  headlineTracking: number;
  /** Uppercase the headline. */
  uppercaseHeadline: boolean;
  /** Uppercase position titles. */
  uppercaseTitles: boolean;
  /** Draw the hard outer frame (the classified convention). */
  outerFrame: boolean;
  /** Paint the trust callout box above the branding strip. */
  trustCallout: boolean;
}

/**
 * Objective art direction for the BACKGROUND ARTWORK ONLY.
 *
 * The image model owns visual concept, photography, illustration, mood and
 * composition, and nothing else. Nothing in here is ever printed, and
 * nothing in here may describe a recruitment fact — no salary, no vacancy
 * count, no employer, no benefit. It describes a scene.
 */
export interface DnaArtwork {
  /** One sentence of scene direction handed to the Creative Brief. */
  direction: string;
  /** Colour grade the artwork should carry, so it sits under the palette. */
  grade: string;
  /** Where the artwork's focal subject belongs, so type never fights it. */
  focalRegion: "LEFT_THIRD" | "RIGHT_THIRD" | "CENTRE" | "BACKGROUND_ONLY";
}

export interface DesignDNA {
  /** Stable identifier, e.g. "PS-03". Persisted in the Advertisement JSON. */
  id: string;
  pack: DnaPack;
  label: string;
  /** What this DNA is for — shown to the recruiter, never to the candidate. */
  description: string;
  composition: DnaComposition;
  palette: DnaPalette;
  type: DnaTypeScale;
  layout: DnaLayout;
  motifs: DnaMotifs;
  artwork: DnaArtwork;
  /**
   * Industries this DNA suits, matched case-insensitively as substrings.
   * Selection guidance only — never a filter that could leave a
   * requirement unrenderable.
   */
  industries: string[];
}

/** The KAI palette from KDL §3.1 — the default every DNA starts from. */
export const KDL_PALETTE: DnaPalette = {
  ink: "#0B1F33",
  accent: "#F3D98B",
  accentText: "#0B1F33",
  muted: "#4A5A6C",
  paper: "#FFFFFF",
  surface: "#F3EEE3",
  tint: "#F3EEE3",
  rule: "#C9C0AB",
  reversed: "#FFFFFF",
};

/** The engine's shipping type scale (KDL §3.2). */
export const KDL_TYPE: DnaTypeScale = {
  D1: 0.072,
  H1: 0.052,
  H2: 0.038,
  H3: 0.028,
  BodyL: 0.024,
  Body: 0.02,
  Caption: 0.016,
};

/** The engine's shipping geometry (KDL §2, §4). */
export const KDL_LAYOUT: DnaLayout = {
  margin: 0.065,
  gutter: 0.02,
  heroFractionSparse: 0.42,
  heroFractionDense: 0.3,
  heroCapSparse: 0.62,
  heroCapDense: 0.5,
  headerHeight: 0.11,
  cornerRadius: 0.008,
  rowGapScale: 1,
};

/**
 * KDL §3.2 — no factual text renders below this fraction of W, in any DNA.
 * Not a DNA field: a DNA cannot lower the legibility floor, because the
 * floor is what makes "no fact is ever omitted" true.
 */
export const LEGIBILITY_FLOOR = 0.016;

/**
 * The pairs every palette must satisfy. These are exactly the pairs the
 * Rendering Engine actually paints — each one was read off the drawing
 * code, so a passing palette is a proof about pixels, not a gesture.
 */
const REQUIRED_PAIRS: { pair: string; fg: keyof DnaPalette; bg: keyof DnaPalette; min: number }[] = [
  { pair: "heading/body-surface", fg: "ink", bg: "surface", min: FACT_CONTRAST_MIN },
  { pair: "heading/card", fg: "ink", bg: "paper", min: FACT_CONTRAST_MIN },
  { pair: "heading/tint", fg: "ink", bg: "tint", min: FACT_CONTRAST_MIN },
  { pair: "detail/body-surface", fg: "muted", bg: "surface", min: FACT_CONTRAST_MIN },
  { pair: "detail/card", fg: "muted", bg: "paper", min: FACT_CONTRAST_MIN },
  { pair: "reversed/ink-bar", fg: "reversed", bg: "ink", min: FACT_CONTRAST_MIN },
  { pair: "strap-text/strap", fg: "accentText", bg: "accent", min: FACT_CONTRAST_MIN },
  { pair: "accent/ink-bar", fg: "accent", bg: "ink", min: DISPLAY_CONTRAST_MIN },
];

/**
 * Validates a DNA against the Contrast Law and the structural invariants
 * the Rendering Engine relies on. Called by the registry at module load,
 * so an invalid DNA fails the build rather than a candidate's eyes.
 */
export function validateDesignDna(dna: DesignDNA): ContrastViolation[] {
  const violations: ContrastViolation[] = [];

  for (const key of Object.keys(dna.palette) as (keyof DnaPalette)[]) {
    parseHex(dna.palette[key]); // throws on a malformed token
  }

  for (const { pair, fg, bg, min } of REQUIRED_PAIRS) {
    const foreground = dna.palette[fg];
    const background = dna.palette[bg];
    const ratio = contrastRatio(foreground, background);
    if (ratio < min) {
      violations.push({ pair, foreground, background, ratio: Math.round(ratio * 100) / 100, required: min });
    }
  }

  return violations;
}

/** Structural invariants, separate from colour so failures read clearly. */
export function validateDnaGeometry(dna: DesignDNA): string[] {
  const errors: string[] = [];
  const t = dna.type;

  // A monotonic scale is what lets the engine step a heading down a rank
  // when a slot is tight without ever crossing the floor.
  const ordered: (keyof DnaTypeScale)[] = ["D1", "H1", "H2", "H3", "BodyL", "Body", "Caption"];
  for (let i = 1; i < ordered.length; i++) {
    if (t[ordered[i]] >= t[ordered[i - 1]]) {
      errors.push(`${dna.id}: type scale must decrease — ${ordered[i]} (${t[ordered[i]]}) >= ${ordered[i - 1]} (${t[ordered[i - 1]]})`);
    }
  }
  if (t.Caption < LEGIBILITY_FLOOR) {
    errors.push(`${dna.id}: Caption ${t.Caption} is below the legibility floor ${LEGIBILITY_FLOOR}`);
  }

  const l = dna.layout;
  if (l.margin <= 0 || l.margin >= 0.2) errors.push(`${dna.id}: margin ${l.margin} outside (0, 0.2)`);
  if (l.gutter < 0 || l.gutter >= 0.1) errors.push(`${dna.id}: gutter ${l.gutter} outside [0, 0.1)`);
  if (l.heroFractionSparse <= 0 || l.heroFractionSparse > 0.6) {
    errors.push(`${dna.id}: heroFractionSparse ${l.heroFractionSparse} outside (0, 0.6]`);
  }
  if (l.heroFractionDense <= 0 || l.heroFractionDense > 0.5) {
    errors.push(`${dna.id}: heroFractionDense ${l.heroFractionDense} outside (0, 0.5]`);
  }
  if (l.rowGapScale < 0.5 || l.rowGapScale > 2) {
    errors.push(`${dna.id}: rowGapScale ${l.rowGapScale} outside [0.5, 2]`);
  }

  return errors;
}

/** The engine's shipping motifs — the Premium Campaign composition as built. */
export const KDL_MOTIFS: DnaMotifs = {
  layoutStyle: "POSTER",
  seam: "DIAGONAL_LEFT",
  ribbon: "NOTCHED_LEFT",
  ribbonText: "HIRING NOW",
  numeral: "DISPLAY",
  rowStyle: "CARD",
  benefitStyle: "ICON_BAR",
  heroAlign: "LEFT",
  headlineTracking: -1,
  uppercaseHeadline: true,
  uppercaseTitles: false,
  outerFrame: false,
  trustCallout: true,
};

/** The engine's shipping motifs for the classified composition. */
export const KDL_DTP_MOTIFS: DnaMotifs = {
  layoutStyle: "DOCUMENT",
  seam: "FLAT",
  ribbon: "NONE",
  ribbonText: "",
  numeral: "NONE",
  rowStyle: "RULED",
  benefitStyle: "TEXT_STRIP",
  heroAlign: "CENTRE",
  headlineTracking: -1,
  uppercaseHeadline: true,
  uppercaseTitles: true,
  outerFrame: true,
  trustCallout: false,
};

/**
 * Convenience for authoring: a DNA is a DELTA on the KAI defaults.
 *
 * This is what keeps a fifty-DNA library maintainable. Widening the schema
 * means changing one default here, not editing fifty entries — so the
 * library cannot rot into fifty divergent copies of the same values, and a
 * DNA file stays a short statement of what makes that design different.
 */
export function defineDna(
  base: Omit<DesignDNA, "palette" | "type" | "layout" | "motifs"> & {
    palette?: Partial<DnaPalette>;
    type?: Partial<DnaTypeScale>;
    layout?: Partial<DnaLayout>;
    motifs?: Partial<DnaMotifs>;
  },
): DesignDNA {
  const motifBase = base.composition === "AAT_DTP" ? KDL_DTP_MOTIFS : KDL_MOTIFS;
  return {
    ...base,
    palette: { ...KDL_PALETTE, ...base.palette },
    type: { ...KDL_TYPE, ...base.type },
    layout: { ...KDL_LAYOUT, ...base.layout },
    motifs: { ...motifBase, ...base.motifs },
  };
}
