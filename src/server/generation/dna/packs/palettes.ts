import type { DnaPalette } from "../design-dna";

/**
 * Palette families for the production DNA library.
 *
 * Every family here is checked against the Contrast Law by the registry at
 * module load (`validateDesignDna`), against the exact foreground/
 * background pairs the Rendering Engine paints. Nothing in this file is
 * trusted because it looks right — a family that cannot carry factual text
 * fails the build.
 *
 * Families are shared across DNAs on purpose. Fifty bespoke palettes would
 * be fifty independent legibility risks; ten proven ones, recombined with
 * different type scales, geometry and motifs, give the same visual range
 * with a fraction of the surface area.
 */

/** KDL §3.1 — the KAI house palette. */
export const NAVY_GOLD: DnaPalette = {
  ink: "#0B1F33",
  accent: "#F3D98B",
  accentText: "#0B1F33",
  muted: "#4A5A6C",
  paper: "#FFFFFF",
  surface: "#F3EEE3",
  tint: "#EDE6D8",
  rule: "#C9C0AB",
  reversed: "#FFFFFF",
};

/** Editorial charcoal with a warm amber accent. Modern, high-contrast. */
export const CHARCOAL_AMBER: DnaPalette = {
  ink: "#14181D",
  accent: "#F0B429",
  accentText: "#14181D",
  muted: "#4A5058",
  paper: "#FFFFFF",
  surface: "#F4F5F7",
  tint: "#E9ECEF",
  rule: "#CBD2D9",
  reversed: "#FFFFFF",
};

/** Deep teal and sand. Reads professional without reading corporate-blue. */
export const TEAL_SAND: DnaPalette = {
  ink: "#0B3B3C",
  accent: "#E8C87E",
  accentText: "#0B3B3C",
  muted: "#3C5557",
  paper: "#FFFFFF",
  surface: "#F2F5F4",
  tint: "#E4EDEB",
  rule: "#C3D2CF",
  reversed: "#FFFFFF",
};

/** Monochrome premium. No hue at all — the quietest, most editorial family. */
export const MONO_INK: DnaPalette = {
  ink: "#101010",
  accent: "#D8D8D8",
  accentText: "#101010",
  muted: "#4B4B4B",
  paper: "#FFFFFF",
  surface: "#F7F7F7",
  tint: "#ECECEC",
  rule: "#D4D4D4",
  reversed: "#FFFFFF",
};

/** Oxford blue with a pale sky accent. Corporate, calm, banking-adjacent. */
export const OXFORD_SKY: DnaPalette = {
  ink: "#0A2540",
  accent: "#9FD3F5",
  accentText: "#0A2540",
  muted: "#42536B",
  paper: "#FFFFFF",
  surface: "#F3F6FA",
  tint: "#E5EDF6",
  rule: "#C4D3E2",
  reversed: "#FFFFFF",
};

/** Site safety orange on near-black. Construction and heavy civil. */
export const SITE_ORANGE: DnaPalette = {
  ink: "#1C1F23",
  accent: "#F2711C",
  accentText: "#1C1F23",
  muted: "#4C5259",
  paper: "#FFFFFF",
  surface: "#F5F5F4",
  tint: "#E9E9E7",
  rule: "#CFCFCB",
  reversed: "#FFFFFF",
};

/** Hazard yellow on graphite. The loudest family; used sparingly. */
export const GRAPHITE_HAZARD: DnaPalette = {
  ink: "#16181A",
  accent: "#F5C518",
  accentText: "#16181A",
  muted: "#474C52",
  paper: "#FFFFFF",
  surface: "#F4F4F5",
  tint: "#E8E9EA",
  rule: "#CBCDD0",
  reversed: "#FFFFFF",
};

/** Deep forest and antique gold. Established, long-standing agencies. */
export const FOREST_GOLD: DnaPalette = {
  ink: "#14352A",
  accent: "#D9B45B",
  accentText: "#14352A",
  muted: "#3B5748",
  paper: "#FFFFFF",
  surface: "#F2F6F3",
  tint: "#E5EDE8",
  rule: "#C6D3CB",
  reversed: "#FFFFFF",
};

/** Traditional print maroon on cream. The classified convention. */
export const MAROON_CREAM: DnaPalette = {
  ink: "#4A1220",
  accent: "#E8D9B8",
  accentText: "#4A1220",
  muted: "#5C3A44",
  paper: "#FFFFFF",
  surface: "#FAF6EE",
  tint: "#F0E8D8",
  rule: "#D2C3AD",
  reversed: "#FFFFFF",
};

/** Petroleum blue and copper. Oil, gas, marine, shutdown. */
export const PETROL_COPPER: DnaPalette = {
  ink: "#0D2436",
  accent: "#E0A458",
  accentText: "#0D2436",
  muted: "#3F5568",
  paper: "#FFFFFF",
  surface: "#F2F5F8",
  tint: "#E4EBF1",
  rule: "#C2D0DC",
  reversed: "#FFFFFF",
};

/** Pure black plate on white. Newsprint, and any single-ink destination. */
export const NEWSPRINT: DnaPalette = {
  ink: "#000000",
  accent: "#DDDDDD",
  accentText: "#000000",
  muted: "#333333",
  paper: "#FFFFFF",
  surface: "#FFFFFF",
  tint: "#E4E4E4",
  rule: "#000000",
  reversed: "#FFFFFF",
};
