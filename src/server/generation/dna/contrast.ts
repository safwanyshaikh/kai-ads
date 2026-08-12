/**
 * The Contrast Law.
 *
 * KDL §3.1 locked a single palette because a single palette is trivially
 * provable: every foreground/background pair in it was checked once, by
 * hand, and could never drift. Design DNA introduces many palettes, so the
 * guarantee has to move from "these four hexes" to "this property, checked
 * mechanically, for every DNA that ships".
 *
 * That is what this file is. It is not a relaxation of KDL — it is the
 * enforcement mechanism that makes multiple palettes safe. A DNA whose
 * palette fails any pair below cannot be registered, so it can never reach
 * a candidate. Under the Factual Integrity Law a fact rendered at
 * insufficient contrast is a fact the reader cannot act on, which is the
 * same defect as omitting it.
 */

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1..21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Palette colours must be #RRGGBB; received "${hex}".`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * The minimum a body-sized fact needs. 4.5:1 is WCAG AA for normal text;
 * recruitment facts are read on a phone, at feed compression, often
 * outdoors, so nothing factual is allowed below it.
 */
export const FACT_CONTRAST_MIN = 4.5;

/**
 * Large display marks (the hero numeral, rules, strap type) are set well
 * above 24px and qualify for WCAG AA Large.
 */
export const DISPLAY_CONTRAST_MIN = 3.0;

export interface ContrastViolation {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
}
