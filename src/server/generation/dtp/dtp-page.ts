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
import { cmToPx, DTP_DEFAULT_DPI } from "@/lib/dtp-format-law";

/**
 * The page in PHYSICAL units, because a classified page is sold in
 * centimetres, not pixels.
 *
 * These are not arbitrary: DTP_APPROVED_COLUMN_SLOTS (the locked format
 * law) prices Assignments Abroad Times appointment advertisements at
 * 2/4/6/8/10 columns = 6.0/12.7/19.4/26.1/32.8cm, so the smallest
 * saleable advertisement is 6.0cm wide, and the minimum booking is
 * 6 x 8cm. The widest slot, 32.8cm, IS the page's live area.
 *
 * Five grid columns of exactly the 6.0cm minimum, separated by 0.7cm
 * gutters, span 5(6.0) + 4(0.7) = 32.8cm — the full live width, exactly.
 * The five-column grid and the format law are therefore the same
 * geometry, not two competing ones, and one grid column is precisely
 * one minimum-size advertisement.
 */
export const DTP_PAGE_CM = {
  /** Live area = the law's widest approved slot. */
  liveWidthCm: 32.8,
  /**
   * Broadsheet depth.
   *
   * 53cm rather than a round 50: the column must divide into whole
   * minimum bookings, because a remainder smaller than 8cm can never be
   * sold and simply prints as a band of white at the foot of every
   * column. At 53cm the live column takes six 8cm advertisements with
   * little left over; at 50cm it took five and stranded 7.2cm.
   */
  liveHeightCm: 53.0,
  marginCm: 1.0,
  /** One grid column = the minimum saleable advertisement width. */
  columnCm: 6.0,
  gutterCm: 0.7,
  columns: 5,
} as const;

/** Minimum saleable advertisement: 6cm x 8cm. Below this is unpublishable. */
export const DTP_MIN_AD_WIDTH_CM = 6.0;
export const DTP_MIN_AD_HEIGHT_CM = 8.0;

/** Resolves the physical page to pixels at a given reproduction DPI. */
export function dtpPageAt(dpi: number = DTP_DEFAULT_DPI) {
  const px = (cm: number) => cmToPx(cm, dpi);
  const marginPx = px(DTP_PAGE_CM.marginCm);
  const gutterPx = px(DTP_PAGE_CM.gutterCm);
  const columnPx = px(DTP_PAGE_CM.columnCm);

  // The page is exactly as wide as the grid it carries.
  //
  // Deriving it from liveWidthCm instead would round each centimetre
  // value independently, and those roundings do not have to agree: at
  // 300dpi the five 6.0cm columns plus four 0.7cm gutters plus two 1.0cm
  // margins come to 4113px while 34.8cm rounds to 4110 — a three-pixel
  // shortfall that puts the last column across the right margin. Summing
  // the parts that are actually drawn makes that impossible by
  // construction.
  const widthPx = marginPx * 2 + columnPx * DTP_PAGE_CM.columns + gutterPx * (DTP_PAGE_CM.columns - 1);

  return {
    dpi,
    widthPx,
    heightPx: px(DTP_PAGE_CM.liveHeightCm + DTP_PAGE_CM.marginCm * 2),
    marginPx,
    gutterPx,
    columns: DTP_PAGE_CM.columns,
    columnPx,
    minAdHeightPx: px(DTP_MIN_AD_HEIGHT_CM),
  };
}

/**
 * Default page: newsprint reproduction DPI, the same default the format
 * law uses.
 */
export const DTP_PAGE = dtpPageAt(DTP_DEFAULT_DPI);

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

/**
 * The grid column width.
 *
 * Taken from the format law (6.0cm), never derived by dividing whatever
 * width the page happens to be — a column computed that way can silently
 * fall below the minimum saleable slot, which is exactly the defect this
 * geometry replaced.
 */
export function dtpColumnWidth(page: typeof DTP_PAGE = DTP_PAGE): number {
  return page.columnPx;
}

function mastheadHeight(page: typeof DTP_PAGE): number {
  // Compact by intent (spec §19): the grid starts immediately below.
  return cmToPx(2.2, page.dpi);
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

  // Every block is at least the minimum saleable slot (6cm x 8cm).
  const measurements = input.advertisements.map((ad) =>
    measureDtpBlock(ad, colW, page.minAdHeightPx),
  );
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

  // Running total of what is still to be placed, so balancing can tell
  // whether moving on would strand copy that still has room on the page.
  let remainingStack = totalStack;

  measurements.forEach((measured, index) => {
    remainingStack -= measured.heightPx + gap;

    while (column < page.columns && inColumn > 0) {
      const cannotFit = cursorY + measured.heightPx > bottom;
      const tookItsShare = cursorY - top >= target;

      // Balancing is a preference, never a reason to push copy off a
      // page that still has depth for it. Moving on is only allowed if
      // the columns that remain can still absorb everything left; the
      // physical fit check is absolute and always wins.
      const columnsAfterThis = page.columns - column - 1;
      const capacityAfterThis = columnsAfterThis * columnDepth;
      const balancingIsSafe = tookItsShare && remainingStack <= capacityAfterThis;

      if (!cannotFit && !balancingIsSafe) break;
      if (cannotFit && columnsAfterThis === 0) break;

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
      measured = measureDtpBlock(ad, colW, page.minAdHeightPx);
      measurements.set(placement.index, measured);
    }
    parts.push(renderDtpBlock(ad, placement.x, placement.y, colW, measured));
  }

  parts.push("</svg>");
  return { svg: parts.join(""), layout };
}
