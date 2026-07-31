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
const DIVIDER = "#C9C0AB";

/**
 * KDL §4 — the branding strip owns the bottom of the canvas. Its exact
 * height comes from the Rendering Engine itself (brandingStripHeight), so
 * the two can never drift apart; this fraction is the fallback bound used
 * when solving for canvas height.
 */
const RESERVED_TOP = 0.8;
void RESERVED_TOP;
const HEADER_H = 0.11;

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

/**
 * The two KAI design languages. A theme is a visual language, not an
 * engine — both are rendered by this one Rendering Engine, from the same
 * verified facts, through the same QR, verification and Vision QA. Only
 * the design language changes.
 *
 * THEME_01 Premium Campaign  — maximum attention. Hero photography, large
 *   type, spacious. For LinkedIn, Facebook, Instagram, WhatsApp, employer
 *   branding. Recommended 1–20 positions.
 *
 * THEME_02 High Density      — maximum information. A modern structured
 *   table, minimal artwork, dense but readable on a phone, brand and QR
 *   retained. For shutdowns, mega hiring, bulk and contractor campaigns.
 *   Recommended 20+ positions.
 *
 * THEME_02 is explicitly NOT a newspaper classified. It is the modern
 * evolution of that format: a candidate recognises it instantly, but it
 * still looks like KAI.
 */
export type AdTheme = "PREMIUM_CAMPAIGN" | "HIGH_DENSITY";

export interface ThemeSelection {
  theme: AdTheme;
  /** Why this theme was chosen — surfaced to the recruiter and analytics. */
  reason: string;
  /** True when the caller supplied the theme instead of KAI choosing it. */
  fromOverride: boolean;
}

/**
 * Recruiters never choose a theme. KAI reads the shape of the requirement
 * and picks — position count first, then how much information each role
 * actually carries, because twelve roles each with salary, qualification
 * and certifications is a denser page than twenty bare titles.
 */
export function selectTheme(facts: AdvertisementFacts, override?: AdTheme | null): ThemeSelection {
  if (override) {
    return { theme: override, reason: "The recruiter selected this theme.", fromOverride: true };
  }

  const roles = facts.positions.length;
  if (roles >= 20) {
    return {
      theme: "HIGH_DENSITY",
      reason: `${roles} positions — a structured table carries them legibly; a campaign layout could not.`,
      fromOverride: false,
    };
  }

  // Detail load: a role carrying salary/qualification/certifications needs
  // materially more room than a bare title.
  const detailed = facts.positions.filter((p) => roleDetail(p)).length;
  const detailLoad = roles === 0 ? 0 : detailed / roles;
  if (roles >= 13 && detailLoad > 0.6) {
    return {
      theme: "HIGH_DENSITY",
      reason: `${roles} positions, most carrying salary and qualification detail — density serves the candidate better.`,
      fromOverride: false,
    };
  }

  return {
    theme: "PREMIUM_CAMPAIGN",
    reason:
      roles <= 3
        ? `${roles} position${roles === 1 ? "" : "s"} — a hero-led campaign gives each role full weight.`
        : `${roles} positions — a campaign layout keeps attention while holding every role.`,
    fromOverride: false,
  };
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
  /** Recruiter override. Omitted means KAI selects the theme itself. */
  theme?: AdTheme | null;
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
  /** Which design language was used, and why. */
  themeSelection: ThemeSelection;
}

type Plan = ReturnType<typeof planBody>;

/**
 * Plans the body before anything is drawn (KDL §10.2.1). Column count is
 * chosen so the longest verified title fits at the legibility floor, which
 * is what makes truncation impossible.
 */
