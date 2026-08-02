/**
 * The 10 layout specs, as data — canvas size, zone heights (as % of full
 * canvas height, matching the doc's own --v worked example), columns, and
 * the capacity being demonstrated. Every number here is the arithmetic
 * from the written spec, converted to a percentage so the HTML/CSS layer
 * can size zones with calc(X * var(--v)) exactly as §5 describes.
 *
 * Zone heights are percentages of the FULL canvas height (not the safe
 * area) — the safe area is expressed separately as padding.
 */

export interface ZoneSpec {
  code: string;
  label: string;
  /** % of full canvas height. Omitted for Z3, which takes the remainder. */
  pctV?: number;
  /** CSS font-size, expressed as calc(X * var(--v)) coefficient. */
  fontPctV: number;
  weight: number;
  /** Letter-spacing, in em. Negative for display type, positive for micro-caps. */
  tracking?: number;
  uppercase?: boolean;
}

export interface LayoutSpec {
  code: string;
  name: string;
  surface: "print" | "digital";
  /** Target render size — already the correct px for print (@300dpi) or digital. */
  widthPx: number;
  heightPx: number;
  /** Safe margin, % of width (sides) and % of height (top/bottom). */
  safeMarginPctW: number;
  safeMarginPctTopV: number;
  safeMarginPctBottomV: number;
  /** Internal category-list columns. */
  columns: number;
  /** The capacity figure this render demonstrates, and how it was reached. */
  capacity: number;
  capacityNote: string;
  /** Zones present, in document order. */
  zones: ZoneSpec[];
  /** Whether Z10 (interview bar) is included in this specific render. */
  hasInterview: boolean;
  /**
   * "stack" (default) — zones, category block and footer stack
   * vertically, one after another. "split" — DG-5 only: a landscape
   * side-by-side region (left: hero+categories; right: footer stacked),
   * because a 1.91:1 board doesn't have the vertical room to stack all
   * of it and still clear the type floor. Category-block height in
   * split mode is NOT reduced by the footer, because the footer lives
   * beside it, not below it.
   */
  layoutMode?: "stack" | "split";
  /** Grouped category list (DG-6 only) — [groupLabel, categoryCount][]. */
  groups?: [string, number][];
  /** QR side length, as % of full canvas height. */
  qrPctV: number;
}

const Z1: ZoneSpec = { code: "Z1", label: "hero", pctV: 12, fontPctV: 9, weight: 800, tracking: -0.02, uppercase: true };
const Z2 = (pctV: number, fontPctV: number): ZoneSpec => ({
  code: "Z2", label: "division", pctV, fontPctV, weight: 700, tracking: 0, uppercase: true,
});
const Z4 = (pctV: number, fontPctV: number): ZoneSpec => ({
  code: "Z4", label: "eligibility", pctV, fontPctV, weight: 400,
});
const Z5 = (pctV: number, fontPctV: number): ZoneSpec => ({
  code: "Z5", label: "recruiter-contact", pctV, fontPctV, weight: 700,
});
const Z10 = (pctV: number, fontPctV: number): ZoneSpec => ({
  code: "Z10", label: "interview", pctV, fontPctV, weight: 700,
});

