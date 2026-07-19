import { readFileSync } from "node:fs";
import path from "node:path";
import "./font-config"; // side effect: FONTCONFIG_FILE must be set before any rasterization

/**
 * Self-contained font data for the SVG renderer (FIX-010).
 *
 * section-renderer.ts previously referenced system font names ("Arial,
 * Helvetica, sans-serif" / "Georgia, 'Times New Roman', serif"). sharp's
 * SVG rasterizer resolves font-family names against whatever fonts are
 * installed in the OS it runs in — Vercel's serverless function runtime
 * ships with none of those installed, so every glyph fell back to a
 * missing-glyph box instead of readable text.
 *
 * Liberation Sans/Serif (SIL Open Font License 1.1 — see LICENSE file in
 * this directory) are metric-compatible substitutes for Arial and Times
 * New Roman, bundled here and embedded directly into each generated SVG
 * via @font-face + base64, so rendering never depends on the host having
 * any font installed at all.
 */

const FONTS_DIR = path.join(process.cwd(), "src/server/generation/fonts");

interface FontFaceEntry {
  family: "KaiSans" | "KaiSerif";
  weight: 400 | 700;
  file: string;
}

const FONT_FACES: FontFaceEntry[] = [
  { family: "KaiSans", weight: 400, file: "LiberationSans-Regular.ttf" },
  { family: "KaiSans", weight: 700, file: "LiberationSans-Bold.ttf" },
  { family: "KaiSerif", weight: 400, file: "LiberationSerif-Regular.ttf" },
  { family: "KaiSerif", weight: 700, file: "LiberationSerif-Bold.ttf" },
];

let cachedStyleBlock: string | null = null;

/** An SVG <style> block embedding every weight as base64 — built once per process, then reused. */
export function buildEmbeddedFontStyleBlock(): string {
  if (cachedStyleBlock) return cachedStyleBlock;

  const faces = FONT_FACES.map(({ family, weight, file }) => {
    const data = readFileSync(path.join(FONTS_DIR, file)).toString("base64");
    return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/truetype;base64,${data}) format('truetype'); }`;
  }).join("\n  ");

  cachedStyleBlock = `<style>\n  ${faces}\n  </style>`;
  return cachedStyleBlock;
}

/** Sans-serif stack (Typography/Visual styles) — always resolves to the embedded font, never a host font. */
export const KAI_SANS_FONT_FAMILY = "KaiSans";
/** Serif stack (Newspaper/DTP style) — always resolves to the embedded font, never a host font. */
export const KAI_SERIF_FONT_FAMILY = "KaiSerif";
