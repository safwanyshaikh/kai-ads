import { defineDna, type DesignDNA } from "../design-dna";
import { CHARCOAL_AMBER, MONO_INK, NAVY_GOLD, OXFORD_SKY, TEAL_SAND } from "./palettes";

/**
 * Pack 1 — Premium Social (10 DNAs).
 *
 * For Instagram, Facebook, LinkedIn, WhatsApp and Telegram: read on a
 * phone, at thumbnail size, before anywhere else. Large type, generous
 * whitespace, a strong focal point, and the verified vacancy count set as
 * a graphic rather than a caption.
 *
 * Every entry is a set of values. None of them adds a rendering path.
 */
export const PREMIUM_SOCIAL: DesignDNA[] = [
  defineDna({
    id: "PS-01",
    pack: "PREMIUM_SOCIAL",
    label: "Feed Hero",
    description: "The house look. Diagonal seam, notched ribbon, display vacancy numeral.",
    composition: "PREMIUM_CAMPAIGN",
    palette: NAVY_GOLD,
    industries: [],
    artwork: {
      direction:
        "A single worker in correct protective equipment at their real trade, mid-task, photographed " +
        "from slightly below so the figure reads as substantial against open sky.",
      grade: "Warm late-afternoon light, deep shadows, natural saturation.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "PS-02",
    pack: "PREMIUM_SOCIAL",
    label: "Editorial Amber",
    description: "Magazine-weight headline on charcoal with an amber strap. Calm, modern, high contrast.",
    composition: "PREMIUM_CAMPAIGN",
    palette: CHARCOAL_AMBER,
    industries: [],
    type: { D1: 0.082, H1: 0.056, H2: 0.04 },
    layout: { margin: 0.072, heroFractionSparse: 0.46, cornerRadius: 0.004 },
    motifs: { seam: "DIAGONAL_RIGHT", ribbon: "BAR", ribbonText: "NOW HIRING", headlineTracking: -2 },
    artwork: {
      direction:
        "A wide environmental portrait of skilled workers on site, shallow depth of field, the " +
        "background falling away into haze.",
      grade: "Cool neutral grade with a single warm highlight.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "PS-03",
    pack: "PREMIUM_SOCIAL",
    label: "Quiet Mono",
    description: "Monochrome and typographic. No hue competing with the photograph.",
    composition: "PREMIUM_CAMPAIGN",
    palette: MONO_INK,
    industries: [],
    type: { D1: 0.076, H1: 0.05 },
    layout: { margin: 0.08, gutter: 0.024, heroFractionSparse: 0.5, cornerRadius: 0 },
    motifs: { seam: "FLAT", ribbon: "NONE", numeral: "COMPACT", rowStyle: "RULED", benefitStyle: "TEXT_STRIP" },
    artwork: {
      direction:
        "One strong black-and-white-leaning documentary frame of the trade being performed, no posing, " +
        "no eye contact with the camera.",
      grade: "Desaturated, high tonal separation, film-like grain.",
      focalRegion: "CENTRE",
    },
  }),

  defineDna({
    id: "PS-04",
    pack: "PREMIUM_SOCIAL",
    label: "Coastal Teal",
    description: "Deep teal and sand. Reads professional without reading corporate-blue.",
    composition: "PREMIUM_CAMPAIGN",
    palette: TEAL_SAND,
    industries: ["hospitality", "marine", "facility", "cleaning", "catering"],
    layout: { heroFractionSparse: 0.44, cornerRadius: 0.014 },
    motifs: { seam: "STEP", ribbon: "NOTCHED_RIGHT", ribbonText: "APPLY NOW", benefitStyle: "CHIPS" },
    artwork: {
      direction:
        "Workers in a clean, well-lit service or marine environment, wide frame, plenty of air above " +
        "the subject.",
      grade: "Bright, airy, slightly cool, no heavy contrast.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "PS-05",
    pack: "PREMIUM_SOCIAL",
    label: "Corporate Sky",
    description: "Oxford blue with a pale sky accent. For office, technical and supervisory drives.",
    composition: "PREMIUM_CAMPAIGN",
    palette: OXFORD_SKY,
    industries: ["engineering", "technical", "administration", "logistics", "it"],
    type: { H2: 0.036, BodyL: 0.026 },
    layout: { margin: 0.07, heroFractionSparse: 0.4 },
    motifs: { seam: "DIAGONAL_RIGHT", ribbonText: "WE ARE HIRING", uppercaseTitles: false },
    artwork: {
      direction:
        "A technical or supervisory environment — control room, site office, plant walkway — with " +
        "people working, not posing.",
      grade: "Clean daylight balance, low saturation, no orange grade.",
      focalRegion: "LEFT_THIRD",
    },
  }),

  defineDna({
    id: "PS-06",
    pack: "PREMIUM_SOCIAL",
    label: "Poster Bold",
    description: "Maximum headline weight for one or two roles. Built for a thumbnail.",
    composition: "PREMIUM_CAMPAIGN",
    palette: NAVY_GOLD,
    industries: [],
    type: { D1: 0.094, H1: 0.062, H2: 0.042, H3: 0.032, BodyL: 0.028 },
    layout: { margin: 0.06, heroFractionSparse: 0.52, heroCapSparse: 0.7, rowGapScale: 1.3 },
    motifs: { ribbon: "BAR", ribbonText: "URGENT HIRING", headlineTracking: -3 },
    artwork: {
      direction: "A tight, dramatic frame of one worker, filling the upper band, strong silhouette.",
      grade: "High contrast, deep blacks, single directional light source.",
      focalRegion: "CENTRE",
    },
  }),

  defineDna({
    id: "PS-07",
    pack: "PREMIUM_SOCIAL",
    label: "Soft Card",
    description: "Rounded role cards on a light surface. The friendliest look in the library.",
    composition: "PREMIUM_CAMPAIGN",
    palette: TEAL_SAND,
    industries: ["healthcare", "nursing", "hospitality", "retail", "domestic"],
    layout: { cornerRadius: 0.022, margin: 0.075, rowGapScale: 1.2, heroFractionSparse: 0.38 },
    motifs: { seam: "STEP", ribbon: "NOTCHED_LEFT", benefitStyle: "CHIPS", headlineTracking: 0 },
    artwork: {
      direction:
        "A calm, bright workplace with staff engaged in their actual duties; hands and equipment " +
        "visible, faces incidental.",
      grade: "Soft, even light, gentle warmth, no harsh shadow.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "PS-08",
    pack: "PREMIUM_SOCIAL",
    label: "Split Frame",
    description: "Centre-set hero over a flat seam. Symmetric, calm, works on any crop.",
    composition: "PREMIUM_CAMPAIGN",
    palette: CHARCOAL_AMBER,
    industries: [],
    layout: { heroFractionSparse: 0.45, margin: 0.078, cornerRadius: 0.006 },
    motifs: {
      seam: "FLAT",
      heroAlign: "CENTRE",
      ribbon: "BAR",
      ribbonText: "OVERSEAS OPPORTUNITY",
      rowStyle: "BANDED",
    },
    artwork: {
      direction: "A symmetric wide shot of the workplace with the horizon centred and the crew small in frame.",
      grade: "Balanced, natural, mid-contrast.",
      focalRegion: "CENTRE",
    },
  }),

  defineDna({
    id: "PS-09",
    pack: "PREMIUM_SOCIAL",
    label: "Numeral Lead",
    description: "The verified vacancy count as the dominant graphic. For large single-trade drives.",
    composition: "PREMIUM_CAMPAIGN",
    palette: NAVY_GOLD,
    industries: [],
    type: { D1: 0.068, H1: 0.048 },
    layout: { heroFractionSparse: 0.48, heroCapSparse: 0.66 },
    motifs: { numeral: "DISPLAY", ribbon: "NONE", seam: "DIAGONAL_RIGHT", trustCallout: true },
    artwork: {
      direction:
        "A crowd-scale frame — a large crew, a long site, a fleet — that honestly reads as volume of work.",
      grade: "Wide dynamic range, cool shadows, warm highlights.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "PS-10",
    pack: "PREMIUM_SOCIAL",
    label: "Minimal Story",
    description: "Tall-format minimalism for Instagram portrait and status posts.",
    composition: "PREMIUM_CAMPAIGN",
    palette: MONO_INK,
    industries: [],
    type: { D1: 0.07, H2: 0.034, Body: 0.021 },
    layout: { margin: 0.085, heroFractionSparse: 0.54, heroCapSparse: 0.72, cornerRadius: 0 },
    motifs: {
      seam: "FLAT",
      ribbon: "NONE",
      numeral: "COMPACT",
      rowStyle: "PLAIN",
      benefitStyle: "TEXT_STRIP",
      heroAlign: "LEFT",
      trustCallout: false,
    },
    artwork: {
      direction: "A single quiet frame with large areas of empty sky, wall or water, and one small human figure.",
      grade: "Muted, low contrast, generous negative space.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),
];