export const LAYOUTS: LayoutSpec[] = [
  {
    code: "DTP-1",
    name: "Minimum display — 4 × 5 cm",
    surface: "print",
    widthPx: 472,
    heightPx: 591,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 1,
    capacity: 7,
    capacityNote: "fixed 2.40cm / row_pitch 0.32cm → 7 rows × 1 col = 7",
    hasInterview: false,
    qrPctV: 18,
    zones: [
      Z1,
      Z2(7, 3.6),
      Z4(5, 2.4),
      Z5(6, 2.8),
    ],
  },
  {
    code: "DTP-2",
    name: "Standard medium — 10 × 10 cm",
    surface: "print",
    widthPx: 1181,
    heightPx: 1181,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 2,
    capacity: 26,
    capacityNote: "realistic figure per §8, derated from 32 raw slots for word-wrap",
    hasInterview: true,
    qrPctV: 12,
    zones: [
      Z1,
      Z2(4.2, 3.4),
      Z4(3.5, 2.2),
      Z5(3.4, 2.6),
      Z10(6.4, 3.2),
    ],
  },
  {
    code: "DTP-3",
    name: "Quarter page — 12 × 20 cm",
    surface: "print",
    widthPx: 1417,
    heightPx: 2362,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 2,
    capacity: 50,
    capacityNote: "realistic figure per §8, derated from 78 raw slots for word-wrap",
    hasInterview: true,
    qrPctV: 8,
    zones: [
      Z1,
      Z2(2.4, 2.8),
      Z4(2.75, 2.0),
      Z5(2.0, 2.2),
      Z10(2.75, 2.8),
    ],
  },
  {
    code: "DTP-4",
    name: "Half page, horizontal — 25 × 16 cm",
    surface: "print",
    widthPx: 2953,
    heightPx: 1890,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 5,
    capacity: 145,
    capacityNote: "5 internal cols (echoes AAT's own 4.576cm page-column pitch) × 29 rows",
    hasInterview: true,
    qrPctV: 11,
    zones: [
      Z1,
      Z2(3.0, 2.8),
      Z4(3.4, 2.0),
      Z5(2.5, 2.2),
      Z10(3.4, 2.6),
    ],
  },
  {
    code: "DG-1",
    name: "Feed square — 1080 × 1080",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1080,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 2,
    capacity: 16,
    capacityNote: "8 rows × 2 cols, per §8 two-column figure",
    hasInterview: true,
    qrPctV: 14,
    zones: [
      Z1,
      Z2(3.7, 2.6),
      Z4(2.6, 1.8),
      Z5(2.6, 2.0),
      Z10(3.0, 2.4),
    ],
  },
  {
    code: "DG-2",
    name: "Portrait — the workhorse — 1080 × 1350",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1350,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 2,
    capacity: 26,
    capacityNote: "13 rows × 2 cols, per §8 two-column figure",
    hasInterview: true,
    qrPctV: 9,
    zones: [
      Z1,
      Z2(3.0, 2.2),
      Z4(2.1, 1.5),
      Z5(2.1, 1.6),
      Z10(2.4, 1.9),
    ],
  },
  {
    code: "DG-3",
    name: "Story — 1080 × 1920 (asymmetric safe area)",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1920,
    safeMarginPctW: 3,
    safeMarginPctTopV: 12,
    safeMarginPctBottomV: 14,
    columns: 1,
    capacity: 16,
    capacityNote: "max-density pitch (32px): 512px Z3 / 32px = 16 rows, 1 col",
    hasInterview: true,
    qrPctV: 7,
    zones: [
      Z1,
      Z2(2.3, 1.6),
      Z4(1.6, 1.1),
      Z5(1.6, 1.2),
      Z10(1.8, 1.4),
    ],
  },
  {
    code: "DG-5",
    name: "LinkedIn / web banner — 1200 × 628 (unit keyed to height)",
    surface: "digital",
    widthPx: 1200,
    heightPx: 628,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 2,
    capacity: 32,
    capacityNote: "landscape split: left region Z3=515px / 32px pitch = 16 rows × 2 cols",
    hasInterview: false,
    qrPctV: 28,
    layoutMode: "split",
    zones: [{ ...Z1, pctV: 12, fontPctV: 8 }],
  },
  {
    code: "DG-6",
    name: "Mega-listing — 1600 × 900 (numbered category groups)",
    surface: "digital",
    widthPx: 1600,
    heightPx: 900,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 7,
    capacity: 70,
    capacityNote:
      "5 independent group grids, 7 cols each, 10 total rows across all groups " +
      "(2+2+2+2+2) — reduced from the height-only 11-row/88-cap arithmetic on two counts: " +
      "the 'CATEGORY 88' label wraps to a second line at 8 columns' width (7 cols is the " +
      "real fit), and one row's worth of height was traded back for a bigger QR (16%V vs " +
      "9%V) once the 0.5×-scale phone-camera decode check kept failing at the smaller size " +
      "— so capacity is 5 × (2×7) = 70, not 88",
    hasInterview: true,
    qrPctV: 16,
    groups: [
      ["GROUP 1", 14],
      ["GROUP 2", 14],
      ["GROUP 3", 14],
      ["GROUP 4", 14],
      ["GROUP 5", 14],
    ],
    zones: [
      Z1,
      Z2(4.4, 2.2),
      Z5(3.9, 1.8),
      Z10(4.4, 2.0),
    ],
  },
];

/**
 * DG-4 — carousel, one job per frame. Not a single LayoutSpec: the zone
 * model is divided ACROSS four frames (stop / self-identify / qualify /
 * act), so each frame gets its own reduced zone set on the same canvas.
 */
