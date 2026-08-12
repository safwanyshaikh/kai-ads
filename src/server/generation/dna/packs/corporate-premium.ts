import { defineDna, type DesignDNA } from "../design-dna";
import { FOREST_GOLD, MONO_INK, NAVY_GOLD, OXFORD_SKY, TEAL_SAND } from "./palettes";

/**
 * Pack 3 — Corporate Premium (10 DNAs).
 *
 * For employer-branded campaigns, white-collar and supervisory drives, and
 * anything a client will forward to their own management. Restrained
 * accents, quiet geometry, plenty of white space, and the trust callout
 * kept prominent — this pack's job is to look like it came from the
 * employer, not from a classified page.
 */
export const CORPORATE_PREMIUM: DesignDNA[] = [
  defineDna({
    id: "CP-01",
    pack: "CORPORATE_PREMIUM",
    label: "Boardroom Navy",
    description: "Restrained navy and gold, flat seam, no ribbon. The default corporate look.",
    composition: "PREMIUM_CAMPAIGN",
    palette: NAVY_GOLD,
    industries: ["engineering", "management", "administration", "finance", "banking"],
    layout: { margin: 0.075, heroFractionSparse: 0.36, cornerRadius: 0.006 },
    motifs: { seam: "FLAT", ribbon: "NONE", numeral: "COMPACT", headlineTracking: -1 },
    artwork: {
      direction: "A modern workplace interior or plant exterior, unpeopled or with figures small and incidental.",
      grade: "Neutral, architectural, even light.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-02",
    pack: "CORPORATE_PREMIUM",
    label: "Oxford Formal",
    description: "Oxford blue with a pale accent and rule-led rows. Reads like a company document.",
    composition: "PREMIUM_CAMPAIGN",
    palette: OXFORD_SKY,
    industries: ["engineering", "technical", "administration", "it", "consultancy"],
    type: { D1: 0.066, H1: 0.046, H2: 0.034 },
    layout: { margin: 0.08, heroFractionSparse: 0.34, cornerRadius: 0 },
    motifs: { seam: "FLAT", ribbon: "NONE", rowStyle: "RULED", benefitStyle: "TEXT_STRIP", numeral: "COMPACT" },
    artwork: {
      direction: "A clean corporate or technical environment shot wide, horizon level, no people in the foreground.",
      grade: "Cool, low saturation, soft daylight.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-03",
    pack: "CORPORATE_PREMIUM",
    label: "Heritage Forest",
    description: "Deep forest and antique gold. For agencies trading on decades of standing.",
    composition: "PREMIUM_CAMPAIGN",
    palette: FOREST_GOLD,
    industries: [],
    layout: { margin: 0.072, heroFractionSparse: 0.4, cornerRadius: 0.004 },
    motifs: { ribbon: "BAR", ribbonText: "ESTABLISHED RECRUITMENT", seam: "FLAT" },
    artwork: {
      direction: "An establishing frame of the destination's working landscape, no single dominant figure.",
      grade: "Warm, slightly muted, classical.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-04",
    pack: "CORPORATE_PREMIUM",
    label: "White Paper",
    description: "Monochrome, square corners, ruled rows. The quietest corporate option.",
    composition: "PREMIUM_CAMPAIGN",
    palette: MONO_INK,
    industries: [],
    type: { D1: 0.062, H1: 0.044, H2: 0.032, BodyL: 0.023 },
    layout: { margin: 0.085, gutter: 0.024, heroFractionSparse: 0.3, cornerRadius: 0 },
    motifs: {
      layoutStyle: "DOCUMENT",
      seam: "FLAT",
      ribbon: "NONE",
      numeral: "NONE",
      rowStyle: "RULED",
      benefitStyle: "TEXT_STRIP",
      uppercaseHeadline: false,
      headlineTracking: 0,
    },
    artwork: {
      direction: "A near-abstract architectural or industrial texture — surface, structure, light — with no figures.",
      grade: "Almost monochrome, flat, no drama.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-05",
    pack: "CORPORATE_PREMIUM",
    label: "Client Deck",
    description: "Sized for A4 and PDF export: wide margins, large body, generous row rhythm.",
    composition: "PREMIUM_CAMPAIGN",
    palette: OXFORD_SKY,
    industries: [],
    type: { H2: 0.036, BodyL: 0.027, Body: 0.022, Caption: 0.018 },
    layout: { margin: 0.09, heroFractionSparse: 0.32, rowGapScale: 1.35, cornerRadius: 0.006 },
    motifs: { layoutStyle: "DOCUMENT", seam: "FLAT", ribbon: "NONE", numeral: "COMPACT", benefitStyle: "CHIPS" },
    artwork: {
      direction: "A calm establishing view of the workplace, composed with a clear empty upper band.",
      grade: "Neutral and even; nothing that fights printed type.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-06",
    pack: "CORPORATE_PREMIUM",
    label: "Executive Search",
    description: "For senior and single-role mandates. One position, given the whole page.",
    composition: "PREMIUM_CAMPAIGN",
    palette: NAVY_GOLD,
    industries: ["management", "engineering", "consultancy", "finance"],
    type: { D1: 0.086, H1: 0.058, H2: 0.04, H3: 0.032, BodyL: 0.028 },
    layout: { margin: 0.082, heroFractionSparse: 0.5, heroCapSparse: 0.68, rowGapScale: 1.5 },
    motifs: { seam: "FLAT", ribbon: "BAR", ribbonText: "SENIOR APPOINTMENT", numeral: "NONE" },
    artwork: {
      direction: "A single restrained architectural or landscape frame conveying scale and permanence.",
      grade: "Deep, quiet, low saturation.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-07",
    pack: "CORPORATE_PREMIUM",
    label: "Teal Professional",
    description: "Deep teal with sand accents and soft cards. Healthcare, education, services.",
    composition: "PREMIUM_CAMPAIGN",
    palette: TEAL_SAND,
    industries: ["healthcare", "nursing", "education", "hospitality", "facility"],
    layout: { margin: 0.075, cornerRadius: 0.018, heroFractionSparse: 0.36 },
    motifs: { seam: "STEP", ribbon: "NONE", benefitStyle: "CHIPS", numeral: "COMPACT" },
    artwork: {
      direction: "A bright professional environment with equipment and workspace visible, staff incidental.",
      grade: "Clean, bright, gently warm.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-08",
    pack: "CORPORATE_PREMIUM",
    label: "Banded Corporate",
    description: "Alternating row bands for 8–15 roles that still need a premium frame.",
    composition: "PREMIUM_CAMPAIGN",
    palette: FOREST_GOLD,
    industries: [],
    layout: { margin: 0.07, rowGapScale: 0.95, heroFractionSparse: 0.32 },
    motifs: { seam: "FLAT", ribbon: "NONE", rowStyle: "BANDED", numeral: "COMPACT" },
    artwork: {
      direction: "A broad view of the operation — site, plant, campus — that reads as an organisation, not a person.",
      grade: "Even, natural, mid-contrast.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CP-09",
    pack: "CORPORATE_PREMIUM",
    label: "Employer Brand",
    description: "Hero-led but restrained: the employer's name carries the page, not the vacancy count.",
    composition: "PREMIUM_CAMPAIGN",
    palette: MONO_INK,
    industries: [],
    type: { D1: 0.07, H1: 0.058 },
    layout: { margin: 0.078, heroFractionSparse: 0.46, cornerRadius: 0.004 },
    motifs: { seam: "DIAGONAL_RIGHT", ribbon: "NONE", numeral: "NONE", heroAlign: "CENTRE" },
    artwork: {
      direction: "A signature view of the employer's kind of work — the site, vessel, plant or facility itself.",
      grade: "Cinematic but restrained; no lens flare, no artificial colour.",
      focalRegion: "CENTRE",
    },
  }),

  defineDna({
    id: "CP-10",
    pack: "CORPORATE_PREMIUM",
    label: "Compact Corporate",
    description: "Tight geometry for square formats where the body still needs room for 10+ roles.",
    composition: "PREMIUM_CAMPAIGN",
    palette: OXFORD_SKY,
    industries: [],
    type: { D1: 0.06, H1: 0.042, H2: 0.03, BodyL: 0.022 },
    layout: { margin: 0.062, gutter: 0.018, heroFractionSparse: 0.26, heroCapSparse: 0.42, rowGapScale: 0.85 },
    motifs: { seam: "FLAT", ribbon: "NONE", numeral: "NONE", rowStyle: "RULED", benefitStyle: "TEXT_STRIP" },
    artwork: {
      direction: "A narrow horizontal band of workplace context — the top of a building, a skyline, a plant edge.",
      grade: "Neutral, uncluttered, low contrast.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),
];
