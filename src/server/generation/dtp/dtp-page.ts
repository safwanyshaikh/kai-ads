/**
 * DTP NEWSPAPER PAGE COMPOSITOR — five-column classified page.
 *
 * A print compositor, not a responsive grid: a fixed page canvas, a
 * fixed column count, and deterministic placement. The same input
 * always produces the same page, because the geometry is arithmetic —
 * no model decides where an advertisement sits (spec §18).
 *
 * Packing follows reading order, the way a compositor fills a page:
 * column one top to bottom, then column two, and so on. An
 * advertisement that will not fit the remaining depth of its column
 * starts the next column rather than being split or squeezed.
 *
 * Advertisements that do not fit the page are REPORTED, never dropped
 * silently and never clipped — a classified page that quietly loses an
 * advertiser's paid block is worse than one that says it is full.
 */
import {
  measureDtpBlock,
  renderDtpBlock,
  DTP_INK,
  DTP_PAPER,
  type DtpAdvertisement,
  type DtpBlockMeasurement,
} from "./dtp-ad-block";
import { DTP_TYPE, dtpFamily, dtpSize } from "./dtp-typography";

/** A4 at 300dpi, portrait — a real print page, deterministic. */
export const DTP_PAGE = {
  widthPx: 2480,
  heightPx: 3508,
  marginPx: 60,
  gutterPx: 24,
  columns: 5,
} as const;

export interface DtpMasthead {
  /** Publication title, e.g. the classified section's name. */
  title: string;
  /** Date / edition line. */
  edition?: string | null;
  /** Page number or section marker. */
  pageLabel?: string | null;
}

export interface DtpPageInput {
  masthead: DtpMasthead;
  advertisements: DtpAdvertisement[];
  /** Overrides for testing alternate geometry; defaults to DTP_PAGE. */
  page?: Partial<typeof DTP_PAGE>;
}

export interface DtpPlacement {
  index: number;
  column: number;
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
}

export interface DtpPageLayout {
  widthPx: number;
  heightPx: number;
  columnWidthPx: number;
  columnCount: number;
  mastheadHeightPx: number;
  placements: DtpPlacement[];
  /** Indexes of advertisements the page had no room for. */
  unplaced: number[];
}

/** Vertical gap between stacked advertisements — deliberate, and small. */
const BLOCK_GAP_RATIO = 0.014;

export function dtpColumnWidth(page = DTP_PAGE): number {
  const usable = page.widthPx - page.marginPx * 2 - page.gutterPx * (page.columns - 1);
  return Math.floor(usable / page.columns);
}

function mastheadHeight(page: typeof DTP_PAGE): number {
  // Compact by intent (spec §19): the grid starts immediately below.
  return Math.round(page.widthPx * 0.052);
}

/**
 * Deterministic layout. Measures every advertisement, then packs it
 * column by column in reading order, BALANCED across the page.
 *
 * Balancing matters as much as fitting. Filling each column to its
 * physical depth before starting the next is what a naive packer does,
 * and on a page whose advertisements do not happen to total five full
 * columns it produces one dense column beside four empty ones — the
 * dead space this renderer exists to avoid, just relocated. A
 * compositor instead spreads the copy it has over the columns it has.
 *
 * So each column takes content up to a target share of the total stack
 * height, and only overflows to the next column when the block would
 * genuinely not fit the page depth. A column always accepts at least
 * one advertisement, so an unusually tall block can never strand a
 * column empty. This stays arithmetic — same input, same page.
 */
