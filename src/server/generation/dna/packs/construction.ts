import { defineDna, type DesignDNA } from "../design-dna";
import { CHARCOAL_AMBER, GRAPHITE_HAZARD, MONO_INK, NAVY_GOLD, NEWSPRINT, SITE_ORANGE } from "./palettes";

const CONSTRUCTION_TRADES = [
  "construction",
  "civil",
  "building",
  "infrastructure",
  "mep",
  "electrical",
  "plumbing",
  "carpentry",
  "masonry",
  "steel",
  "scaffold",
  "concrete",
];

/**
 * Pack 4 — Construction (10 DNAs).
 *
 * Civil, building, infrastructure and MEP drives: usually many trades,
 * often many vacancies per trade, and read on a phone by a candidate who
 * is scanning for their own trade name before anything else. This pack
 * therefore favours strong trade typography, high-contrast site palettes
 * and row treatments that stay trackable at fifteen or twenty roles.
 */
export const CONSTRUCTION: DesignDNA[] = [
  defineDna({
    id: "CN-01",
    pack: "CONSTRUCTION",
    label: "Site Orange",
    description: "Safety orange on near-black. The pack's signature look.",
    composition: "PREMIUM_CAMPAIGN",
    palette: SITE_ORANGE,
    industries: CONSTRUCTION_TRADES,
    layout: { margin: 0.062, heroFractionSparse: 0.4, cornerRadius: 0.004 },
    motifs: { ribbon: "BAR", ribbonText: "SITE HIRING", seam: "DIAGONAL_LEFT", uppercaseTitles: true },
    artwork: {
      direction:
        "An active construction site mid-shift — formwork, rebar, cranes, workers in hi-vis and hard hats " +
        "doing real tasks.",
      grade: "Strong daylight, dust in the air, warm concrete tones.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "CN-02",
    pack: "CONSTRUCTION",
    label: "Hazard Index",
    description: "Hazard yellow on graphite with banded rows. Built for 10–15 trades.",
    composition: "PREMIUM_CAMPAIGN",
    palette: GRAPHITE_HAZARD,
    industries: CONSTRUCTION_TRADES,
    type: { D1: 0.066, H2: 0.034, BodyL: 0.023 },
    layout: { margin: 0.058, heroFractionSparse: 0.3, heroCapSparse: 0.46, rowGapScale: 0.88 },
    motifs: { rowStyle: "BANDED", ribbon: "BAR", ribbonText: "MULTIPLE TRADES", uppercaseTitles: true },
    artwork: {
      direction: "A wide site elevation showing scale — multiple floors, multiple crews, plant and access equipment.",
      grade: "Overcast, neutral, high tonal separation.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CN-03",
    pack: "CONSTRUCTION",
    label: "Trade Board",
    description: "Ruled rows and a compact hero — a site noticeboard, legible at arm's length.",
    composition: "PREMIUM_CAMPAIGN",
    palette: MONO_INK,
    industries: CONSTRUCTION_TRADES,
    type: { H2: 0.034, BodyL: 0.024 },
    layout: { margin: 0.055, heroFractionSparse: 0.26, heroCapSparse: 0.4, rowGapScale: 0.9, cornerRadius: 0 },
    motifs: {
      seam: "FLAT",
      ribbon: "NONE",
      rowStyle: "RULED",
      benefitStyle: "TEXT_STRIP",
      uppercaseTitles: true,
      numeral: "COMPACT",
    },
    artwork: {
      direction: "A close texture of site material — poured concrete, steel deck, scaffold tube — with no figures.",
      grade: "Flat, grey, industrial.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CN-04",
    pack: "CONSTRUCTION",
    label: "MEP Technical",
    description: "For mechanical, electrical and plumbing packages where certifications matter.",
    composition: "PREMIUM_CAMPAIGN",
    palette: CHARCOAL_AMBER,
    industries: ["mep", "electrical", "plumbing", "hvac", "mechanical", "instrumentation"],
    type: { BodyL: 0.025, Caption: 0.017 },
    layout: { margin: 0.068, heroFractionSparse: 0.34, rowGapScale: 1.15 },
    motifs: { seam: "STEP", ribbon: "NOTCHED_RIGHT", ribbonText: "CERTIFIED TRADES", benefitStyle: "CHIPS" },
    artwork: {
      direction: "A technician working on plant, panels or pipework, tools and equipment clearly in frame.",
      grade: "Cool interior light with warm equipment highlights.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "CN-05",
    pack: "CONSTRUCTION",
    label: "Infrastructure Wide",
    description: "For roads, bridges, rail and utilities. Landscape-led, volume-led.",
    composition: "PREMIUM_CAMPAIGN",
    palette: NAVY_GOLD,
    industries: ["infrastructure", "civil", "road", "bridge", "rail", "utilities"],
    layout: { margin: 0.066, heroFractionSparse: 0.46, heroCapSparse: 0.62 },
    motifs: { numeral: "DISPLAY", seam: "DIAGONAL_RIGHT", ribbon: "NONE" },
    artwork: {
      direction: "A long infrastructure corridor under construction — highway, viaduct, trench, pipeline right of way.",
      grade: "Wide, bright, deep perspective.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CN-06",
    pack: "CONSTRUCTION",
    label: "Finishing Trades",
    description: "Softer palette and cards for interior, joinery and finishing packages.",
    composition: "PREMIUM_CAMPAIGN",
    palette: CHARCOAL_AMBER,
    industries: ["carpentry", "joinery", "painting", "tiling", "gypsum", "interior", "finishing"],
    layout: { margin: 0.072, cornerRadius: 0.016, rowGapScale: 1.2, heroFractionSparse: 0.38 },
    motifs: { seam: "STEP", ribbon: "NOTCHED_LEFT", ribbonText: "SKILLED FINISHERS", benefitStyle: "CHIPS" },
    artwork: {
      direction: "An interior fit-out in progress — joinery, plasterwork, tiling — clean and well lit.",
      grade: "Warm, bright, low contrast.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "CN-07",
    pack: "CONSTRUCTION",
    label: "Bulk Mobilisation",
    description: "For 200-vacancy mobilisations: the count leads, the trades follow.",
    composition: "PREMIUM_CAMPAIGN",
    palette: SITE_ORANGE,
    industries: CONSTRUCTION_TRADES,
    type: { D1: 0.09, H1: 0.056 },
    layout: { margin: 0.06, heroFractionSparse: 0.48, heroCapSparse: 0.64, rowGapScale: 0.9 },
    motifs: { numeral: "DISPLAY", ribbon: "BAR", ribbonText: "MASS MOBILISATION", uppercaseTitles: true },
    artwork: {
      direction: "A large crew at shift change or muster — many workers, honestly depicting scale of hiring.",
      grade: "Hard sun, long shadows, dust haze.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CN-08",
    pack: "CONSTRUCTION",
    label: "Site Classified",
    description: "Classified structure in site orange. For 16+ trades headed to print or WhatsApp.",
    composition: "AAT_DTP",
    palette: SITE_ORANGE,
    industries: CONSTRUCTION_TRADES,
    layout: { margin: 0.052, rowGapScale: 0.9 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CN-09",
    pack: "CONSTRUCTION",
    label: "Trade Directory",
    description: "Dense classified for 40+ construction trades across multiple employers.",
    composition: "AAT_DTP",
    palette: NEWSPRINT,
    industries: CONSTRUCTION_TRADES,
    type: { H2: 0.031, BodyL: 0.021, Body: 0.018 },
    layout: { margin: 0.046, gutter: 0.015, rowGapScale: 0.75, heroFractionDense: 0.2 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Single ink.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "CN-10",
    pack: "CONSTRUCTION",
    label: "Hazard Classified",
    description: "Framed classified with hazard accents. High-visibility bulk civil drives.",
    composition: "AAT_DTP",
    palette: GRAPHITE_HAZARD,
    industries: CONSTRUCTION_TRADES,
    layout: { margin: 0.05, rowGapScale: 0.85 },
    motifs: { rowStyle: "BANDED" },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),
];