export const DG4_FRAMES: LayoutSpec[] = [
  {
    code: "DG-4 · Frame 1",
    name: "STOP",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1350,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 1,
    capacity: 0,
    capacityNote: "hook only — no category block in this frame",
    hasInterview: false,
    qrPctV: 0,
    zones: [{ ...Z1, pctV: 30, fontPctV: 11 }, Z2(4, 2.6)],
  },
  {
    code: "DG-4 · Frame 2",
    name: "SELF-IDENTIFY",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1350,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 2,
    capacity: 74,
    capacityNote: "this frame carries the full listing: 37 rows × 2 cols = 74",
    hasInterview: false,
    qrPctV: 0,
    zones: [Z2(3, 2.2)],
  },
  {
    code: "DG-4 · Frame 3",
    name: "QUALIFY",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1350,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 1,
    capacity: 0,
    capacityNote: "eligibility detail, not category-capacity-bound",
    hasInterview: false,
    qrPctV: 0,
    zones: [{ ...Z1, pctV: 14, fontPctV: 5 }, Z4(10, 3.0)],
  },
  {
    code: "DG-4 · Frame 4",
    name: "ACT",
    surface: "digital",
    widthPx: 1080,
    heightPx: 1350,
    safeMarginPctW: 3,
    safeMarginPctTopV: 3,
    safeMarginPctBottomV: 3,
    columns: 1,
    capacity: 0,
    capacityNote: "trust/response stack, generously spaced",
    hasInterview: true,
    qrPctV: 22,
    zones: [{ ...Z1, pctV: 14, fontPctV: 5 }, Z5(4, 3.0), Z10(4, 3.2)],
  },
];

/** DTP-2/DTP-3 §9 alternates — padded to whole AAT page-columns. Flagged, not resolved. */
export const SECTION_9_ALTERNATES = {
  "DTP-2": { widthCm: 8.78, widthPx: 1037, columns: 2, note: "2 page-columns: 2×4.20 + 1×0.38" },
  "DTP-3": { widthCm: 13.36, widthPx: 1578, columns: 3, note: "3 page-columns: 3×4.20 + 2×0.38" },
};

// Canvas cm, for the print layouts only — the type floor is physical
// (7pt at the render's own dpi), not a fraction of canvas.
export const PRINT_CM: Record<string, number> = {
  "DTP-1": 4,
  "DTP-2": 10,
  "DTP-3": 12,
  "DTP-4": 25,
};

const DIGITAL_FLOOR_PX = 22;
const PRINT_FLOOR_PT = 7;

export function printFloorPx(widthPx: number, widthCm: number): number {
  const dpi = widthPx / (widthCm / 2.54);
  return (PRINT_FLOOR_PT / 72) * dpi;
}

/**
 * Placeholder copy for each zone role, defined ONCE and shared between
 * measurement and rendering. Measuring one string and drawing another is
 * exactly the class of bug that produces a clean-looking layout with a
 * silently overflowing hero — the string used to compute a font-size has
 * to be the string that ends up on the canvas.
 */
export const ZONE_CONTENT: Record<string, string> = {
  Z1: "DESTINATION / INDUSTRY",
  Z2: "SCOPE — SHUTDOWN / MAINTENANCE DIVISION",
  Z4: "EXPERIENCE 5+ YEARS · MANDATORY CERTIFICATION",
  Z5: "PROJECT RECRUITER · +91 00000 00000",
  Z10: "INTERVIEW · DATE · CITY · VENUE",
};

/** Advance-width estimate for bold uppercase Liberation Sans — the same class of measurement the rest of this codebase's SVG renderer uses. */
function estWidthPx(text: string, fontPx: number): number {
  return text.length * fontPx * 0.62;
}

/**
 * Fits a zone's font-size to BOTH its height allowance (pctV of canvas)
 * and its actual available width — a flat %V coefficient sizes correctly
 * for one aspect ratio and overflows on another, which is exactly what a
 * height-only rule produces on a narrow-tall canvas (DG-3) or a
 * wide-shallow one (DTP-4). Never assumed; always checked against the
 * real placeholder string.
 */
export function deriveZoneFontPx(spec: LayoutSpec, zone: ZoneSpec): number {
  if (zone.pctV === undefined) return (zone.fontPctV / 100) * spec.heightPx;
  const heightFontPx = (zone.fontPctV / 100) * spec.heightPx;
  // In split mode Z1 has only the left region's width to fit, not the
  // full safe width — the right region belongs to the footer.
  const regionFactor = spec.layoutMode === "split" ? 0.65 : 1;
  const safeWidthPx = spec.widthPx * (1 - (2 * spec.safeMarginPctW) / 100) * regionFactor;
  const text = ZONE_CONTENT[zone.code] ?? "";
  if (!text) return heightFontPx;
  // estWidthPx(text, 1) is the string's width at 1px font-size; solving
  // estWidthPx(text, font) == safeWidthPx for font gives the width cap.
  const widthFontPx = safeWidthPx / estWidthPx(text, 1);
  return Math.min(heightFontPx, widthFontPx);
}

export interface CategoryMetrics {
  /** px — category label font-size, computed from the layout's own geometry, never assumed. */
  fontPx: number;
  /** px — the physical/pixel row pitch this font-size produces. */
  rowPitchPx: number;
  /** px — vertical padding inside each row, splitting rowPitch − lineHeight. */
  rowPaddingPx: number;
  floorPx: number;
  /** True only if the computed font clears the floor — a template bug, not a spec bug, if false. */
  clearsFloor: boolean;
}