function planBody(facts: AdvertisementFacts, tier: Tier, W: number, dense = false) {
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
  // High Density promotes salary into its own right-hand column. That
  // width must be reserved before titles are wrapped, or a long title
  // wraps as if it owned the full measure and then collides with the figure.
  const salaryW =
    dense && facts.positions.some((p) => p.salary)
      ? Math.round((W - margin * 2) * (maxColumnsFor(tier) > 1 ? 0.13 : 0.22))
      : 0;

  // A long title wraps inside its column; it never truncates and never
  // collapses the grid. Only a title that still needs more than MAX_LINES
  // at the floor forces a narrower column count.
  const MAX_LINES = 3;
  let cols = maxColumnsFor(tier);
  let colW = Math.round((contentW - gutter * (cols - 1)) / cols);
  while (
    cols > 1 &&
    facts.positions.some((p) => wrapLines(p.title, colW - badgeW - salaryW, floor).length > MAX_LINES)
  ) {
    cols -= 1;
    colW = Math.round((contentW - gutter * (cols - 1)) / cols);
  }

  const anyDetail = showDetail && facts.positions.some((p) => roleDetail(p));
  const rowHeights = facts.positions.map((p) => {
    const lines = Math.min(
      MAX_LINES,
      wrapLines(p.title, colW - badgeW - salaryW, titleSize).length,
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
    rowGap, badgeW, salaryW, perCol, rowH, rowHeights, listH, headingH, extraH, floor, lineFactor,
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
  const themeSelection = selectTheme(facts, input.theme);
  const dense = themeSelection.theme === "HIGH_DENSITY";
  const tier = tierFor(total);
  // High Density trades hero height for information: minimal artwork, and
  // the page belongs to the table.
  const heroFrac = dense ? 0.16 : tier === "T1" || tier === "T2" ? 0.42 : 0.3;
  // The hero is capped in absolute terms so a tall directory poster does not
  // spend a third of its height on artwork it does not need.
  const heroCap = Math.round((dense ? 0.3 : tier === "T1" || tier === "T2" ? 0.62 : 0.5) * W);
  const plan = planBody(facts, tier, W, dense);
  const hero = planHero(facts, W);
  const pad = px(0.06);

  // Solve for the canvas height that holds every fact at the floor. The
  // branding strip and the hero are both capped against width, so the
  // relationship is piecewise — settle it with a short fixed-point loop
  // rather than assuming which regime applies.
  const hasContact = Boolean(facts.contact.phone || facts.contact.email);
  let H = input.heightPx;
  for (let i = 0; i < 6; i++) {
    const heroAt = Math.max(
      Math.min(Math.round(heroFrac * H), heroCap),
      Math.min(Math.round(HEADER_H * H), Math.round(0.15 * W)) + hero.contentH,
    );
    const stripAt = brandingStripHeight(W, H, hasContact) + Math.round(0.025 * H);
    const need = Math.max(input.heightPx, heroAt + plan.bodyH + pad + stripAt);
    if (need <= H) break;
    H = need;
  }

  if (H > W * MAX_ASPECT) {
    throw new LayoutCapacityError([
      `${total} positions need a ${H}px canvas at minimum readability, beyond the ${Math.round(W * MAX_ASPECT)}px publishable limit`,
    ]);
  }

  // The hero box always holds its measured content — the cap only trims
  // decorative slack, it never clips a fact.
  let heroPx = Math.max(
    Math.min(Math.round(heroFrac * H), heroCap),
    Math.min(Math.round(HEADER_H * H), Math.round(0.15 * W)) + hero.contentH,
  );

  // A short requirement on a square canvas left a large dead band of cream
  // below the last line. Give the slack to the artwork instead: a one-role
  // advertisement should be photo-led, not half-empty. Capped so the hero
  // never crowds out the facts.
  const strip = brandingStripHeight(W, H, hasContact);
  const slack = H - strip - heroPx - plan.bodyH - px(0.05);
  if (slack > 0) {
    heroPx = Math.min(heroPx + slack, Math.round(0.55 * H));
  }
  const margin = plan.margin;
  const contentW = plan.contentW;
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];

  // ---- Hero scrim (KDL §4.3): a known contrast floor over unknown artwork.
  parts.push(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${NAVY}" stop-opacity="0.94"/>` +
      `<stop offset="0.75" stop-color="${NAVY}" stop-opacity="0.82"/>` +
      `<stop offset="1" stop-color="${NAVY}" stop-opacity="0.35"/>` +
      `</linearGradient></defs>`,
  );
  parts.push(`<rect x="0" y="0" width="${W}" height="${heroPx}" fill="url(#s)"/>`);
  // Body surface: cream, so factual text sits on a known background.
  parts.push(
    `<rect x="0" y="${heroPx}" width="${W}" height="${H - brandingStripHeight(W, H, hasContact) - heroPx}" fill="#F3EEE3"/>`,
  );

  // ---- Header (KDL §4.2) ----
  // Capped like the hero: on a tall directory poster a height-proportional
  // header becomes a large empty navy slab.
  const headH = Math.min(Math.round(HEADER_H * H), Math.round(0.15 * W));
  parts.push(`<rect x="0" y="0" width="${W}" height="${headH}" fill="${NAVY}"/>`);
  const baseY = headH - Math.round(headH * 0.34);
  const agencySize = fit(facts.agencyName, contentW * 0.66, px(T.H3), plan.floor);
  parts.push(
    `<text x="${margin}" y="${baseY}" font-family="KaiSans, sans-serif" font-size="${agencySize}" font-weight="700" fill="${WHITE}">${esc(facts.agencyName)}</text>`,
  );
  if (facts.country) {
    parts.push(
      `<text x="${W - margin}" y="${baseY}" font-family="KaiSans, sans-serif" font-size="${px(T.Caption)}" fill="${GOLD}" text-anchor="end" letter-spacing="2">${esc(facts.country.toUpperCase())}</text>`,
    );
  }
  parts.push(`<rect x="${margin}" y="${headH - 5}" width="${px(0.12)}" height="5" fill="${GOLD}"/>`);

  // ---- Hero (KDL §4.4 ranks 1–4) ----
  let y = headH + px(0.055);
  for (const l of hero.headlineLines) {
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.headlineSize}" font-weight="800" fill="${WHITE}" letter-spacing="-1">${esc(l)}</text>`,
    );
    y += Math.round(hero.headlineSize * 1.14);
  }
  if (facts.employer && hero.employerSize) {
    y += px(0.01);
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.employerSize}" font-weight="700" fill="${GOLD}">${esc(facts.employer)}</text>`,
    );
    y += Math.round(hero.employerSize * 1.08);
  }
  if (hero.sub && hero.subSize) {
    y += px(0.006);
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.subSize}" fill="${WHITE}" opacity="0.9">${esc(hero.sub)}</text>`,
    );
    y += Math.round(hero.subSize * 1.15);
  }
  if (hero.meta && hero.metaSize) {
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hero.metaSize}" fill="${WHITE}" opacity="0.75">${esc(hero.meta)}</text>`,
    );
    y += Math.round(hero.metaSize * 1.3);
  }

  // Total badge — always the true, verified total.
  const label = headlineCountLabel(facts);
  const bS = px(T.Caption);
  const bW = Math.round(textWidth(label, bS) + px(0.045));
  y += px(0.008);
  parts.push(
    `<rect x="${margin}" y="${y}" width="${bW}" height="${hero.badgeH}" rx="${Math.round(hero.badgeH / 2)}" fill="${GOLD}"/>`,
  );
  parts.push(
    `<text x="${margin + Math.round(bW / 2)}" y="${y + Math.round(hero.badgeH * 0.7)}" font-family="KaiSans, sans-serif" font-size="${bS}" font-weight="700" fill="${NAVY}" text-anchor="middle" letter-spacing="1">${esc(label)}</text>`,
  );

  parts.push(renderBody(facts, W, heroPx, plan, dense));
  parts.push(`</svg>`);

  const png = await sharp(Buffer.from(parts.join(""))).png().toBuffer();
  return { png, heightPx: H, artworkHeightPx: heroPx, themeSelection };
}

