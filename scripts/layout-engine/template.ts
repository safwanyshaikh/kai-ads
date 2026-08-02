import QRCode from "qrcode";
import { deriveCategoryMetrics, deriveZoneFontPx, ZONE_CONTENT, type LayoutSpec } from "./layouts";

/**
 * Builds a self-contained HTML document for one layout, per §5:
 * proportional --u/--v units keyed to the constraining dimension (height,
 * per the doc's own rule), QR generated as inline SVG with a viewBox,
 * every text line its own block child (never a bare <span> in a
 * column-flex band), and every fixed-height band carrying
 * `min-height:0; flex:0 0 auto`.
 *
 * Content is placeholder throughout — generic category numbers, a generic
 * agency mark, a demo verification URL. This is a layout demo, not a
 * client advertisement.
 */

const INK = "#0B1F33";
const PAPER = "#FFFFFF";
const ACCENT = "#1A6B4A"; // validation green, per the black+gold fraud-signal warning
const MUTED = "#5A6B7A";
const RULE = "#D8DEE4";

async function qrSvg(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, {
    type: "svg",
    margin: 4, // the mandatory quiet zone
    color: { dark: INK, light: PAPER },
  });
  // qrcode's SVG output already carries a viewBox — asserted, not assumed,
  // because §5 names a viewBox-less QR as a real, specific failure mode.
  if (!/viewBox=/.test(svg)) throw new Error("Generated QR SVG has no viewBox — bug class 3.");
  return svg;
}

interface RowMetrics {
  fontPx: number;
  rowPitchPx: number;
  rowPaddingPx: number;
}

function categoryRows(count: number, startAt: number, m: RowMetrics): string {
  const rows: string[] = [];
  const rowStyle =
    `height:${m.rowPitchPx.toFixed(2)}px;padding-block:${m.rowPaddingPx.toFixed(2)}px;` +
    `font-size:${m.fontPx.toFixed(2)}px;`;
  for (let i = 0; i < count; i++) {
    const n = String(startAt + i).padStart(2, "0");
    rows.push(
      `<div class="cat-row" data-audit="text" style="${rowStyle}"><span class="cat-mark">▸</span><span class="cat-label">CATEGORY ${n}</span></div>`,
    );
  }
  return rows.join("");
}

function categoryColumns(count: number, columns: number, m: RowMetrics): string {
  const perCol = Math.ceil(count / columns);
  const cols: string[] = [];
  let remaining = count;
  let start = 1;
  for (let c = 0; c < columns; c++) {
    const take = Math.min(perCol, remaining);
    cols.push(`<div class="cat-col">${categoryRows(take, start, m)}</div>`);
    start += take;
    remaining -= take;
  }
  return `<div class="cat-grid" style="--cols:${columns}" data-audit="board">${cols.join("")}</div>`;
}

function groupedCategoryBlock(groups: [string, number][], columns: number, m: RowMetrics): string {
  let start = 1;
  const blocks = groups.map(([label, count]) => {
    const html = `<div class="cat-group"><div class="cat-group-head" data-audit="text">${label}</div>${categoryColumns(count, columns, m)}</div>`;
    start += count;
    return html;
  });
  return `<div class="cat-group-wrap">${blocks.join("")}</div>`;
}

export interface RenderOptions {
  /** Override the QR side (%V) — used when a layout floats the QR beside text. */
  qrPctV?: number;
}

