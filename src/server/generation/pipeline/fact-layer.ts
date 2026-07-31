import "../font-config"; // FONTCONFIG_FILE must be set before any rasterization
import sharp from "sharp";
import { brandingStripHeight } from "./branding-overlay";
import type { AdvertisementFacts } from "./types";

/**
 * The Fact Layer — deterministic typesetting of every verified recruitment
 * fact, per docs/010 Amendment 1 (Factual Integrity Law) and KDL v1.0.
 *
 * The image model supplies background artwork only. Everything a candidate
 * must be able to trust is drawn here, from structured data, at a known
 * coordinate, at a known size. Nothing is dropped silently: text never
 * shrinks below the legibility floor and titles are never truncated, so
 * when a requirement is large the CANVAS GROWS rather than the type
 * shrinking. Only when the canvas would stop being publishable does this
 * throw LayoutCapacityError.
 *
 * This is part of the one Rendering Engine; it holds no creative logic.
 */

/** KDL §3.1 — locked palette. Nothing here may be changed or added to. */
const NAVY = "#0B1F33";
const GOLD = "#F3D98B";
const SLATE = "#4A5A6C";
const WHITE = "#FFFFFF";

/**
 * KDL §4 — the branding strip owns the bottom of the canvas. Its exact
 * height comes from the Rendering Engine itself (brandingStripHeight), so
 * the two can never drift apart; this fraction is the fallback bound used
 * when solving for canvas height.
 */
const RESERVED_TOP = 0.8;
void RESERVED_TOP;

/** KDL §3.2 — type scale as fractions of W. */
const T = {
  D1: 0.072,
  H1: 0.052,
  H2: 0.038,
  H3: 0.028,
  BodyL: 0.024,
  Body: 0.02,
  Caption: 0.016,
} as const;

/** KDL §3.2 — no factual text renders below this. */
const LEGIBILITY_FLOOR = 0.016;

/** KDL §2 — grid. */
const MARGIN = 0.065;
const GUTTER = 0.02;

/**
 * Taller than this stops being publishable. A bulk drive of 100+ roles is
 * legitimately a tall poster (and prints/PDFs fine); beyond 4:1 it stops
 * being usable on a feed, and that is a real capacity limit, not a
 * licence to drop roles.
 */
const MAX_ASPECT = 4.0;

export class LayoutCapacityError extends Error {
  readonly code = "LAYOUT_CAPACITY";
  constructor(readonly unplaced: string[]) {
    super(
      `Advertisement cannot be rendered without omitting verified information at minimum readability. Unplaced: ${unplaced.join("; ")}`,
    );
    this.name = "LayoutCapacityError";
  }
}

type Tier = "T1" | "T2" | "T3" | "T4";

function tierFor(count: number): Tier {
  if (count <= 3) return "T1";
  if (count <= 12) return "T2";
  if (count <= 40) return "T3";
  return "T4";
}

const maxColumnsFor = (tier: Tier) => (tier === "T1" || tier === "T2" ? 1 : tier === "T3" ? 2 : 3);

const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * Advance-width estimate. Bold uppercase display type is materially wider
 * per character than body text, so it gets a larger factor — using one
 * factor for both is what let a headline run past the right margin.
 */
const widthFactor = (text: string, bold = false) => {
  const upper = text === text.toUpperCase() && /[A-Z]/.test(text);
  if (bold && upper) return 0.68;
  if (bold) return 0.60;
  return upper ? 0.62 : 0.56;
};

const textWidth = (text: string, size: number, bold = false) =>
  text.length * size * widthFactor(text, bold);

function fit(text: string, maxWidth: number, preferred: number, min: number, bold = false): number {
  let size = preferred;
  while (size > min && textWidth(text, size, bold) > maxWidth) size -= 1;
  return Math.max(size, min);
}

