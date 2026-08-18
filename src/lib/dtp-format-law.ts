/**
 * DTP / Print Format Law (LOCKED, 2026-08).
 *
 * DTP is governed by physical publication slots, not by the 1080px
 * Social rule (see socialFeedMaxHeightPx in platform-formats.ts, which
 * this module has nothing to do with — the two format families are
 * kept structurally separate on purpose).
 *
 * Assignments Abroad Times appointment-ad column widths — the only
 * approved physical slots a DTP render may target:
 */
export interface DtpColumnSlot {
  columns: 2 | 4 | 6 | 8 | 10;
  widthCm: number;
}

export const DTP_APPROVED_COLUMN_SLOTS: DtpColumnSlot[] = [
  { columns: 2, widthCm: 6.0 },
  { columns: 4, widthCm: 12.7 },
  { columns: 6, widthCm: 19.4 },
  { columns: 8, widthCm: 26.1 },
  { columns: 10, widthCm: 32.8 },
];

/** Standard newsprint reproduction quality — the default when a print request doesn't specify its own DPI. */
export const DTP_DEFAULT_DPI = 300;

const CM_PER_INCH = 2.54;

export function cmToPx(cm: number, dpi: number = DTP_DEFAULT_DPI): number {
  return Math.round((cm / CM_PER_INCH) * dpi);
}

export function pxToCm(px: number, dpi: number = DTP_DEFAULT_DPI): number {
  return (px / dpi) * CM_PER_INCH;
}

/**
 * Whether widthPx, at the given DPI, matches one of the five approved
 * column slots within a small physical tolerance (rounding a cm width to
 * whole pixels at typical print DPI is never bit-exact — 0.05cm, about
 * half a millimetre, is well inside any real print-shop's own tolerance
 * and far too small to ever be mistaken for a different slot).
 */
export function isApprovedDtpWidthPx(widthPx: number, dpi: number = DTP_DEFAULT_DPI): boolean {
  const toleranceCm = 0.05;
  return DTP_APPROVED_COLUMN_SLOTS.some((slot) => Math.abs(pxToCm(widthPx, dpi) - slot.widthCm) <= toleranceCm);
}

/** The nearest approved slot to widthPx — for a helpful capacity/rejection message, never used to silently substitute a different width. */
export function nearestApprovedDtpSlot(widthPx: number, dpi: number = DTP_DEFAULT_DPI): DtpColumnSlot {
  const targetCm = pxToCm(widthPx, dpi);
  return DTP_APPROVED_COLUMN_SLOTS.reduce((closest, slot) =>
    Math.abs(slot.widthCm - targetCm) < Math.abs(closest.widthCm - targetCm) ? slot : closest,
  );
}