export async function buildLayoutHtml(spec: LayoutSpec): Promise<string> {
  const qr = await qrSvg(`https://verify.kai.example/demo/${spec.code}`);

  const zoneCss = spec.zones
    .filter((z) => z.pctV !== undefined)
    .map((z) => {
      // Font-size is fitted to BOTH height and width (deriveZoneFontPx),
      // not assumed from a flat %V coefficient — a coefficient tuned for
      // one aspect ratio overflows on another, which is exactly what
      // produced the DG-3 hero spill and the DTP-3 division-line spill
      // on the first pass.
      const fontPx = deriveZoneFontPx(spec, z);
      return `
    .z-${z.code.toLowerCase()} {
      height: calc(${z.pctV} * var(--v));
      font-size: ${fontPx.toFixed(2)}px;
      font-weight: ${z.weight};
      letter-spacing: ${z.tracking ?? 0}em;
      ${z.uppercase ? "text-transform: uppercase;" : ""}
    }`;
    })
    .join("\n");

  const zoneHtml = spec.zones
    .map((z) => {
      const content = ZONE_CONTENT[z.code] ?? "";
      return `<div class="zone z-${z.code.toLowerCase()}" data-audit="text" data-zone="${z.code}">${content}</div>`;
    })
    .join("\n");

  const rowMetrics = deriveCategoryMetrics(spec);
  if (!rowMetrics.clearsFloor) {
    throw new Error(
      `${spec.code}: derived category font ${rowMetrics.fontPx.toFixed(1)}px is below the ` +
        `${rowMetrics.floorPx.toFixed(1)}px floor — the zone budget in layouts.ts needs revising, not the template.`,
    );
  }
  const categoryBlock = spec.groups
    ? groupedCategoryBlock(spec.groups, spec.columns, rowMetrics)
    : categoryColumns(spec.capacity, spec.columns, rowMetrics);

  const isSplit = spec.layoutMode === "split";
  // Split mode's QR is sized off the RIGHT region's own width (it is the
  // dominant element there), not off canvas height the way a stacked
  // footer's QR is — a wide-short board's right region is a portrait
  // rectangle even though the board itself is landscape.
  const qrSizePx = isSplit ? spec.widthPx * 0.3 : undefined;

  const footer = spec.qrPctV
    ? isSplit
      ? `
    <div class="split-right" data-audit="board">
      <div class="qr" style="width:${qrSizePx?.toFixed(0)}px; height:${qrSizePx?.toFixed(0)}px;" data-audit="qr">${qr}</div>
      <div class="footer-text footer-text--split" data-audit="text">
        <div class="agency-mark">[ LOGO ]</div>
        <div class="agency-address">Registered Address · City</div>
        <div class="licence" data-zone="Z8">LICENCE NO. XX-0000/CITY/PART/0000/0000</div>
      </div>
    </div>`
      : `
    <div class="footer" data-audit="board">
      <div class="footer-text" data-audit="text">
        <div class="agency-mark">[ LOGO ]</div>
        <div class="agency-address">Registered Address · City</div>
        <div class="licence" data-zone="Z8">LICENCE NO. XX-0000/CITY/PART/0000/0000</div>
      </div>
      <div class="qr" style="width:calc(${spec.qrPctV} * var(--v)); height:calc(${spec.qrPctV} * var(--v));" data-audit="qr">${qr}</div>
    </div>`
    : "";

  const safeInner = isSplit
    ? `<div class="split-row" data-audit="board">
         <div class="split-left">${zoneHtml}${categoryBlock}</div>
         ${footer}
       </div>`
    : `${zoneHtml}${categoryBlock}${footer}`;

  const printClass = spec.surface === "print" ? "surface-print" : "surface-digital";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${spec.widthPx}px; height: ${spec.heightPx}px; overflow: hidden; }
  body { font-family: "Liberation Sans", Arial, sans-serif; background: ${PAPER}; color: ${INK}; }

  .board {
    --w: ${spec.widthPx};
    --h: ${spec.heightPx};
    --u: calc(var(--w) * 1px / 100);
    --v: calc(var(--h) * 1px / 100);
    width: ${spec.widthPx}px;
    height: ${spec.heightPx}px;
    position: relative;
    display: flex;
    flex-direction: column;
    background: ${PAPER};
  }

  .safe {
    position: absolute;
    left: calc(${spec.safeMarginPctW} * var(--u));
    right: calc(${spec.safeMarginPctW} * var(--u));
    top: calc(${spec.safeMarginPctTopV} * var(--v));
    bottom: calc(${spec.safeMarginPctBottomV} * var(--v));
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .zone {
    flex: 0 0 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    color: ${INK};
    overflow: visible;
  }
  .z-z1 { color: ${INK}; align-items: flex-end; }
  .z-z2 { color: ${MUTED}; border-bottom: 1px solid ${RULE}; }
  .z-z4, .z-z5, .z-z10 { color: ${MUTED}; }
  .z-z10 { color: ${ACCENT}; font-weight: 700; }

  .cat-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    column-gap: calc(1.5 * var(--u));
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    align-content: start;
  }
  .cat-col { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .cat-row {
    flex: 0 0 auto;
    display: flex;
    align-items: baseline;
    gap: calc(0.4 * var(--u));
    font-weight: 700;
    line-height: 1.15;
    min-width: 0;
    overflow: hidden;
  }
  /* No ellipsis, no forced nowrap — a truncated trade name is a factually
     incomplete one. Real names that need a second line are exactly what
     the capacity arithmetic already derates for (see layouts.ts); this
     demo's placeholder labels never wrap, but the CSS must not assume that. */
  .cat-label { min-width: 0; }
  .cat-mark { color: ${ACCENT}; flex: 0 0 auto; }
  .cat-label { flex: 1 1 auto; min-width: 0; }

  .cat-group-wrap { display: flex; flex-direction: column; gap: calc(0.6 * var(--v)); flex: 1 1 auto; min-height: 0; }
  .cat-group { display: flex; flex-direction: column; min-height: 0; }
  .cat-group-head {
    flex: 0 0 auto;
    font-size: calc(1.8 * var(--v));
    font-weight: 700;
    letter-spacing: 0.15em;
    color: ${PAPER};
    background: ${INK};
    padding: calc(0.25 * var(--v)) calc(1 * var(--u));
    margin-bottom: calc(0.2 * var(--v));
  }

  .footer {
    flex: 0 0 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(1 * var(--u));
    border-top: 1px solid ${RULE};
    padding-top: calc(0.4 * var(--v));
  }
  .footer-text { display: flex; flex-direction: column; gap: calc(0.15 * var(--v)); min-width: 0; }
  /* max() enforces a sane absolute floor for these micro roles — a %V
     coefficient that reads fine on a tall canvas can compute to a few
     px on a short one (DG-5's 628px height is the case that exposed
     this). The type ramp's 5–5.5pt licence role is legitimately below
     the category floor, but it is not exempt from being readable. */
  .agency-mark { font-weight: 700; font-size: max(14px, calc(2 * var(--v))); }
  .agency-address { font-size: max(11px, calc(1.3 * var(--v))); color: ${MUTED}; }
  .licence { font-size: max(10px, calc(1.1 * var(--v))); color: ${MUTED}; letter-spacing: 0.05em; }
  .qr { flex: 0 0 auto; }
  .qr svg { width: 100%; height: 100%; display: block; }

  .split-row { display: flex; flex-direction: row; gap: calc(2 * var(--u)); flex: 1 1 auto; min-height: 0; min-width: 0; }
  .split-left { display: flex; flex-direction: column; min-height: 0; min-width: 0; flex: 1 1 65%; }
  .split-right {
    flex: 0 0 32%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(1 * var(--v));
    min-width: 0;
    border-left: 1px solid ${RULE};
    padding-left: calc(2 * var(--u));
  }
  .footer-text--split { align-items: center; text-align: center; }

</style>
</head>
<body>
  <div class="board ${printClass}" data-audit="board" data-code="${spec.code}">
    <div class="safe" data-audit="safe">
      ${safeInner}
    </div>
  </div>
${zoneCss ? `<style>${zoneCss}</style>` : ""}
</body>
</html>`;
}
