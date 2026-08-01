import { defineDna, type DesignDNA } from "../design-dna";
import { GRAPHITE_HAZARD, MONO_INK, NEWSPRINT, PETROL_COPPER, SITE_ORANGE } from "./palettes";

const ENERGY_TRADES = [
  "oil",
  "gas",
  "petrochemical",
  "refinery",
  "shutdown",
  "turnaround",
  "offshore",
  "marine",
  "pipeline",
  "epc",
  "energy",
  "power",
  "welding",
  "piping",
];

/**
 * Pack 5 — Oil & Gas (10 DNAs).
 *
 * Plant, refinery, shutdown, turnaround, offshore and EPC drives. These
 * requirements carry the most per-role detail in the whole product —
 * certifications, tickets, rotation, duty hours, visa category — so this
 * pack leans on generous detail type and row treatments that keep a long
 * certification string readable rather than compressing it.
 */
export const OIL_AND_GAS: DesignDNA[] = [
  defineDna({
    id: "OG-01",
    pack: "OIL_AND_GAS",
    label: "Petroleum Standard",
    description: "Petroleum blue and copper, display numeral. The pack's default.",
    composition: "PREMIUM_CAMPAIGN",
    palette: PETROL_COPPER,
    industries: ENERGY_TRADES,
    layout: { margin: 0.066, heroFractionSparse: 0.42 },
    motifs: { ribbon: "BAR", ribbonText: "PROJECT HIRING", seam: "DIAGONAL_LEFT" },
    artwork: {
      direction:
        "A process plant or refinery at working scale — columns, pipe racks, flare stack in the distance — " +
        "with crew in flame-resistant coveralls at real tasks.",
      grade: "Cool steel tones with a warm sodium-light accent.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "OG-02",
    pack: "OIL_AND_GAS",
    label: "Shutdown Mobilisation",
    description: "For turnarounds: the vacancy count leads, rotation and duty hours stay visible.",
    composition: "PREMIUM_CAMPAIGN",
    palette: GRAPHITE_HAZARD,
    industries: ENERGY_TRADES,
    type: { D1: 0.088, Caption: 0.018 },
    layout: { margin: 0.06, heroFractionSparse: 0.46, heroCapSparse: 0.64, rowGapScale: 1.1 },
    motifs: { numeral: "DISPLAY", ribbon: "BAR", ribbonText: "SHUTDOWN CAMPAIGN", uppercaseTitles: true },
    artwork: {
      direction: "A turnaround in progress — scaffolding around plant, temporary lighting, a large crew on shift.",
      grade: "Dusk, artificial lighting, high contrast.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "OG-03",
    pack: "OIL_AND_GAS",
    label: "Certified Welder",
    description: "Detail-first: large caption type so tickets and certifications stay readable.",
    composition: "PREMIUM_CAMPAIGN",
    palette: PETROL_COPPER,
    industries: ["welding", "piping", "fabrication", "structural", "boiler", "pressure"],
    type: { BodyL: 0.026, Caption: 0.019 },
    layout: { margin: 0.07, heroFractionSparse: 0.34, rowGapScale: 1.3, cornerRadius: 0.01 },
    motifs: { seam: "STEP", ribbon: "NOTCHED_RIGHT", ribbonText: "TICKETED TRADES", benefitStyle: "CHIPS" },
    artwork: {
      direction: "A welder at work on pipe or structure, arc light on the visor, sparks and shielding gas visible.",
      grade: "Dark surround, intense point light, deep contrast.",
      focalRegion: "RIGHT_THIRD",
    },
  }),

  defineDna({
    id: "OG-04",
    pack: "OIL_AND_GAS",
    label: "Offshore Rotation",
    description: "Built to carry rotation and duty-hour facts in the hero, not buried in a row.",
    composition: "PREMIUM_CAMPAIGN",
    palette: MONO_INK,
    industries: ["offshore", "marine", "vessel", "rig", "subsea", "drilling"],
    type: { D1: 0.07, H3: 0.03, Caption: 0.018 },
    layout: { margin: 0.074, heroFractionSparse: 0.48, heroCapSparse: 0.66 },
    motifs: { seam: "FLAT", ribbon: "NONE", heroAlign: "CENTRE", numeral: "COMPACT", rowStyle: "RULED" },
    artwork: {
      direction: "An offshore installation or support vessel at sea, horizon low, weather visible.",
      grade: "Cold, desaturated, marine light.",
      focalRegion: "CENTRE",
    },
  }),

  defineDna({
    id: "OG-05",
    pack: "OIL_AND_GAS",
    label: "EPC Package",
    description: "For multi-discipline EPC packages: banded rows, compact hero, salary column.",
    composition: "PREMIUM_CAMPAIGN",
    palette: PETROL_COPPER,
    industries: ["epc", "engineering", "commissioning", "instrumentation", "electrical"],
    type: { H2: 0.034, BodyL: 0.023 },
    layout: { margin: 0.06, heroFractionSparse: 0.28, heroCapSparse: 0.44, rowGapScale: 0.9 },
    motifs: { seam: "FLAT", ribbon: "NONE", rowStyle: "BANDED", benefitStyle: "TEXT_STRIP", numeral: "COMPACT" },
    artwork: {
      direction: "A construction-phase plant — steel erected, pipe spools staged, cranes working.",
      grade: "Neutral daylight, industrial, no colour styling.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "OG-06",
    pack: "OIL_AND_GAS",
    label: "Refinery Night",
    description: "Dark, high-drama treatment for premium employer-brand energy campaigns.",
    composition: "PREMIUM_CAMPAIGN",
    palette: GRAPHITE_HAZARD,
    industries: ENERGY_TRADES,
    type: { D1: 0.08, H1: 0.054 },
    layout: { margin: 0.076, heroFractionSparse: 0.52, heroCapSparse: 0.7, cornerRadius: 0.004 },
    motifs: { seam: "DIAGONAL_RIGHT", ribbon: "NONE", numeral: "DISPLAY", trustCallout: true },
    artwork: {
      direction: "A refinery at night, process lighting picking out structure against a dark sky, no people.",
      grade: "Night, sodium and mercury light, deep blacks.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "OG-07",
    pack: "OIL_AND_GAS",
    label: "Pipeline Corridor",
    description: "Landscape-led for cross-country pipeline and terminal projects.",
    composition: "PREMIUM_CAMPAIGN",
    palette: SITE_ORANGE,
    industries: ["pipeline", "terminal", "tank", "storage", "civil"],
    layout: { margin: 0.064, heroFractionSparse: 0.44 },
    motifs: { seam: "DIAGONAL_LEFT", ribbon: "BAR", ribbonText: "PROJECT MOBILISATION" },
    artwork: {
      direction: "A pipeline right of way or tank farm under construction, stretching to the horizon.",
      grade: "Arid, bright, dust and heat haze.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "OG-08",
    pack: "OIL_AND_GAS",
    label: "Plant Classified",
    description: "Classified structure in petroleum blue for 16+ discipline drives.",
    composition: "AAT_DTP",
    palette: PETROL_COPPER,
    industries: ENERGY_TRADES,
    layout: { margin: 0.054, rowGapScale: 0.92 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "OG-09",
    pack: "OIL_AND_GAS",
    label: "Shutdown Directory",
    description: "Dense classified for turnaround call-offs: 50+ disciplines, tight rhythm.",
    composition: "AAT_DTP",
    palette: NEWSPRINT,
    industries: ENERGY_TRADES,
    type: { H2: 0.03, BodyL: 0.021, Body: 0.018 },
    layout: { margin: 0.044, gutter: 0.014, rowGapScale: 0.72, heroFractionDense: 0.18 },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Single ink.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),

  defineDna({
    id: "OG-10",
    pack: "OIL_AND_GAS",
    label: "Discipline Table",
    description: "Classified with banded rows and a wide salary column for per-discipline rates.",
    composition: "AAT_DTP",
    palette: MONO_INK,
    industries: ENERGY_TRADES,
    layout: { margin: 0.05, gutter: 0.024, rowGapScale: 0.9 },
    motifs: { rowStyle: "BANDED" },
    artwork: {
      direction: "Not used — this composition prints no photography.",
      grade: "Flat solid bands only.",
      focalRegion: "BACKGROUND_ONLY",
    },
  }),
];
