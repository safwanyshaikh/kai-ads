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
  // the face allows. ~14pt.
  DTP_HEADLINE: { role: "DISPLAY", size: 58, weight: 800, tracking: -0.6, leading: 1.02, uppercase: true },
  // Project / sector line beneath a headline bar. ~8pt.
  DTP_SUBHEAD: { role: "SECTION", size: 33, weight: 700, tracking: 0.1, leading: 1.12, uppercase: true },
  // Running copy: eligibility, benefits, instructions. ~6.5pt.
  DTP_BODY: { role: "FINE", size: 27, weight: 400, tracking: 0, leading: 1.22, uppercase: false },
  // Small field labels ("INTERVIEW", "BENEFITS"). ~6pt.
  DTP_LABEL: { role: "SECTION", size: 25, weight: 600, tracking: 0.4, leading: 1.18, uppercase: true },
  // Phone/email — prominent, as the reference pages set them. ~8pt.
  DTP_CONTACT: { role: "NUMERIC", size: 33, weight: 800, tracking: -0.2, leading: 1.18, uppercase: false },
  // Licence/registration fine print. ~5pt.
  DTP_LEGAL: { role: "FINE", size: 21, weight: 400, tracking: 0, leading: 1.16, uppercase: false },
  // Salary figures. ~7.5pt.
  DTP_PRICE: { role: "SECTION", size: 31, weight: 700, tracking: 0, leading: 1.18, uppercase: true },
  // Vacancy titles and their counts. ~7.5pt.
  DTP_NUMBER: { role: "POSITION", size: 31, weight: 700, tracking: 0, leading: 1.2, uppercase: true },
} as const;

/**
 * The reference column the sizes above are quoted at: the format law's
 * minimum saleable advertisement width, 6.0cm, at newsprint 300dpi.
 *
 * Quoting against the real minimum slot is what keeps the point sizes
 * physical. Sizes were previously quoted against an arbitrary 452px
 * column — 3.83cm, narrower than any approved slot — which made every
 * classified render around two-thirds of its intended physical size.
 */
export const DTP_REFERENCE_COLUMN_PX = 709;

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