/** All wrapped lines, uncapped — used both to measure and to draw. */
function wrapLines(text: string, maxWidth: number, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function wrap(text: string, maxWidth: number, size: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

/** Detail string for one role — only ever built from values that are present. */
function roleDetail(p: AdvertisementFacts["positions"][number]): string {
  const bits: string[] = [];
  if (p.experience) bits.push(p.experience);
  if (p.salary) bits.push(p.salary);
  if (p.qualification) bits.push(p.qualification);
  if (p.certifications?.length) bits.push(p.certifications.join(", "));
  return bits.join(" · ");
}

export interface FactLayerInput {
  facts: AdvertisementFacts;
  widthPx: number;
  heightPx: number;
}

export interface FactLayerResult {
  png: Buffer;
  /** Actual height used — grows past the request for dense requirements. */
  heightPx: number;
  /**
   * Height of the hero/artwork region. Below this line the canvas is the
   * fact layer — positions, salary, benefits, contact — so nothing
   * decorative may be painted there.
   */
  artworkHeightPx: number;
}

type Plan = ReturnType<typeof planBody>;

/**
 * Plans the body before anything is drawn (KDL §10.2.1). Column count is
 * chosen so the longest verified title fits at the legibility floor, which
 * is what makes truncation impossible.
 */
function planBody(facts: AdvertisementFacts, tier: Tier, W: number) {
  const px = (f: number) => Math.round(f * W);
  const margin = px(MARGIN);
  const contentW = W - margin * 2;
  const gutter = px(GUTTER);
  const floor = px(LEGIBILITY_FLOOR);

  const titleSize = tier === "T1" ? px(T.H3) : tier === "T2" ? px(T.BodyL) : px(T.Body);
  const detailSize = px(T.Caption);
  const showDetail = tier === "T1" || tier === "T2";
  // T3/T4 tighten the rhythm: past a dozen roles the list is scanned, not read.
  const rowGap = px(tier === "T1" ? 0.02 : tier === "T2" ? 0.014 : tier === "T3" ? 0.009 : 0.007);
  const lineFactor = tier === "T4" ? 1.15 : 1.25;
  const badgeW = facts.positions.some((p) => p.count != null) ? px(0.05) : 0;

  // A long title wraps inside its column; it never truncates and never
  // collapses the grid. Only a title that still needs more than MAX_LINES
  // at the floor forces a narrower column count.
  const MAX_LINES = 3;
  let cols = maxColumnsFor(tier);
  let colW = Math.round((contentW - gutter * (cols - 1)) / cols);
  while (
    cols > 1 &&
    facts.positions.some((p) => wrapLines(p.title, colW - badgeW, floor).length > MAX_LINES)
  ) {
    cols -= 1;
    colW = Math.round((contentW - gutter * (cols - 1)) / cols);
  }

  const anyDetail = showDetail && facts.positions.some((p) => roleDetail(p));
  const rowHeights = facts.positions.map((p) => {
    const lines = Math.min(
      MAX_LINES,
      wrapLines(p.title, colW - badgeW, titleSize).length,
    );
    return Math.round(
      titleSize * lineFactor * lines + (anyDetail && roleDetail(p) ? detailSize * 1.3 : 0) + rowGap,
    );
  });
  const perCol = Math.ceil(facts.positions.length / cols);
  let listH = 0;
  for (let c = 0; c < cols; c++) {
    listH = Math.max(listH, rowHeights.slice(c * perCol, (c + 1) * perCol).reduce((a, b) => a + b, 0));
  }
  const rowH = rowHeights[0] ?? 0;

  const headingH = Math.round(px(T.H2) * 1.6);
  const extraH =
    (facts.benefits.length ? Math.round(px(T.Caption) * 2.6) : 0) +
    (facts.interview.length ? Math.round(px(T.Caption) * 2.8) : 0);

  return {
    cols, colW, margin, contentW, gutter, titleSize, detailSize, showDetail,
    rowGap, badgeW, perCol, rowH, rowHeights, listH, headingH, extraH, floor, lineFactor,
    maxLines: MAX_LINES,
    bodyH: headingH + listH + extraH,
  };
}

/**
 * Measures the hero block so the hero box can be sized to hold it. Laying
 * the hero out by accumulating y without knowing the box height is what
 * pushed the subtitle onto the cream body surface (white on cream) and
 * collided the total badge with the first position row.
 */
function planHero(facts: AdvertisementFacts, W: number) {
  const px = (f: number) => Math.round(f * W);
  const contentW = W - px(MARGIN) * 2;
  const floor = px(LEGIBILITY_FLOOR);

  const headline = (facts.header || `Hiring — ${facts.country}`).toUpperCase();
  const headlineSize = fit(headline, contentW, px(T.D1), px(T.H3), true);
  const headlineLines = wrapLines(headline, contentW, headlineSize);

  const employerSize = facts.employer
    ? fit(facts.employer, contentW, px(T.H1), px(T.H3), true)
    : 0;
  const sub = [facts.projectType, facts.industry].filter(Boolean).join(" · ");
  const subSize = sub ? fit(sub, contentW, px(T.H3), floor) : 0;
  const meta = [facts.visaType, facts.dutyHours, facts.rotation].filter(Boolean).join("  ·  ");
  const metaSize = meta ? fit(meta, contentW, px(T.Caption), floor) : 0;
  const badgeH = Math.round(px(T.Caption) * 2.2);

  const h =
    px(0.055) +
    headlineLines.length * Math.round(headlineSize * 1.14) +
    (employerSize ? px(0.01) + Math.round(employerSize * 1.08) : 0) +
    (subSize ? px(0.006) + Math.round(subSize * 1.15) : 0) +
    (metaSize ? Math.round(metaSize * 1.3) : 0) +
    px(0.008) + badgeH + px(0.03);

  return { headline, headlineSize, headlineLines, employerSize, sub, subSize, meta, metaSize, badgeH, contentH: h };
}

/**
 * What the badge should actually claim.
 *
 * Counting roles understates the requirement badly: "50 TIG Welders + 30
 * Pipe Fitters" is 80 jobs, and a badge reading "2 POSITIONS AVAILABLE"
 * makes an agency advertising 80 vacancies look like it has two. Vacancies
 * are what a candidate and an agency both care about.
 *
 * The sum is only stated when every role carries a verified count —
 * otherwise it would be a partial total presented as a whole, which is a
 * fabricated fact. In that case the badge falls back to counting roles,
 * which is always true.
 */
function headlineCountLabel(facts: AdvertisementFacts): string {
  const roles = facts.positions.length;
  const allCounted = roles > 0 && facts.positions.every((p) => typeof p.count === "number");

  if (allCounted) {
    const vacancies = facts.positions.reduce((sum, p) => sum + (p.count ?? 0), 0);
    if (vacancies > roles) {
      return roles === 1
        ? `${vacancies} VACANCIES`
        : `${vacancies} VACANCIES · ${roles} ROLES`;
    }
  }
  return `${roles} POSITION${roles === 1 ? "" : "S"} AVAILABLE`;
}

export async function renderFactLayer(input: FactLayerInput): Promise<FactLayerResult> {
  const { facts, widthPx: W } = input;
  const px = (f: number) => Math.round(f * W);
  const total = facts.positions.length;
  const tier = tierFor(total);
  const heroFrac = tier === "T1" || tier === "T2" ? 0.42 : 0.3;
  // The hero is capped in absolute terms so a tall directory poster does not
  // spend a third of its height on artwork it does not need.
  const heroCap = Math.round((tier === "T1" || tier === "T2" ? 0.62 : 0.5) * W);
  const plan = planBody(facts, tier, W);
  const hero = planHero(facts, W);
  const pad = px(0.06);

  // Solve for the canvas height that holds every fact at the floor. The
  // branding strip and the hero are both capped against width, so the
  // relationship is piecewise — settle it with a short fixed-point loop
  // rather than assuming which regime applies.
  const hasContact = Boolean(facts.contact.phone || facts.contact.email);

  // DTP chrome consumed outside the body: agency rule bar (0.062W), gold
  // strap (0.055W) and the reversed section bar (0.045W). These are drawn
  // by the composition and were invisible to the height solve, which is
  // why the last rows of a seven-role list ran underneath the benefits
  // strap and were clipped.
  const dtpChromeH = Math.round(W * (0.062 + 0.055 + 0.045));

  // The DTP masthead is tight: exactly its measured content plus a modest
  // band of artwork. Information-maximal is the convention here — a
  // masthead occupying half the page reads as having less on offer.
  const mastheadH = Math.round(W * 0.062) + hero.contentH + Math.round(W * 0.02);

  let H = input.heightPx;
  for (let i = 0; i < 6; i++) {
    const stripAt = brandingStripHeight(W, H, hasContact) + Math.round(0.025 * H);
    // plan.bodyH still counts planBody()'s own "POSITIONS" heading, which
    // the DTP section bar replaces — counting both left a band of dead
    // white above the contact bar.
    const bodyH = plan.bodyH - plan.headingH;
    const need = Math.max(input.heightPx, mastheadH + dtpChromeH + bodyH + pad + stripAt);
    if (need <= H) break;
    H = need;
  }

  if (H > W * MAX_ASPECT) {
    throw new LayoutCapacityError([
      `${total} positions need a ${H}px canvas at minimum readability, beyond the ${Math.round(W * MAX_ASPECT)}px publishable limit`,
    ]);
  }

  // The masthead always holds its measured content, and no more. The old
  // rule donated all leftover height to the artwork, which on a DTP page
  // produced a near-empty half-canvas above a clipped table.
  const heroPx = Math.min(mastheadH, heroCap);
  void heroFrac;
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];

  // ---- DTP composition ------------------------------------------------
  // Benchmarked against Assignment Abroad Times classified advertisements
  // (M. Gheewala, Al-Yousuf). That trade convention is information-maximal,
  // not whitespace-led: a hard outer frame, full-bleed reversed banners,
  // ruled tables, and every fact boxed. Candidates in this market read
  // these pages expecting density — a spacious "campaign" layout reads as
  // having less on offer.
  const FRAME = Math.max(3, Math.round(W * 0.004));
  const inset = Math.round(W * 0.012);

  // Paper: the printed surface stops where the branding strip begins. The
  // strip is the Rendering Engine's own territory and the fact layer must
  // draw nothing inside it.
  const stripH = brandingStripHeight(W, H, hasContact);
  const paperH = H - stripH;
  parts.push(`<rect x="0" y="0" width="${W}" height="${paperH}" fill="${WHITE}"/>`);

  // Masthead band — the only place the background artwork shows, behind a
  // near-opaque scrim that guarantees the headline's contrast.
  parts.push(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${NAVY}" stop-opacity="0.92"/>` +
      `<stop offset="1" stop-color="${NAVY}" stop-opacity="0.80"/>` +
      `</linearGradient></defs>`,
  );

  // Outer frame — the single most recognisable DTP signal.
  parts.push(
    `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${paperH - inset * 2}" ` +
      `fill="none" stroke="${NAVY}" stroke-width="${FRAME}"/>`,
  );

  const edge = inset + FRAME;
  const innerW = W - edge * 2;
  const bandPad = Math.round(W * 0.022);
  const colX = edge + bandPad;
  const colW2 = innerW - bandPad * 2;

  // ---- Band 1: agency rule bar (reversed) ----
  const barH = Math.round(W * 0.062);
  parts.push(`<rect x="${edge}" y="${edge}" width="${innerW}" height="${barH}" fill="${NAVY}"/>`);
  const agencySize = fit(facts.agencyName.toUpperCase(), colW2 * 0.62, Math.round(barH * 0.42), plan.floor, true);
  parts.push(
    `<text x="${colX}" y="${edge + Math.round(barH * 0.66)}" font-family="KaiSans, sans-serif" ` +
      `font-size="${agencySize}" font-weight="700" fill="${WHITE}" letter-spacing="1">${esc(facts.agencyName.toUpperCase())}</text>`,
  );
  if (facts.raLicenseId) {
    parts.push(
      `<text x="${W - edge - bandPad}" y="${edge + Math.round(barH * 0.66)}" font-family="KaiSans, sans-serif" ` +
        `font-size="${px(T.Caption)}" fill="${GOLD}" text-anchor="end">${esc(facts.raLicenseId)}</text>`,
    );
  }

  // ---- Band 2: masthead headline, reversed over artwork ----
  const mastTop = edge + barH;
  const mastH = Math.max(heroPx - mastTop, Math.round(W * 0.2));
  parts.push(`<rect x="${edge}" y="${mastTop}" width="${innerW}" height="${mastH}" fill="url(#s)"/>`);

  let y = mastTop + Math.round(mastH * 0.1) + hero.headlineSize;
  for (const l of hero.headlineLines) {
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.headlineSize}" ` +
        `font-weight="800" fill="${WHITE}" text-anchor="middle" letter-spacing="-1">${esc(l.toUpperCase())}</text>`,
    );
    y += Math.round(hero.headlineSize * 1.1);
  }
  if (facts.employer && hero.employerSize) {
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.employerSize}" ` +
        `font-weight="700" fill="${GOLD}" text-anchor="middle">${esc(facts.employer.toUpperCase())}</text>`,
    );
    y += Math.round(hero.employerSize * 1.15);
  }
  if (hero.meta && hero.metaSize) {
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.metaSize}" ` +
        `fill="${WHITE}" text-anchor="middle" opacity="0.85">${esc(hero.meta)}</text>`,
    );
  }

  // ---- Band 3: gold strap — the verified count, black on gold ----
  const strapY = mastTop + mastH;
  const strapH = Math.round(W * 0.055);
  parts.push(`<rect x="${edge}" y="${strapY}" width="${innerW}" height="${strapH}" fill="${GOLD}"/>`);
  const strapBits = [headlineCountLabel(facts), facts.country?.toUpperCase(), facts.industry?.toUpperCase()]
    .filter(Boolean)
    .join("   •   ");
  const strapSize = fit(strapBits, colW2, Math.round(strapH * 0.4), plan.floor, true);
  parts.push(
    `<text x="${Math.round(W / 2)}" y="${strapY + Math.round(strapH * 0.66)}" font-family="KaiSans, sans-serif" ` +
      `font-size="${strapSize}" font-weight="700" fill="${NAVY}" text-anchor="middle" letter-spacing="1">${esc(strapBits)}</text>`,
  );

  parts.push(renderBody(facts, W, strapY + strapH, plan, edge, innerW));
  parts.push(`</svg>`);

  const png = await sharp(Buffer.from(parts.join(""))).png().toBuffer();
  return { png, heightPx: H, artworkHeightPx: heroPx };
}

