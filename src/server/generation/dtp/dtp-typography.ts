/**
 * DTP TYPOGRAPHY — the newspaper/classified type system.
 *
 * Deliberately its own scale, not the modern poster renderer's. The
 * poster scale is generous by design (large display sizes, open
 * leading, room to breathe); a classified page is the opposite
 * discipline — condensed faces, tight tracking, tight leading, and
 * every line earning its height. Reusing the poster tokens here would
 * import exactly the proportions this renderer exists to avoid.
 *
 * What IS shared is measurement. `roleTextWidth` reports the measured
 * advance width of a real bundled face; those numbers are properties of
 * the fonts themselves, not of the poster's design language, and the
 * project's "one source only" rule means they must not be re-declared
 * here. So DTP defines its own sizes/weights/tracking/leading, and
 * measures them through the shared primitive.
 *
 * FONT SELECTION — an explicit approximation, not a recovery.
 * The reference pages are raster scans and carry no font files. The
 * original faces are therefore unknown and cannot be claimed. These
 * tokens select the closest CONDENSED faces already bundled with the
 * project, chosen on visual equivalence of width, weight, uppercase
 * appearance, tracking and line density:
 *
 *   Anton            heavy condensed display  -> headline bars
 *   Oswald           condensed semibold       -> subheads, labels
 *   Barlow Condensed narrow, dense            -> position lists
 *   Roboto Condensed compact readable         -> body, legal
 *   Archivo Black    heavy figures            -> counts, phone numbers
 */
import { roleFamily, roleTextWidth, type TypeRole } from "@/lib/kdl-typography";

export type DtpToken =
  | "DTP_HEADLINE"
  | "DTP_SUBHEAD"
  | "DTP_BODY"
  | "DTP_LABEL"
  | "DTP_CONTACT"
  | "DTP_LEGAL"
  | "DTP_PRICE"
  | "DTP_NUMBER";

export interface DtpTypeSpec {
  /** The bundled face this token draws in, via the shared registry. */
  role: TypeRole;
  /** Size in px at the DTP reference column width (see dtp-page). */
  size: number;
  weight: number;
  /** Letter-spacing in px. Classified headlines run tight. */
  tracking: number;
  /** Baseline-to-baseline multiple. Newspaper leading is tight. */
  leading: number;
  uppercase: boolean;
}

/**
 * Sizes are quoted at a 452px column (A4 @300dpi, five columns) and
 * scale linearly with column width, so a wider slot enlarges type
 * rather than leaving it stranded.
 */
export const DTP_TYPE: Readonly<Record<DtpToken, DtpTypeSpec>> = {
  // The black bar headline: destination or campaign, set as tight as
  // the face allows.
  DTP_HEADLINE: { role: "DISPLAY", size: 34, weight: 800, tracking: -0.4, leading: 1.02, uppercase: true },
  // Project / sector line beneath a headline bar.
  DTP_SUBHEAD: { role: "SECTION", size: 19, weight: 700, tracking: 0.1, leading: 1.12, uppercase: true },
  // Running copy: eligibility, benefits, instructions.
  DTP_BODY: { role: "FINE", size: 15, weight: 400, tracking: 0, leading: 1.2, uppercase: false },
  // Small caps-ish field labels ("INTERVIEW", "BENEFITS").
  DTP_LABEL: { role: "SECTION", size: 13, weight: 600, tracking: 0.5, leading: 1.15, uppercase: true },
  // Phone/email — prominent, as the reference pages set them.
  DTP_CONTACT: { role: "NUMERIC", size: 17, weight: 800, tracking: -0.2, leading: 1.15, uppercase: false },
  // Licence/registration fine print.
  DTP_LEGAL: { role: "FINE", size: 11, weight: 400, tracking: 0, leading: 1.15, uppercase: false },
  // Salary figures.
  DTP_PRICE: { role: "SECTION", size: 16, weight: 700, tracking: 0, leading: 1.15, uppercase: true },
  // Vacancy titles and their counts in the position list.
  DTP_NUMBER: { role: "POSITION", size: 17, weight: 700, tracking: 0, leading: 1.16, uppercase: true },
} as const;

/** The reference column width the sizes above are quoted at. */
export const DTP_REFERENCE_COLUMN_PX = 452;

/** A token's size for a given column width. */
export function dtpSize(token: DtpToken, columnWidthPx: number): number {
  const scale = columnWidthPx / DTP_REFERENCE_COLUMN_PX;
  return Math.max(8, Math.round(DTP_TYPE[token].size * scale));
}

/** The line height a token occupies at a given column width. */
export function dtpLineHeight(token: DtpToken, columnWidthPx: number): number {
  return Math.ceil(dtpSize(token, columnWidthPx) * DTP_TYPE[token].leading);
}

export function dtpFamily(token: DtpToken): string {
  return roleFamily(DTP_TYPE[token].role);
}

/** Measured advance width, through the shared font metrics. */
export function dtpTextWidth(text: string, token: DtpToken, columnWidthPx: number): number {
  const spec = DTP_TYPE[token];
  const rendered = spec.uppercase ? text.toUpperCase() : text;
  const size = dtpSize(token, columnWidthPx);
  return roleTextWidth(rendered, size, spec.role) + rendered.length * spec.tracking;
}

/** The string as this token draws it (case is part of the token). */
export function dtpText(text: string, token: DtpToken): string {
  return DTP_TYPE[token].uppercase ? text.toUpperCase() : text;
}

/**
 * Greedy word wrap against a real measured width. Returns every line —
 * nothing is dropped, because a classified block grows to fit its copy
 * rather than truncating it.
 */
export function dtpWrap(text: string, token: DtpToken, maxWidth: number, columnWidthPx: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && dtpTextWidth(candidate, token, columnWidthPx) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