function renderBody(
  facts: AdvertisementFacts,
  W: number,
  heroPx: number,
  plan: Plan,
  dense = false,
): string {
  const px = (f: number) => Math.round(f * W);
  const { margin, colW, cols, gutter, titleSize, detailSize, showDetail, rowGap, badgeW, perCol, floor } = plan;
  const parts: string[] = [];

  let y = heroPx + px(0.035) + px(T.H2);
  const heading = dense ? "POSITIONS & SALARY" : "POSITIONS";
  parts.push(
    `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${px(T.H2)}" font-weight="700" fill="${NAVY}">${esc(heading)}</text>`,
  );
  parts.push(`<rect x="${margin}" y="${y + px(0.009)}" width="${px(0.075)}" height="3" fill="${GOLD}"/>`);
  y += plan.headingH - px(T.H2) + px(0.012);

  // High Density: a column header rules the table, so a candidate scanning
  // forty roles knows what the right-hand figure means without re-reading.
  if (dense && facts.positions.some((p) => p.salary)) {
    const hs = Math.max(floor, Math.round(px(T.Caption) * 0.85));
    parts.push(
      `<text x="${margin}" y="${y - px(0.004)}" font-family="KaiSans, sans-serif" font-size="${hs}" ` +
        `font-weight="700" fill="${SLATE}" letter-spacing="1">POSITION</text>`,
    );
    parts.push(
      `<text x="${margin + plan.contentW}" y="${y - px(0.004)}" font-family="KaiSans, sans-serif" font-size="${hs}" ` +
        `font-weight="700" fill="${SLATE}" text-anchor="end" letter-spacing="1">MONTHLY SALARY</text>`,
    );
    y += Math.round(hs * 1.2);
  }

  const startY = y;
  for (let c = 0; c < cols; c++) {
    const colX = margin + c * (colW + gutter);
    let cy = startY;
    let rowIndex = c * perCol;
    for (const p of facts.positions.slice(c * perCol, (c + 1) * perCol)) {
      // Each role is a card. SVG paints in document order, so the row's
      // marks are collected first and the card is emitted beneath them
      // once its true height is known.
      const rowParts: string[] = [];
      const rowTop = cy - Math.round(titleSize * 0.92);
      if (p.count != null) {
        const bs = Math.round(titleSize * 0.78);
        rowParts.push(
          `<rect x="${colX}" y="${cy - Math.round(titleSize * 0.82)}" width="${px(0.042)}" height="${Math.round(titleSize * 1.06)}" rx="3" fill="${GOLD}"/>`,
        );
        rowParts.push(
          `<text x="${colX + Math.round(px(0.042) / 2)}" y="${cy - Math.round(titleSize * 0.1)}" font-family="KaiSans, sans-serif" font-size="${bs}" font-weight="700" fill="${NAVY}" text-anchor="middle">${esc(String(p.count))}</text>`,
        );
      }
      const tx = colX + badgeW;
      const tw = colW - badgeW - plan.salaryW;
      // Titles wrap; they are never truncated and never shrunk below the floor.
      const lines = wrap(p.title, tw, titleSize, plan.maxLines);
      const firstBaseline = cy;
      for (const line of lines) {
        const ls = fit(line, tw, titleSize, floor);
        rowParts.push(
          `<text x="${tx}" y="${cy}" font-family="KaiSans, sans-serif" font-size="${ls}" font-weight="600" fill="${NAVY}">${esc(line)}</text>`,
        );
        cy += Math.round(titleSize * plan.lineFactor);
      }
      if (dense && p.salary) {
        // Salary is the conversion driver: promoted to its own right-hand
        // column at title weight, on the row's first baseline.
        const ss = fit(p.salary, plan.salaryW, titleSize, floor, true);
        rowParts.push(
          `<text x="${colX + colW}" y="${firstBaseline}" font-family="KaiSans, sans-serif" ` +
            `font-size="${ss}" font-weight="700" fill="${NAVY}" text-anchor="end">${esc(p.salary)}</text>`,
        );
      }
      if (showDetail) {
        const d = roleDetail(p);
        if (d) {
          const ds = fit(d, tw, detailSize, floor);
          rowParts.push(
            `<text x="${tx}" y="${cy}" font-family="KaiSans, sans-serif" font-size="${ds}" fill="${SLATE}">${esc(d)}</text>`,
          );
          cy += Math.round(detailSize * 1.3);
        }
      }
      // The row fills its own planned space — no extra height is consumed,
      // so density tiers, column planning and capacity checks are unchanged.
      const inset = Math.round(rowGap * 0.3);
      // The row box is the planner's own row height. Deriving it from the
      // drawing cursor made consecutive boxes overlap by ~0.9x titleSize,
      // which is why the separator rules struck through the next row's text.
      const cardH = (plan.rowHeights[rowIndex] ?? cy - rowTop + inset) - 1;
      if (dense) {
        // Modern structured table: zebra banding and a hairline rule, no
        // card chrome. Chrome around forty rows is what makes a page read
        // as a document instead of a campaign.
        if (rowIndex % 2 === 1) {
          parts.push(
            `<rect x="${colX - inset}" y="${rowTop}" width="${colW + inset * 2}" height="${cardH}" fill="${WHITE}" opacity="0.55"/>`,
          );
        }
        parts.push(
          `<rect x="${colX - inset}" y="${rowTop + cardH}" width="${colW + inset * 2}" height="1" fill="${DIVIDER}"/>`,
        );
      } else {
        parts.push(
          `<rect x="${colX - inset}" y="${rowTop}" width="${colW + inset * 2}" height="${cardH}" rx="${px(0.008)}" fill="${WHITE}" stroke="${DIVIDER}" stroke-width="1"/>`,
        );
      }
      parts.push(...rowParts);
      rowIndex++;
      cy += rowGap;
    }
  }

  let sy = startY + plan.listH + px(0.016);

  // Benefits — omitted entirely when absent (KDL §4.5.1).
  if (facts.benefits.length) {
    const text = facts.benefits.map((b) => (b.detail ? `${b.label}: ${b.detail}` : b.label)).join("   ·   ");
    const s = fit(text, plan.contentW, px(T.Caption), floor);
    const barH = Math.round(s * 2.4);
    parts.push(`<rect x="0" y="${sy - Math.round(s * 1.1)}" width="${W}" height="${barH}" fill="${NAVY}"/>`);
    parts.push(
      `<text x="${margin}" y="${sy + Math.round(s * 0.42)}" font-family="KaiSans, sans-serif" font-size="${s}" fill="${GOLD}">${esc(text)}</text>`,
    );
    sy += Math.round(s * 2.7);
  }

  // Interview — omitted entirely when absent.
  const ev = facts.interview[0];
  if (ev) {
    const detail = [ev.date, ev.location].filter(Boolean).join(" · ");
    if (detail) {
      const s = fit(`INTERVIEW   ${detail}`, plan.contentW, px(T.Caption), floor);
      parts.push(
        `<text x="${margin}" y="${sy + Math.round(s * 1.1)}" font-family="KaiSans, sans-serif" font-size="${s}" font-weight="700" fill="${NAVY}">INTERVIEW</text>`,
      );
      parts.push(
        `<text x="${margin + Math.round(textWidth("INTERVIEW   ", s))}" y="${sy + Math.round(s * 1.1)}" font-family="KaiSans, sans-serif" font-size="${s}" fill="${SLATE}">${esc(detail)}</text>`,
      );
    }
  }

  return parts.join("");
}