/**
 * Derives the category row's font-size FROM the layout's own zone budget,
 * instead of a flat CSS coefficient guessed to "look about right." A flat
 * coefficient is exactly the bug the audit caught on the first pass: the
 * same %V number produces a legible row on a 2362px-tall canvas and an
 * illegible one on a 591px canvas, because %V scales with the canvas, not
 * with the absolute floor the canvas has to clear.
 */
export function deriveCategoryMetrics(spec: LayoutSpec): CategoryMetrics {
  const safeHeightPx =
    spec.heightPx * (1 - (spec.safeMarginPctTopV + spec.safeMarginPctBottomV) / 100);
  const fixedZonesPx = spec.zones.reduce(
    (sum, z) => sum + (z.pctV ? (z.pctV / 100) * spec.heightPx : 0),
    0,
  );
  // In split mode the footer lives beside the category block, not below
  // it — it must not be subtracted from the same vertical budget.
  const footerPx =
    spec.layoutMode !== "split" && spec.qrPctV > 0
      ? (spec.qrPctV / 100) * spec.heightPx + 0.02 * spec.heightPx
      : 0;
  const groupHeaderPx = spec.groups ? spec.groups.length * 0.03 * spec.heightPx : 0;
  // A small reserve for inter-zone gaps and rounding — the layout is
  // planned to this, not stretched to fill every last pixel.
  const gapReservePx = 0.01 * spec.heightPx;
  const z3HeightPx = Math.max(
    1,
    safeHeightPx - fixedZonesPx - footerPx - groupHeaderPx - gapReservePx,
  );

  // A grouped layout (DG-6) renders each group as its OWN independent
  // column distribution (groupedCategoryBlock), not one shared grid — so
  // the real row count is the sum of each group's own ceil(count/cols),
  // which is never equal to ceil(totalCapacity/cols) unless every group
  // happens to divide evenly. Sizing the shared row pitch off the wrong
  // (smaller) row count is what let every group's actual content run
  // taller than its budgeted share on the first pass.
  const rows = spec.groups
    ? spec.groups.reduce((sum, [, count]) => sum + (Math.ceil(count / spec.columns) || 1), 0)
    : Math.ceil(spec.capacity / spec.columns) || 1;
  const rowPitchPx = z3HeightPx / rows;

  const floorPx =
    spec.surface === "print"
      ? printFloorPx(spec.widthPx, PRINT_CM[spec.code.split(" ")[0]] ?? 10)
      : DIGITAL_FLOOR_PX;

  // Digital pitch = 1.45 × font-size (given). Print: the row holds a
  // floor-size (or larger) glyph plus leading/padding filling the rest
  // of the measured 0.32cm-equivalent pitch.
  const heightFontPx =
    spec.surface === "digital" ? rowPitchPx / 1.45 : Math.min(rowPitchPx / 1.25, rowPitchPx - 4);

  // The row pitch only fixes the VERTICAL fit. A category label also has
  // to fit its own column's width at that font-size, or the browser wraps
  // it to a second line and blows straight through the fixed row height —
  // this is exactly what an 8-column grid on DG-6 did with an
  // 11-character "CATEGORY 88" label: the height math cleared the floor
  // fine, the width never did. Capped the same way deriveZoneFontPx caps
  // zone text, against the real column geometry the template renders.
  const safeWidthPx = spec.widthPx * (1 - (2 * spec.safeMarginPctW) / 100);
  const colGapPx = 0.015 * spec.widthPx; // matches .cat-grid column-gap: calc(1.5 * var(--u))
  const colWidthPx = (safeWidthPx - (spec.columns - 1) * colGapPx) / spec.columns;
  const rowGapPx = 0.004 * spec.widthPx; // matches .cat-row gap: calc(0.4 * var(--u))
  const CAT_MARK = "▸";
  const CAT_LABEL_SAMPLE = "CATEGORY 88"; // longest placeholder the template actually renders
  const perFontWidthPx = estWidthPx(CAT_MARK, 1) + estWidthPx(CAT_LABEL_SAMPLE, 1);
  const availLabelWidthPx = colWidthPx - rowGapPx;
  const widthFontPx = availLabelWidthPx > 0 ? availLabelWidthPx / perFontWidthPx : 0;

  const fontPx = Math.min(heightFontPx, widthFontPx);

  return {
    fontPx: Math.max(fontPx, 1),
    rowPitchPx,
    rowPaddingPx: Math.max(0, (rowPitchPx - fontPx * 1.15) / 2),
    floorPx,
    clearsFloor: fontPx >= floorPx - 0.5,
  };
}