export function layoutDtpPage(input: DtpPageInput): DtpPageLayout {
  const page = { ...DTP_PAGE, ...(input.page ?? {}) };
  const colW = dtpColumnWidth(page);
  const gap = Math.round(colW * BLOCK_GAP_RATIO);
  const mastH = mastheadHeight(page);
  const top = page.marginPx + mastH + Math.round(colW * 0.03);
  const bottom = page.heightPx - page.marginPx;
  const columnDepth = bottom - top;

  const measurements = input.advertisements.map((ad) => measureDtpBlock(ad, colW));
  const totalStack = measurements.reduce((sum, m) => sum + m.heightPx + gap, 0);

  // The share each column should carry, bounded by the page depth. When
  // there is more copy than the page holds, the target IS the depth and
  // balancing degrades gracefully into straight fill.
  const target = Math.min(columnDepth, Math.ceil(totalStack / page.columns));

  const placements: DtpPlacement[] = [];
  const unplaced: number[] = [];

  let column = 0;
  let cursorY = top;
  let inColumn = 0;

  measurements.forEach((measured, index) => {
    // Move on when this column has taken its share, or genuinely cannot
    // hold the block. Never leave a column empty to do it.
    while (
      column < page.columns &&
      inColumn > 0 &&
      (cursorY + measured.heightPx > bottom || cursorY - top >= target)
    ) {
      column += 1;
      cursorY = top;
      inColumn = 0;
    }

    // A single block taller than the page cannot be placed anywhere.
    if (column >= page.columns || cursorY + measured.heightPx > bottom) {
      if (column >= page.columns) {
        unplaced.push(index);
        return;
      }
      unplaced.push(index);
      return;
    }

    placements.push({
      index,
      column,
      x: page.marginPx + column * (colW + page.gutterPx),
      y: cursorY,
      widthPx: colW,
      heightPx: measured.heightPx,
    });

    cursorY += measured.heightPx + gap;
    inColumn += 1;
  });

  return {
    widthPx: page.widthPx,
    heightPx: page.heightPx,
    columnWidthPx: colW,
    columnCount: page.columns,
    mastheadHeightPx: mastH,
    placements,
    unplaced,
  };
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderMasthead(m: DtpMasthead, page: typeof DTP_PAGE, colW: number, h: number): string {
  const parts: string[] = [];
  const x = page.marginPx;
  const right = page.widthPx - page.marginPx;
  const titleSize = Math.round(h * 0.52);
  const metaSize = Math.round(h * 0.15);

  // Edition line above the title, then heavy rules under it — the
  // classified page's own furniture, kept to the height it needs.
  if (m.edition) {
    parts.push(
      `<text x="${right}" y="${page.marginPx + metaSize}" font-family="${dtpFamily("DTP_LABEL")}" ` +
        `font-size="${metaSize}" font-weight="600" text-anchor="end" fill="${DTP_INK}">${esc(m.edition.toUpperCase())}</text>`,
    );
  }
  parts.push(
    `<text x="${x}" y="${page.marginPx + Math.round(h * 0.74)}" font-family="${dtpFamily("DTP_HEADLINE")}" ` +
      `font-size="${titleSize}" font-weight="800" letter-spacing="-1" fill="${DTP_INK}">${esc(m.title.toUpperCase())}</text>`,
  );
  if (m.pageLabel) {
    parts.push(
      `<text x="${right}" y="${page.marginPx + Math.round(h * 0.74)}" font-family="${dtpFamily("DTP_HEADLINE")}" ` +
        `font-size="${Math.round(titleSize * 0.5)}" font-weight="800" text-anchor="end" fill="${DTP_INK}">${esc(m.pageLabel)}</text>`,
    );
  }
  const ruleY = page.marginPx + h - Math.round(colW * 0.02);
  parts.push(`<rect x="${x}" y="${ruleY}" width="${right - x}" height="5" fill="${DTP_INK}"/>`);
  parts.push(`<rect x="${x}" y="${ruleY + 9}" width="${right - x}" height="2" fill="${DTP_INK}"/>`);
  void DTP_TYPE;
  void dtpSize;
  return parts.join("");
}

/** The composed page as SVG. */
export function renderDtpPageSvg(input: DtpPageInput): { svg: string; layout: DtpPageLayout } {
  const page = { ...DTP_PAGE, ...(input.page ?? {}) };
  const layout = layoutDtpPage(input);
  const colW = layout.columnWidthPx;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.widthPx}" height="${page.heightPx}">`,
    `<rect width="${page.widthPx}" height="${page.heightPx}" fill="${DTP_PAPER}"/>`,
    renderMasthead(input.masthead, page, colW, layout.mastheadHeightPx),
  ];

  // Column rules, the vertical hairlines between classified columns.
  for (let c = 1; c < page.columns; c++) {
    const rx = page.marginPx + c * (colW + page.gutterPx) - Math.round(page.gutterPx / 2);
    parts.push(
      `<rect x="${rx}" y="${page.marginPx + layout.mastheadHeightPx + Math.round(colW * 0.02)}" width="1" ` +
        `height="${page.heightPx - page.marginPx - layout.mastheadHeightPx - Math.round(colW * 0.02) - page.marginPx}" ` +
        `fill="${DTP_INK}" opacity="0.28"/>`,
    );
  }

  const measurements = new Map<number, DtpBlockMeasurement>();
  for (const placement of layout.placements) {
    const ad = input.advertisements[placement.index];
    let measured = measurements.get(placement.index);
    if (!measured) {
      measured = measureDtpBlock(ad, colW);
      measurements.set(placement.index, measured);
    }
    parts.push(renderDtpBlock(ad, placement.x, placement.y, colW, measured));
  }

  parts.push("</svg>");
  return { svg: parts.join(""), layout };
}
