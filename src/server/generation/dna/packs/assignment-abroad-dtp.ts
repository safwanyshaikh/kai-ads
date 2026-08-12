import { defineDna, type DesignDNA } from "../design-dna";
import { MAROON_CREAM, MONO_INK, NAVY_GOLD, NEWSPRINT, PETROL_COPPER } from "./palettes";

/**
 * Pack 2 — Assignment Abroad / DTP (10 DNAs).
 *
 * The trade convention of Gulf recruitment classifieds: a hard outer
 * frame, full-measure reversed banners, ruled tables, every fact boxed,
 * no photography. Composition principles only — no masthead, mark or
 * artwork belonging to any publication is reproduced.
 *
 * These are the DNAs the engine reaches for when the requirement is
 * large (16+ roles) or the destination is print, because a ruled table
 * carries a hundred trades legibly and a campaign layout cannot.
 */
export const ASSIGNMENT_ABROAD_DTP: DesignDNA[] = [
  defineDna({
    id: "AA-01",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Classified Standard",
    description: "The house classified. Framed, ruled rows, gold strap, salary column.",
    composition: "AAT_DTP",
    palette: NAVY_GOLD,
    industries: [],
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-02",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Newsprint Mono",
    description: "One black plate on white. What a paper actually prints.",
    composition: "AAT_DTP",
    palette: NEWSPRINT,
    industries: [],
    type: { H2: 0.034, BodyL: 0.023, Body: 0.019 },
    layout: { margin: 0.05, gutter: 0.016, rowGapScale: 0.85 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Single ink.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-03",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Traditional Maroon",
    description: "Print maroon on cream. The long-established agency look.",
    composition: "AAT_DTP",
    palette: MAROON_CREAM,
    industries: [],
    layout: { margin: 0.055, rowGapScale: 0.95 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-04",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Directory Dense",
    description: "For 60+ trades. Tightest rhythm the legibility floor permits.",
    composition: "AAT_DTP",
    palette: NEWSPRINT,
    industries: [],
    type: { H2: 0.03, BodyL: 0.021, Body: 0.018, Caption: 0.016 },
    layout: { margin: 0.045, gutter: 0.014, rowGapScale: 0.7, heroFractionDense: 0.2, heroCapDense: 0.34 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Single ink.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-05",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Banded Table",
    description: "Alternating tint bands instead of hairlines — easier to track across a wide measure.",
    composition: "AAT_DTP",
    palette: MONO_INK,
    industries: [],
    layout: { margin: 0.05, rowGapScale: 0.9 },
    motifs: { rowStyle: "BANDED" },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-06",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Petroleum Classified",
    description: "Classified structure in petroleum blue and copper. For plant and shutdown drives.",
    composition: "AAT_DTP",
    palette: PETROL_COPPER,
    industries: ["oil", "gas", "petrochemical", "refinery", "shutdown", "marine"],
    layout: { margin: 0.055 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-07",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Open Frame",
    description: "No outer frame, wider margins. A calmer classified for a bought half-page.",
    composition: "AAT_DTP",
    palette: NAVY_GOLD,
    industries: [],
    layout: { margin: 0.07, gutter: 0.022, rowGapScale: 1.1 },
    motifs: { outerFrame: false },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-08",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Masthead Heavy",
    description: "A deeper reversed masthead for drives where the destination is the headline.",
    composition: "AAT_DTP",
    palette: MAROON_CREAM,
    industries: [],
    type: { D1: 0.08, H1: 0.056 },
    layout: { heroFractionDense: 0.34, heroCapDense: 0.56, margin: 0.055 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-09",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Plain Column",
    description: "No rules, no bands — pure typographic column setting for narrow bought slots.",
    composition: "AAT_DTP",
    palette: NEWSPRINT,
    industries: [],
    type: { BodyL: 0.022, Body: 0.019 },
    layout: { margin: 0.042, gutter: 0.013, rowGapScale: 0.8, heroFractionDense: 0.18 },
    motifs: { rowStyle: "PLAIN" },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Single ink.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "AA-10",
    pack: "ASSIGNMENT_ABROAD_DTP",
    label: "Mixed Trade Index",
    description: "Built for multi-employer drives: wide gutters, strong column rules, salary promoted.",
    composition: "AAT_DTP",
    palette: MONO_INK,
    industries: [],
    type: { H2: 0.032, BodyL: 0.022 },
    layout: { margin: 0.048, gutter: 0.026, rowGapScale: 0.85 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),
];