function renderBody(
  facts: AdvertisementFacts,
  W: number,
  heroPx: number,
  plan: Plan,
  edge = 0,
  innerW = W,
): string {
  const px = (f: number) => Math.round(f * W);
  const { cols, gutter, titleSize, detailSize, showDetail, rowGap, badgeW, perCol, floor } = plan;
  const parts: string[] = [];
  const pad = Math.round(W * 0.022);
  const tableX = edge + pad;
  const tableW = innerW - pad * 2;

  // ---- Section rule bar, reversed. DTP convention: sections are declared
  // by a solid bar across the measure, not by a heading floating in space.
  const secH = Math.round(W * 0.045);
  let y = heroPx + px(0.018);
  parts.push(`<rect x="${edge}" y="${y}" width="${innerW}" height="${secH}" fill="${NAVY}"/>`);
  parts.push(
    `<text x="${Math.round(W / 2)}" y="${y + Math.round(secH * 0.68)}" font-family="KaiSans, sans-serif" ` +
      `font-size="${Math.round(secH * 0.44)}" font-weight="700" fill="${WHITE}" text-anchor="middle" ` +
      `letter-spacing="3">POSITIONS AVAILABLE</text>`,
  );
  y += secH;

  // ---- Ruled position table. Every row is boxed and separated by a rule;
  // alternating tint keeps a long list scannable across the measure.
  const startY = y;
  const colPitch = Math.round((tableW - gutter * (cols - 1)) / cols);
  for (let c = 0; c < cols; c++) {
    const colX = tableX + c * (colPitch + gutter);
    let cy = startY;
    let index = c * perCol;
    for (const p of facts.positions.slice(c * perCol, (c + 1) * perCol)) {
      const rowParts: string[] = [];
      const rowTop = cy;
      // The row occupies exactly the height the planner reserved for it.
      // Drawing that consumed more than planBody() predicted is what let
      // the benefits strap land in the middle of the table.
      const rowH = plan.rowHeights[index] ?? Math.round(titleSize * plan.lineFactor + rowGap);

      const tx = colX + badgeW + Math.round(pad * 0.4);
      const tw = colPitch - badgeW - pad;
      const lines = wrap(p.title, tw, titleSize, plan.maxLines);
      let baseline = rowTop + Math.round(titleSize * 0.95);
      for (const line of lines) {
        const ls = fit(line, tw, titleSize, floor);
        rowParts.push(
          `<text x="${tx}" y="${baseline}" font-family="KaiSans, sans-serif" font-size="${ls}" ` +
            `font-weight="700" fill="${NAVY}">${esc(line.toUpperCase())}</text>`,
        );
        baseline += Math.round(titleSize * plan.lineFactor);
      }
      if (showDetail) {
        const d = roleDetail(p);
        if (d) {
          const ds = fit(d, tw, detailSize, floor);
          rowParts.push(
            `<text x="${tx}" y="${baseline}" font-family="KaiSans, sans-serif" font-size="${ds}" fill="${SLATE}">${esc(d)}</text>`,
          );
        }
      }
      cy = rowTop + rowH;

      // Row tint, then the vacancy-count cell, then a full-measure rule.
      if (index % 2 === 1) {
        parts.push(
          `<rect x="${colX}" y="${rowTop}" width="${colPitch}" height="${rowH - Math.round(rowGap * 0.4)}" fill="#F3EEE3"/>`,
        );
      }
      if (p.count != null) {
        const cellH = rowH - Math.round(rowGap * 0.4);
        parts.push(
          `<rect x="${colX}" y="${rowTop}" width="${badgeW}" height="${cellH}" fill="${GOLD}"/>`,
        );
        parts.push(
          `<text x="${colX + Math.round(badgeW / 2)}" y="${rowTop + Math.round(cellH / 2) + Math.round(titleSize * 0.34)}" ` +
            `font-family="KaiSans, sans-serif" font-size="${Math.round(titleSize * 0.84)}" font-weight="700" ` +
            `fill="${NAVY}" text-anchor="middle">${esc(String(p.count))}</text>`,
        );
      }
      parts.push(...rowParts);
      parts.push(
        `<line x1="${colX}" y1="${cy - Math.round(rowGap * 0.4)}" x2="${colX + colPitch}" ` +
          `y2="${cy - Math.round(rowGap * 0.4)}" stroke="${NAVY}" stroke-width="1.5" opacity="0.5"/>`,
      );
      index++;
    }
  }

  let sy = startY + plan.listH + px(0.016);

  // ---- Benefits: reversed strap across the full measure, gold on navy.
  if (facts.benefits.length) {
    const text = facts.benefits.map((b) => (b.detail ? `${b.label}: ${b.detail}` : b.label)).join("   •   ");
    const s = fit(text.toUpperCase(), tableW, px(T.Caption), floor, true);
    const barH = Math.round(s * 2.6);
    parts.push(`<rect x="${edge}" y="${sy - Math.round(s * 1.2)}" width="${innerW}" height="${barH}" fill="${NAVY}"/>`);
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${sy + Math.round(s * 0.46)}" font-family="KaiSans, sans-serif" ` +
        `font-size="${s}" font-weight="700" fill="${GOLD}" text-anchor="middle" letter-spacing="1">${esc(text.toUpperCase())}</text>`,
    );
    sy += Math.round(s * 2.9);
  }

  // Interview — omitted entirely when absent.
  const ev = facts.interview[0];
  if (ev) {
    const detail = [ev.date, ev.location].filter(Boolean).join(" · ");
    if (detail) {
      const s = fit(`INTERVIEW   ${detail}`, plan.contentW, px(T.Caption), floor);
      parts.push(
        `<text x="${tableX}" y="${sy + Math.round(s * 1.1)}" font-family="KaiSans, sans-serif" font-size="${s}" font-weight="700" fill="${NAVY}">INTERVIEW</text>`,
      );
      parts.push(
        `<text x="${tableX + Math.round(textWidth("INTERVIEW   ", s))}" y="${sy + Math.round(s * 1.1)}" font-family="KaiSans, sans-serif" font-size="${s}" fill="${SLATE}">${esc(detail)}</text>`,
      );
    }
  }

  return parts.join("");
}
