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
 * Ink. Colour is KDL. Single-ink is what a newspaper actually prints: one
 * black plate on newsprint, tints achieved by halftone screen rather than
 * by a second colour. Greyscaling a colour render is not the same thing —
 * it turns gold into a muddy mid-grey with no contrast against cream.
 *
 * This is a palette substitution, not a second rendering path: the same
 * marks are drawn either way.
 */
export type AdInk = "COLOUR" | "SINGLE_INK";

interface Palette {
  /** Bars, rules, headings. */
  ink: string;
  /** The strap and the vacancy-count cell. */
  accent: string;
  /** Text sitting on `accent`. */
  accentText: string;
  /** Secondary detail text. */
  muted: string;
  /** Paper. */
  paper: string;
  /** Alternating row band. */
  tint: string;
  /** Hairlines. */
  rule: string;
  /** Text sitting on `ink`. */
  reversed: string;
}

const COLOUR_PALETTE: Palette = {
  ink: NAVY, accent: GOLD, accentText: NAVY, muted: SLATE,
  paper: WHITE, tint: "#F3EEE3", rule: DIVIDER, reversed: WHITE,
};

/** 100% / 15% / 0% of one black plate — the three tones newsprint gives you. */
const SINGLE_INK_PALETTE: Palette = {
  ink: "#000000", accent: "#000000", accentText: "#FFFFFF", muted: "#333333",
  paper: "#FFFFFF", tint: "#E4E4E4", rule: "#000000", reversed: "#FFFFFF",
};

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
export type AdTheme = "PREMIUM_CAMPAIGN" | "AAT_DTP";

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
export function selectTheme(
  facts: AdvertisementFacts,
  override?: AdTheme | null,
  intent?: { printOrNewspaper?: boolean } | null,
): ThemeSelection {
  if (override) {
    return { theme: override, reason: "The recruiter selected this theme.", fromOverride: true };
  }

  // An explicit print or newspaper destination decides it outright — a
  // campaign layout is the wrong artefact for a newsprint column.
  if (intent?.printOrNewspaper) {
    return {
      theme: "AAT_DTP",
      reason: "This advertisement is destined for print or newspaper circulation.",
      fromOverride: false,
    };
  }

  const roles = facts.positions.length;
  if (roles > 15) {
    return {
      theme: "AAT_DTP",
      reason: `${roles} positions — a ruled table carries them legibly; a campaign layout could not.`,
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

/**
 * A single stated salary, allowed ONLY when every role carries the SAME
 * one.
 *
 * An earlier version printed the minimum and maximum as a range whenever
 * the slot was tight. That merged genuinely different salaries into one
 * figure, and a candidate reading it could not tell which role paid what \u2014
 * a factual defect, not a layout economy. When salaries differ the column
 * stays and the advertisement fails on capacity instead.
 */
function sharedSalaryLabel(facts: AdvertisementFacts): string | null {
  const stated = facts.positions.map((p) => p.salary?.trim()).filter((v): v is string => Boolean(v));
  if (stated.length === 0) return null;
  // A salary stated for some roles but not others is not shared.
  if (stated.length !== facts.positions.length) return null;
  const distinct = new Set(stated.map((v) => v.replace(/\s+/g, " ").toUpperCase()));
  return distinct.size === 1 ? stated[0] : null;
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
  /**
   * Output resolution. Supplied for print, where the legibility floor must
   * be a PHYSICAL size: the floor is otherwise a fraction of canvas width,
   * so a narrow newspaper column rendered type at under 2pt and reported
   * that it fitted ninety roles.
   */
  dpi?: number;
  /** Recruiter override. Omitted means KAI selects the theme itself. */
  theme?: AdTheme | null;
  /** Explicit print / newspaper destination — forces the AAT/DTP language. */
  printOrNewspaper?: boolean;
  /** Ink. Single-ink is one black plate, the way a newspaper prints. */
  ink?: AdInk;
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
function planBody(facts: AdvertisementFacts, tier: Tier, W: number, dense = false, forceCols?: number, suppressSalaryCol = false, dpi?: number) {
  const px = (f: number) => Math.round(f * W);
  const margin = px(MARGIN);
  const contentW = W - margin * 2;
  const gutter = px(GUTTER);
  // 7pt is the smallest a Gulf recruitment classified sets a trade name.
  // Below it the advertisement is unreadable in print no matter how well
  // it fits.
  const MIN_PRINT_PT = 7;
  const floor = Math.max(px(LEGIBILITY_FLOOR), dpi ? Math.round((MIN_PRINT_PT / 72) * dpi) : 0);

  // Never plan below the floor. fit() clamps UP to the floor when drawing,
  // so a tier size smaller than the floor made the planner measure rows at
  // 10px that the renderer then drew at 29px — every print slot overflowed
  // or left white, and a 4.3cm column claimed to hold ninety roles.
  const titleSize = Math.max(floor, tier === "T1" ? px(T.H3) : tier === "T2" ? px(T.BodyL) : px(T.Body));
  const detailSize = Math.max(floor, px(T.Caption));
  const showDetail = tier === "T1" || tier === "T2";
  // T3/T4 tighten the rhythm: past a dozen roles the list is scanned, not read.
  const rowGap = px(tier === "T1" ? 0.02 : tier === "T2" ? 0.014 : tier === "T3" ? 0.009 : 0.007);
  const lineFactor = tier === "T4" ? 1.15 : 1.25;
  const badgeW = facts.positions.some((p) => p.count != null) ? px(0.05) : 0;
  // High Density promotes salary into its own right-hand column. That
  // width must be reserved before titles are wrapped, or a long title
  // wraps as if it owned the full measure and then collides with the figure.
  const hasSalary = dense && !suppressSalaryCol && facts.positions.some((p) => p.salary);

  // A long title wraps inside its column; it never truncates and never
  // collapses the grid. Only a title that still needs more than MAX_LINES
  // at the floor forces a narrower column count.
  const MAX_LINES = 3;
  // The salary gutter is a fraction of its OWN column, not of the page.
  // Taken off the full measure it reserved the same wide gutter in every
  // column, which at four columns left 62px for a job title and forced the
  // grid to collapse back to two.
  let cols = forceCols ?? maxColumnsFor(tier);
  let colW = Math.round((contentW - gutter * (cols - 1)) / cols);
  // Reserve what the widest salary genuinely measures at the floor, using
  // the same metric the renderer draws with. A flat fraction of the column
  // reserved 86px for a figure that renders 158px wide, so salaries ran
  // straight through the job titles at five columns.
  const salaryNeed = hasSalary
    ? Math.ceil(Math.max(...facts.positions.map((p) => (p.salary ? textWidth(p.salary, floor, true) : 0))))
    : 0;
  let salaryW = hasSalary ? Math.max(Math.round(colW * 0.34), salaryNeed + Math.round(gutter / 2)) : 0;
  // A column must be wide enough for the widest UNBREAKABLE word. Testing
  // line count alone was not enough: with the badge and salary reserved, the
  // width left for a title could go negative and a two-word title still
  // reported "2 lines", so the grid never collapsed and the salary figures
  // printed straight through the job titles.
  const widestWord = Math.ceil(
    Math.max(
      ...facts.positions.flatMap((p) => p.title.split(/\s+/).map((w) => textWidth(w, floor, true))),
      0,
    ),
  );
  const titleFits = () => {
    const avail = colW - badgeW - salaryW;
    return avail >= widestWord &&
      !facts.positions.some((p) => wrapLines(p.title, avail, floor).length > MAX_LINES);
  };
  while (cols > 1 && !titleFits()) {
    cols -= 1;
    colW = Math.round((contentW - gutter * (cols - 1)) / cols);
    salaryW = hasSalary ? Math.max(Math.round(colW * 0.34), salaryNeed + Math.round(gutter / 2)) : 0;
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
  // Must match what renderBody actually draws, or the canvas-height solve
  // under-reserves and the real content overruns the branding strip below
  // it. Premium's benefits are an icon-led bar (KDL trust/icon rebuild),
  // materially taller than High Density's single caption line.
  const extraH = dense
    ? (facts.benefits.length ? Math.round(px(T.Caption) * 2.6) : 0) +
      (facts.interview.length ? Math.round(px(T.Caption) * 2.8) : 0)
    : (facts.benefits.length ? Math.round(px(0.052) * 2) + px(0.02) : 0) +
      (facts.interview.length ? Math.round(px(T.Caption) * 2.2) : 0);

  return {
    cols, colW, margin, contentW, gutter, titleSize, detailSize, showDetail,
    rowGap, badgeW, salaryW, hasSalary, perCol, rowH, rowHeights, listH, headingH, extraH, floor, lineFactor,
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
function planHero(facts: AdvertisementFacts, W: number, dpi?: number) {
  const px = (f: number) => Math.round(f * W);
  const contentW = W - px(MARGIN) * 2;
  // 7pt is the smallest a Gulf recruitment classified sets a trade name.
  // Below it the advertisement is unreadable in print no matter how well
  // it fits.
  const MIN_PRINT_PT = 7;
  const floor = Math.max(px(LEGIBILITY_FLOOR), dpi ? Math.round((MIN_PRINT_PT / 72) * dpi) : 0);

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
  // Reserves the ribbon banner drawn above the headline in the Premium
  // composition (dense ignores this — it never draws a ribbon). Omitting
  // it under-reserved the hero by exactly the ribbon's height, and the
  // real content ran past the branding strip below it.
  const ribbonH = Math.round(px(T.Caption) * 2.1);
  const ribbonReserve = px(0.02) + ribbonH + px(0.045);

  const h =
    ribbonReserve +
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

/**
 * The verified vacancy count as a hero-scale graphic, not a caption. Real
 * LLM-composed recruitment ads make the number the dominant visual element
 * ("100 NOS", "20 VACANCIES") rather than a small pill — this is the exact
 * fact `headlineCountLabel` already computes, split so it can be set at
 * display size with its unit beneath it.
 */
function heroNumeral(facts: AdvertisementFacts): { num: string; caption: string } | null {
  const roles = facts.positions.length;
  if (roles === 0) return null;
  const allCounted = roles > 0 && facts.positions.every((p) => typeof p.count === "number");
  if (allCounted) {
    const vacancies = facts.positions.reduce((sum, p) => sum + (p.count ?? 0), 0);
    if (vacancies > 0) return { num: String(vacancies), caption: vacancies === 1 ? "VACANCY" : "VACANCIES" };
  }
  return { num: String(roles), caption: roles === 1 ? "POSITION" : "POSITIONS" };
}

/** A notched ribbon/flag shape — a banner cut, not a rounded pill. */
function ribbonPath(x: number, y: number, w: number, h: number, notchOnRight: boolean): string {
  const n = Math.round(h * 0.55);
  return notchOnRight
    ? `M ${x} ${y} L ${x + w} ${y} L ${x + w - n} ${y + h / 2} L ${x + w} ${y + h} L ${x} ${y + h} Z`
    : `M ${x + n} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x + n} ${y + h} L ${x} ${y + h / 2} Z`;
}

type IconKind = "food" | "bed" | "medical" | "flight" | "phone" | "chat" | "check" | "calendar" | "briefcase" | "star";

/**
 * A small, self-contained icon system — plain strokes and fills only, no
 * external glyphs or fonts, so it rasterizes identically anywhere this
 * engine runs. Real social-media recruitment ads lean on iconography to
 * scan benefits at a glance; a bullet-joined caption string does not.
 */
function iconGlyph(kind: IconKind, cx: number, cy: number, r: number, color: string): string {
  const s = r;
  const sw = Math.max(1, r * 0.16);
  switch (kind) {
    case "food":
      return (
        `<g stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
        `<line x1="${cx - s * 0.55}" y1="${cy - s * 0.75}" x2="${cx - s * 0.55}" y2="${cy + s * 0.75}"/>` +
        `<line x1="${cx - s * 0.75}" y1="${cy - s * 0.75}" x2="${cx - s * 0.75}" y2="${cy - s * 0.1}"/>` +
        `<line x1="${cx - s * 0.35}" y1="${cy - s * 0.75}" x2="${cx - s * 0.35}" y2="${cy - s * 0.1}"/>` +
        `<path d="M ${cx + s * 0.35} ${cy - s * 0.75} q ${s * 0.4} ${s * 0.35} 0 ${s * 0.7} l 0 ${s * 0.8}"/>` +
        `</g>`
      );
    case "bed":
      return (
        `<g stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M ${cx - s * 0.85} ${cy + s * 0.65} L ${cx - s * 0.85} ${cy - s * 0.15} L ${cx + s * 0.85} ${cy - s * 0.15} L ${cx + s * 0.85} ${cy + s * 0.65}"/>` +
        `<line x1="${cx - s * 0.85}" y1="${cy + s * 0.15}" x2="${cx + s * 0.85}" y2="${cy + s * 0.15}"/>` +
        `<circle cx="${cx - s * 0.5}" cy="${cy - s * 0}" r="${s * 0.18}" fill="${color}" stroke="none"/>` +
        `</g>`
      );
    case "medical":
      return (
        `<g fill="${color}">` +
        `<rect x="${cx - s * 0.18}" y="${cy - s * 0.75}" width="${s * 0.36}" height="${s * 1.5}" rx="${s * 0.08}"/>` +
        `<rect x="${cx - s * 0.75}" y="${cy - s * 0.18}" width="${s * 1.5}" height="${s * 0.36}" rx="${s * 0.08}"/>` +
        `</g>`
      );
    case "flight":
      return (
        `<g fill="${color}">` +
        `<path d="M ${cx - s * 0.9} ${cy + s * 0.2} L ${cx - s * 0.05} ${cy - s * 0.05} L ${cx + s * 0.2} ${cy - s * 0.85} ` +
        `L ${cx + s * 0.42} ${cy - s * 0.8} L ${cx + s * 0.32} ${cy - s * 0.02} L ${cx + s * 0.9} ${cy + s * 0.28} ` +
        `L ${cx + s * 0.9} ${cy + s * 0.48} L ${cx + s * 0.28} ${cy + s * 0.26} L ${cx + s * 0.14} ${cy + s * 0.75} ` +
        `L ${cx + s * 0.36} ${cy + s * 0.85} L ${cx + s * 0.36} ${cy + s * 1.0} L ${cx - s * 0.34} ${cy + s * 0.85} ` +
        `L ${cx - s * 0.12} ${cy + s * 0.75} L ${cx - s * 0.26} ${cy + s * 0.26} L ${cx - s * 0.9} ${cy + s * 0.48} Z"/>` +
        `</g>`
      );
    case "phone":
      return (
        `<g fill="${color}">` +
        `<path d="M ${cx - s * 0.65} ${cy - s * 0.85} q ${s * 0.35} -${s * 0.15} ${s * 0.55} ${s * 0.1} ` +
        `l ${s * 0.18} ${s * 0.32} q ${s * 0.08} ${s * 0.15} -${s * 0.05} ${s * 0.25} l -${s * 0.18} ${s * 0.16} ` +
        `q ${s * 0.2} ${s * 0.42} ${s * 0.55} ${s * 0.62} l ${s * 0.2} -${s * 0.14} q ${s * 0.1} -${s * 0.08} ${s * 0.24} -${s * 0.02} ` +
        `l ${s * 0.32} ${s * 0.2} q ${s * 0.12} ${s * 0.08} ${s * 0.03} ${s * 0.22} q -${s * 0.25} ${s * 0.4} -${s * 0.7} ${s * 0.28} ` +
        `q -${s * 0.75} -${s * 0.2} -${s * 1.15} -${s * 0.9} q -${s * 0.3} -${s * 0.55} -${s * 0.08} -${s * 0.9} Z"/>` +
        `</g>`
      );
    case "chat":
      return (
        `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round">` +
        `<path d="M ${cx - s * 0.85} ${cy - s * 0.55} h ${s * 1.7} a ${s * 0.2} ${s * 0.2} 0 0 1 ${s * 0.2} ${s * 0.2} v ${s * 0.6} ` +
        `a ${s * 0.2} ${s * 0.2} 0 0 1 -${s * 0.2} ${s * 0.2} h -${s * 1.1} l -${s * 0.35} ${s * 0.35} v -${s * 0.35} h -${s * 0.25} ` +
        `a ${s * 0.2} ${s * 0.2} 0 0 1 -${s * 0.2} -${s * 0.2} v -${s * 0.6} a ${s * 0.2} ${s * 0.2} 0 0 1 ${s * 0.2} -${s * 0.2} Z"/>` +
        `</g>`
      );
    case "check":
      return (
        `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">` +
        `<circle cx="${cx}" cy="${cy}" r="${s}" stroke-width="${Math.max(1.5, r * 0.14)}"/>` +
        `<path d="M ${cx - s * 0.45} ${cy} l ${s * 0.3} ${s * 0.32} l ${s * 0.55} -${s * 0.6}" stroke-width="${Math.max(1.5, r * 0.2)}"/>` +
        `</g>`
      );
    case "calendar":
      return (
        `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round">` +
        `<rect x="${cx - s * 0.85}" y="${cy - s * 0.65}" width="${s * 1.7}" height="${s * 1.5}" rx="${s * 0.15}"/>` +
        `<line x1="${cx - s * 0.85}" y1="${cy - s * 0.15}" x2="${cx + s * 0.85}" y2="${cy - s * 0.15}"/>` +
        `<line x1="${cx - s * 0.45}" y1="${cy - s * 0.9}" x2="${cx - s * 0.45}" y2="${cy - s * 0.45}"/>` +
        `<line x1="${cx + s * 0.45}" y1="${cy - s * 0.9}" x2="${cx + s * 0.45}" y2="${cy - s * 0.45}"/>` +
        `</g>`
      );
    case "briefcase":
      return (
        `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round">` +
        `<rect x="${cx - s * 0.9}" y="${cy - s * 0.4}" width="${s * 1.8}" height="${s * 1.2}" rx="${s * 0.1}"/>` +
        `<path d="M ${cx - s * 0.35} ${cy - s * 0.4} v -${s * 0.25} a ${s * 0.15} ${s * 0.15} 0 0 1 ${s * 0.15} -${s * 0.15} ` +
        `h ${s * 0.4} a ${s * 0.15} ${s * 0.15} 0 0 1 ${s * 0.15} ${s * 0.15} v ${s * 0.25}"/>` +
        `</g>`
      );
    case "star":
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${s * 0.35}" fill="${color}"/>`;
  }
}

function benefitIconKind(label: string): IconKind {
  const l = label.toLowerCase();
  if (/food|meal|catering/.test(l)) return "food";
  if (/accommodat|housing|stay|room/.test(l)) return "bed";
  if (/medical|insurance|health/.test(l)) return "medical";
  if (/flight|ticket|air\s?fare/.test(l)) return "flight";
  if (/visa/.test(l)) return "briefcase";
  if (/transport|bus|pickup/.test(l)) return "briefcase";
  return "star";
}

export async function renderFactLayer(input: FactLayerInput): Promise<FactLayerResult> {
  const { facts, widthPx: W } = input;
  const px = (f: number) => Math.round(f * W);
  const total = facts.positions.length;
  const themeSelection = selectTheme(facts, input.theme, { printOrNewspaper: input.printOrNewspaper });
  const dense = themeSelection.theme === "AAT_DTP";
  const tier = tierFor(total);
  // High Density trades hero height for information: minimal artwork, and
  // the page belongs to the table.
  const heroFrac = dense ? 0.16 : tier === "T1" || tier === "T2" ? 0.42 : 0.3;
  // The hero is capped in absolute terms so a tall directory poster does not
  // spend a third of its height on artwork it does not need.
  const heroCap = Math.round((dense ? 0.3 : tier === "T1" || tier === "T2" ? 0.62 : 0.5) * W);
  let plan = planBody(facts, tier, W, dense, undefined, false, input.dpi);
  const hero = planHero(facts, W, input.dpi);
  const pad = px(0.06);

  // Solve for the canvas height that holds every fact at the floor. The
  // branding strip and the hero are both capped against width, so the
  // relationship is piecewise — settle it with a short fixed-point loop
  // rather than assuming which regime applies.
  const hasContact = Boolean(facts.contact.phone || facts.contact.email);
  // DTP chrome drawn outside the body: agency rule bar, gold strap and the
  // reversed section bar. Invisible to the solve, these once let the last
  // rows of a long table run under the benefits strap and be clipped.
  // Bar heights are width-proportional, which on a short wide slot spent a
  // quarter of the column on chrome before a single role was placed. In a
  // bought slot the bars scale to the depth too.
  const dtpChromeBase = Math.round(W * (0.062 + 0.055 + 0.045));
  const dtpScale = input.printOrNewspaper
    ? Math.min(1, (input.heightPx * 0.13) / dtpChromeBase)
    : 1;
  const dtpChromeH = Math.round(dtpChromeBase * dtpScale);
  // A compact banner height built from the same measured hero fields
  // (headline lines, employer, meta) rather than hero.contentH, which
  // bakes in Premium Campaign's badge and padding that the flat DTP
  // masthead never draws — using it left a large empty band beneath the
  // text, exactly the "unused canvas" defect the flat banner was meant to
  // remove.
  const dtpTextH =
    hero.headlineLines.length * Math.round(hero.headlineSize * 1.06) +
    (hero.employerSize ? Math.round(hero.employerSize * 1.08) : 0) +
    (hero.metaSize ? Math.round(hero.metaSize * 1.25) : 0);
  let dtpMastheadH = Math.round(W * 0.062) + dtpTextH + Math.round(W * 0.03);

  // A newspaper slot is bought at a fixed size. AAT's golden rule is that
  // an advertisement fills its slot exactly — it never overruns it and it
  // never leaves white. So in print mode the height is FIXED: leftover
  // space is distributed back into the rows, and a requirement that cannot
  // fit fails loudly so the agency buys a larger slot instead of receiving
  // an image the paper will reject.
  const fillSlot = Boolean(input.printOrNewspaper);
  const pal: Palette = input.ink === "SINGLE_INK" ? SINGLE_INK_PALETTE : COLOUR_PALETTE;
  let H = input.heightPx;
  for (let i = 0; i < 6; i++) {
    if (fillSlot) break;
    const heroAt = Math.max(
      Math.min(Math.round(heroFrac * H), heroCap),
      Math.min(Math.round(HEADER_H * H), Math.round(0.15 * W)) + hero.contentH,
    );
    const stripAt = brandingStripHeight(W, H, hasContact) + Math.round(0.025 * H);
    // The DTP section bar replaces planBody()'s own heading; counting both
    // left a band of dead white above the contact bar.
    const need = dense
      ? Math.max(input.heightPx, dtpMastheadH + dtpChromeH + (plan.bodyH - plan.headingH) + pad + stripAt)
      : Math.max(input.heightPx, heroAt + plan.bodyH + pad + stripAt);
    if (need <= H) break;
    H = need;
  }

  if (fillSlot) {
    H = input.heightPx;
    const stripFixed = brandingStripHeight(W, H, hasContact);
    // In a bought slot the masthead scales to the column, not the other way
    // round. Sized off width alone it ate an entire 8.5cm slot before a
    // single role was placed. A classified gives at most a quarter of its
    // depth to the headline.
    const mastCap = Math.round(H * 0.22);
    if (dtpMastheadH > mastCap) {
      // Scale only the CONTENT to the budget. Scaling the whole masthead —
      // bar and padding included — left the headline smaller than the box
      // reserved for it, and the difference showed as an empty band.
      const fixed = Math.round(W * 0.062) + Math.round(W * 0.03);
      const contentBudget = Math.max(1, mastCap - fixed);
      const k = Math.min(1, contentBudget / Math.max(1, dtpTextH));
      hero.headlineSize = Math.max(plan.floor, Math.round(hero.headlineSize * k));
      if (hero.employerSize) hero.employerSize = Math.max(plan.floor, Math.round(hero.employerSize * k));
      if (hero.subSize) hero.subSize = Math.max(plan.floor, Math.round(hero.subSize * k));
      if (hero.metaSize) hero.metaSize = Math.max(plan.floor, Math.round(hero.metaSize * k));
      dtpMastheadH = mastCap;
    }
    // A classified fits its slot by adding sub-columns, not by overflowing.
    // AAT's own densest advertisement runs three trade columns inside 6.1cm.
    const chromeFor = (pl: typeof plan) =>
      dtpMastheadH + dtpChromeH + stripFixed + (pl.bodyH - pl.headingH - pl.listH);
    for (let c = plan.cols + 1; c <= 6 && H - chromeFor(plan) < plan.listH; c++) {
      const wider = planBody(facts, tier, W, dense, c, false, input.dpi);
      if (wider.cols !== c) break; // the title stopped fitting; stop widening
      plan = wider;
    }

    // Still short: state the salary ONCE and list bare trades, which is what
    // the paper itself does on a tight slot. Permitted ONLY when every role
    // carries the same salary — merging different figures into one would
    // leave a candidate unable to tell which role pays what, which is a
    // factual defect, not a layout economy. Otherwise the column stays and
    // the advertisement fails on capacity below.
    if (H - chromeFor(plan) < plan.listH && sharedSalaryLabel(facts) !== null) {
      let best = planBody(facts, tier, W, dense, undefined, true, input.dpi);
      for (let c = best.cols + 1; c <= 6 && H - chromeFor(best) < best.listH; c++) {
        const wider = planBody(facts, tier, W, dense, c, true, input.dpi);
        if (wider.cols !== c) break;
        best = wider;
      }
      if (H - chromeFor(best) >= best.listH) plan = best;
    }

    const chrome = chromeFor(plan);
    const available = H - chrome;
    if (available < plan.listH) {
      throw new LayoutCapacityError([
        `${total} positions need ${chrome + plan.listH}px of depth at minimum readability; the booked slot is ` +
          `${H}px. Short by ${plan.listH - available}px — book a taller slot or split the requirement.`,
      ]);
    }
    // Distribute the slack evenly across the rows of the tallest column so
    // the table reaches the trust strip with no white band under it.
    //
    // `available` already has extraH (benefits/interview) budgeted into it
    // via chromeFor(). Handing 100% of (available - listH) to the rows ate
    // that budget too: the table grew tall enough that the benefits strap,
    // drawn immediately after at `startY + listH`, landed past paperH and
    // into the branding strip, where the trust band later painted over it
    // — the strap wasn't clipped, it was silently overwritten. Only the
    // slack beyond extraH's own requirement belongs to the rows.
    const extraH = plan.bodyH - plan.headingH - plan.listH;
    const rowsPerCol = Math.max(1, plan.perCol);
    const add = Math.floor((available - plan.listH - extraH) / rowsPerCol);
    if (add > 0) {
      for (let r = 0; r < plan.rowHeights.length; r++) plan.rowHeights[r] += add;
      plan.listH += add * rowsPerCol;
      plan.bodyH += add * rowsPerCol;
    }
  }

  if (H > W * MAX_ASPECT && !fillSlot) {
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
  if (dense) {
    // The DTP masthead holds its measured content and no more. Donating
    // leftover height to artwork produced a near-empty half-canvas above
    // the table — the opposite of what a classified is for.
    heroPx = fillSlot ? dtpMastheadH : Math.min(dtpMastheadH, heroCap);
  } else {
    // renderBody's actual draw cursor spends more than plan.headingH getting
    // from heroPx to the first row (a fixed offset before the heading and a
    // fixed gap after it) — donating slack computed against bodyH alone
    // measured 46px short of the branding strip on a real render. px(0.08)
    // covers that offset plus a rounding margin.
    const slack = H - strip - heroPx - plan.bodyH - px(0.08);
    if (slack > 0) {
      heroPx = Math.min(heroPx + slack, Math.round(0.55 * H));
    }
  }
  const margin = plan.margin;
  const contentW = plan.contentW;
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];

  // ---- THEME 02 — AAT / DTP composition -------------------------------
  // The trade convention of Gulf recruitment classifieds: a hard outer
  // frame, full-measure reversed banners, ruled tables, every fact boxed.
  // Composition principles only — no masthead, mark or artwork belonging
  // to any publication is reproduced.
  if (dense) {
    const FRAME = Math.max(3, Math.round(W * 0.004));
    const inset = Math.round(W * 0.012);
    const stripHere = brandingStripHeight(W, H, hasContact);
    const paperH = H - stripHere;

    parts.push(`<rect x="0" y="0" width="${W}" height="${paperH}" fill="${pal.paper}"/>`);
    parts.push(
      `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${pal.ink}" stop-opacity="0.55"/>` +
        `<stop offset="1" stop-color="${pal.ink}" stop-opacity="0.30"/>` +
        `</linearGradient></defs>`,
    );
    parts.push(
      `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${paperH - inset * 2}" ` +
        `fill="none" stroke="${pal.ink}" stroke-width="${FRAME}"/>`,
    );

    const edge = inset + FRAME;
    const innerW = W - edge * 2;
    const bandPad = Math.round(W * 0.022);

    // Top rule bar. The agency's identity block — logo, legal name,
    // licence, address — is set once by the branding strip at the foot,
    // the way a classified does it. Repeating the name here printed it
    // three times on one advertisement.
    const barH = Math.round(W * 0.062 * dtpScale);
    parts.push(`<rect x="${edge}" y="${edge}" width="${innerW}" height="${barH}" fill="${pal.ink}"/>`);
    // Destination first — the single strongest filter for a candidate
    // scanning a page of classifieds. "URGENT REQUIREMENT" is stated once,
    // on the strap; printing it here as well said it twice.
    const destination = (facts.country ?? facts.industry ?? "OVERSEAS").toUpperCase();
    const uSize = fit(destination, innerW * 0.55, Math.round(barH * 0.46), plan.floor, true);
    parts.push(
      `<text x="${edge + bandPad}" y="${edge + Math.round(barH * 0.68)}" font-family="KaiSans, sans-serif" ` +
        `font-size="${uSize}" font-weight="700" fill="${pal.reversed}" letter-spacing="3">${esc(destination)}</text>`,
    );
    const interviewBit = facts.interview[0]?.date
      ? `INTERVIEW ${facts.interview[0].date}`
      : facts.raLicenseId ?? "";
    if (interviewBit) {
      const iSize = fit(interviewBit, innerW * 0.42, Math.round(barH * 0.32), plan.floor, true);
      parts.push(
        `<text x="${W - edge - bandPad}" y="${edge + Math.round(barH * 0.66)}" font-family="KaiSans, sans-serif" ` +
          `font-size="${iSize}" font-weight="700" fill="${pal.accentText === "#FFFFFF" ? pal.reversed : pal.accent}" text-anchor="end">${esc(interviewBit.toUpperCase())}</text>`,
      );
    }

    // Masthead. Both real reference advertisements at this density — a
    // 7-row and a 4-row Gulf recruitment classified — carry ZERO
    // photography: every band is flat solid colour, stacked flush, no
    // gradient, no scrim. A photographic hero is a premium/modern
    // technique (Theme 01's job); showing one here was the single biggest
    // tell that Theme 02 was AI-composed rather than DTP-typeset. The
    // masthead is now a flat ink banner, full stop — no artwork input is
    // read or composited into it.
    const mastTop = edge + barH;
    const mastH = Math.max(heroPx - mastTop, Math.round(W * 0.14));
    parts.push(`<rect x="${edge}" y="${mastTop}" width="${innerW}" height="${mastH}" fill="${pal.ink}"/>`);

    const plateTop = mastTop;
    let my = plateTop + Math.round(mastH / 2 - (hero.headlineLines.length - 1) * hero.headlineSize * 0.53);
    for (const l of hero.headlineLines) {
      parts.push(
        `<text x="${Math.round(W / 2)}" y="${my}" font-family="KaiSans, sans-serif" ` +
          `font-size="${hero.headlineSize}" font-weight="800" fill="${pal.reversed}" text-anchor="middle" ` +
          `letter-spacing="-1">${esc(l.toUpperCase())}</text>`,
      );
      my += Math.round(hero.headlineSize * 1.06);
    }
    if (facts.employer && hero.employerSize) {
      parts.push(
        `<text x="${Math.round(W / 2)}" y="${my}" font-family="KaiSans, sans-serif" ` +
          `font-size="${hero.employerSize}" font-weight="700" fill="${pal.accentText === "#FFFFFF" ? pal.reversed : pal.accent}" text-anchor="middle">${esc(facts.employer.toUpperCase())}</text>`,
      );
      my += Math.round(hero.employerSize * 1.08);
    }
    if (hero.meta && hero.metaSize) {
      parts.push(
        `<text x="${Math.round(W / 2)}" y="${my}" font-family="KaiSans, sans-serif" ` +
          `font-size="${hero.metaSize}" fill="${pal.reversed}" text-anchor="middle" opacity="0.85">${esc(hero.meta)}</text>`,
      );
    }

    // Gold strap — the verified count, destination and industry.
    const strapY = mastTop + mastH;
    const strapH = Math.round(W * 0.055 * dtpScale);
    parts.push(`<rect x="${edge}" y="${strapY}" width="${innerW}" height="${strapH}" fill="${pal.accent}"/>`);
    const strapBits = [
      "URGENT REQUIREMENT",
      headlineCountLabel(facts),
      plan.hasSalary ? null : sharedSalaryLabel(facts),
      facts.industry?.toUpperCase(),
    ]
      .filter(Boolean)
      .join("   \u2022   ");
    const strapSize = fit(strapBits, innerW - bandPad * 2, Math.round(strapH * 0.4), plan.floor, true);
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${strapY + Math.round(strapH * 0.66)}" font-family="KaiSans, sans-serif" ` +
        `font-size="${strapSize}" font-weight="700" fill="${pal.accentText}" text-anchor="middle" letter-spacing="1">${esc(strapBits)}</text>`,
    );

    parts.push(renderBody(facts, W, strapY + strapH, plan, true, edge, innerW, dtpScale, pal).svg);
    parts.push(`</svg>`);
    const dtpPng = await sharp(Buffer.from(parts.join(""))).png().toBuffer();
    return { png: dtpPng, heightPx: H, artworkHeightPx: heroPx, themeSelection };
  }

  // Two compositions, not one repeated template — same palette, different
  // seam direction and ribbon corner, so a batch of ads does not read as
  // the same document stamped twice. Deterministic on the facts, so a
  // re-run of the same requirement is still byte-identical.
  const variant = (facts.agencyName.length + facts.positions.length + (facts.header?.length ?? 0)) % 2;

  // ---- Hero scrim (KDL §4.3): a known contrast floor over unknown artwork.
  parts.push(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${NAVY}" stop-opacity="0.94"/>` +
      `<stop offset="0.75" stop-color="${NAVY}" stop-opacity="0.82"/>` +
      `<stop offset="1" stop-color="${NAVY}" stop-opacity="0.35"/>` +
      `</linearGradient></defs>`,
  );
  // A diagonal seam between the photo band and the cream body — a flat
  // horizontal cut is the single strongest "this is a document" tell; a
  // slanted one is what a hero-photo social ad actually does.
  const diag = Math.round(W * 0.055);
  const seamLeft = variant === 0 ? heroPx - diag : heroPx + diag;
  const seamRight = variant === 0 ? heroPx + diag : heroPx - diag;
  const stripH = brandingStripHeight(W, H, hasContact);
  parts.push(
    `<polygon points="0,0 ${W},0 ${W},${seamRight} 0,${seamLeft}" fill="url(#s)"/>`,
  );
  // Body surface: cream, so factual text sits on a known background.
  parts.push(
    `<polygon points="0,${seamLeft} ${W},${seamRight} ${W},${H - stripH} 0,${H - stripH}" fill="#F3EEE3"/>`,
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

  // ---- Ribbon banner (KDL palette only — a cut flag shape, not a pill) ----
  // Marketing copy, not a fact — kept distinct from facts.header so the
  // ribbon never echoes what the headline already states.
  const ribbonText = "HIRING NOW";
  const ribbonH = Math.round(px(T.Caption) * 2.1);
  const ribbonS = fit(ribbonText, Math.round(contentW * 0.34), Math.round(ribbonH * 0.42), plan.floor, true);
  const ribbonW = Math.round(textWidth(ribbonText, ribbonS, true) + px(0.07));
  const ribbonY = headH + px(0.02);
  const ribbonOnRight = variant === 1;
  const ribbonX = ribbonOnRight ? W - margin - ribbonW : margin;
  parts.push(`<path d="${ribbonPath(ribbonX, ribbonY, ribbonW, ribbonH, !ribbonOnRight)}" fill="${GOLD}"/>`);
  parts.push(
    `<text x="${ribbonX + Math.round(ribbonW / 2)}" ` +
      `y="${ribbonY + Math.round(ribbonH * 0.68)}" font-family="KaiSans, sans-serif" font-size="${ribbonS}" ` +
      `font-weight="700" fill="${NAVY}" text-anchor="middle" letter-spacing="1">${esc(ribbonText)}</text>`,
  );

  // ---- Hero text (KDL §4.4 ranks 1–4) — reserves the right edge for the
  // hero numeral so the two never collide. ----
  const numeral = heroNumeral(facts);
  const heroTextW = numeral ? Math.round(contentW * 0.6) : contentW;
  let y = ribbonY + ribbonH + px(0.045);
  for (const l of hero.headlineLines) {
    const ls = Math.min(hero.headlineSize, fit(l, heroTextW, hero.headlineSize, plan.floor, true));
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${ls}" font-weight="800" fill="${WHITE}" letter-spacing="-1">${esc(l)}</text>`,
    );
    y += Math.round(hero.headlineSize * 1.14);
  }
  if (facts.employer && hero.employerSize) {
    y += px(0.01);
    const es = Math.min(hero.employerSize, fit(facts.employer, heroTextW, hero.employerSize, plan.floor, true));
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${es}" font-weight="700" fill="${GOLD}">${esc(facts.employer)}</text>`,
    );
    y += Math.round(hero.employerSize * 1.08);
  }
  if (hero.sub && hero.subSize) {
    y += px(0.006);
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${Math.min(hero.subSize, fit(hero.sub, heroTextW, hero.subSize, plan.floor))}" fill="${WHITE}" opacity="0.9">${esc(hero.sub)}</text>`,
    );
    y += Math.round(hero.subSize * 1.15);
  }
  if (hero.meta && hero.metaSize) {
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${Math.min(hero.metaSize, fit(hero.meta, heroTextW, hero.metaSize, plan.floor))}" fill="${WHITE}" opacity="0.75">${esc(hero.meta)}</text>`,
    );
    y += Math.round(hero.metaSize * 1.3);
  }

  // ---- Hero numeral — the verified count as the dominant graphic, not a
  // caption. This is what a real LLM-composed campaign ad leads with. ----
  if (numeral) {
    const numX = W - margin;
    const numBaseline = Math.min(Math.round(heroPx * 0.86), heroPx - px(0.06));
    const numSize = Math.min(Math.round(W * 0.24), Math.round(heroPx * 0.4));
    const capSize = Math.max(plan.floor, Math.round(numSize * 0.2));
    parts.push(
      `<text x="${numX}" y="${numBaseline}" font-family="KaiSans, sans-serif" font-size="${numSize}" ` +
        `font-weight="800" fill="${GOLD}" text-anchor="end" letter-spacing="-2">${esc(numeral.num)}</text>`,
    );
    parts.push(
      `<text x="${numX}" y="${numBaseline + Math.round(capSize * 1.3)}" font-family="KaiSans, sans-serif" font-size="${capSize}" ` +
        `font-weight="700" fill="${WHITE}" text-anchor="end" letter-spacing="2">${esc(numeral.caption)}</text>`,
    );
  }

  const body = renderBody(facts, W, heroPx, plan, dense, 0, W, 1, pal);
  parts.push(body.svg);

  // ---- Trust callout — fills leftover depth above the branding strip
  // instead of leaving it a dead cream gap, and doubles as a signature/
  // trust element (verified chip + direct contact), which a stamped
  // "document" layout never carried. ----
  const calloutTop = body.endY + px(0.02);
  const calloutBottom = H - stripH - px(0.03);
  if (calloutBottom - calloutTop >= px(0.05)) {
    const boxY = calloutTop;
    const boxH = calloutBottom - calloutTop;
    const boxX = margin;
    const boxW = contentW;
    parts.push(
      `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="${px(0.018)}" ` +
        `fill="${WHITE}" stroke="${NAVY}" stroke-width="2" stroke-dasharray="9 7"/>`,
    );
    const midY = boxY + Math.round(boxH / 2);
    const chipSize = Math.max(plan.floor, Math.round(px(T.Caption) * 0.95));
    const chipR = Math.round(chipSize * 0.6);
    const rowGapV = Math.round(boxH * 0.28);
    const chipY = Math.max(boxY + Math.round(boxH * 0.24), midY - rowGapV);
    parts.push(iconGlyph("check", boxX + px(0.04) + chipR, chipY, chipR, NAVY));
    parts.push(
      `<text x="${boxX + px(0.04) + chipR * 2 + px(0.012)}" y="${chipY + Math.round(chipSize * 0.32)}" ` +
        `font-family="KaiSans, sans-serif" font-size="${chipSize}" font-weight="700" fill="${NAVY}" ` +
        `letter-spacing="1">VERIFIED ADVERTISEMENT</text>`,
    );
    const contactRowY = Math.min(boxY + boxH - Math.round(boxH * 0.24), midY + rowGapV);
    const cSize = Math.max(plan.floor, Math.round(px(T.BodyL)));
    let cx = boxX + px(0.04);
    if (facts.contact.phone) {
      const r = Math.round(cSize * 0.6);
      parts.push(iconGlyph("phone", cx + r, contactRowY, r, NAVY));
      cx += r * 2 + px(0.01);
      parts.push(
        `<text x="${cx}" y="${contactRowY + Math.round(cSize * 0.32)}" font-family="KaiSans, sans-serif" font-size="${cSize}" font-weight="700" fill="${NAVY}">${esc(facts.contact.phone)}</text>`,
      );
      cx += Math.round(textWidth(facts.contact.phone, cSize, true)) + px(0.035);
    }
    if (facts.contact.whatsapp) {
      const r = Math.round(cSize * 0.6);
      parts.push(iconGlyph("chat", cx + r, contactRowY, r, SLATE));
      cx += r * 2 + px(0.01);
      parts.push(
        `<text x="${cx}" y="${contactRowY + Math.round(cSize * 0.32)}" font-family="KaiSans, sans-serif" font-size="${cSize}" fill="${SLATE}">${esc(facts.contact.whatsapp)}</text>`,
      );
    }
  }

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
  edge = 0,
  innerW = W,
  chromeScale = 1,
  pal: Palette = COLOUR_PALETTE,
): { svg: string; endY: number } {
  const px = (f: number) => Math.round(f * W);
  const { colW, cols, gutter, titleSize, detailSize, showDetail, rowGap, badgeW, perCol, floor } = plan;
  const margin = plan.margin;
  const parts: string[] = [];

  let y: number;
  if (dense) {
    // DTP declares a section with a solid bar across the measure, not a
    // heading floating in space.
    const secH = Math.round(W * 0.045 * chromeScale);
    y = heroPx + px(0.012);
    parts.push(`<rect x="${edge}" y="${y}" width="${innerW}" height="${secH}" fill="${pal.ink}"/>`);
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${y + Math.round(secH * 0.68)}" font-family="KaiSans, sans-serif" ` +
        `font-size="${Math.round(secH * 0.44)}" font-weight="700" fill="${pal.reversed}" text-anchor="middle" ` +
        `letter-spacing="3">POSITIONS AVAILABLE</text>`,
    );
    y += secH + px(0.012) + titleSize;
  } else {
    y = heroPx + px(0.035) + px(T.H2);
    parts.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${px(T.H2)}" font-weight="700" fill="${pal.ink}">POSITIONS</text>`,
    );
    parts.push(`<rect x="${margin}" y="${y + px(0.009)}" width="${px(0.075)}" height="3" fill="${pal.accent}"/>`);
    y += plan.headingH - px(T.H2) + px(0.012);
  }

  // High Density: a column header rules the table, so a candidate scanning
  // forty roles knows what the right-hand figure means without re-reading.
  if (dense && plan.hasSalary) {
    const hs = Math.max(floor, Math.round(px(T.Caption) * 0.85));
    parts.push(
      `<text x="${margin}" y="${y - px(0.004)}" font-family="KaiSans, sans-serif" font-size="${hs}" ` +
        `font-weight="700" fill="${pal.muted}" letter-spacing="1">POSITION</text>`,
    );
    parts.push(
      `<text x="${margin + plan.contentW}" y="${y - px(0.004)}" font-family="KaiSans, sans-serif" font-size="${hs}" ` +
        `font-weight="700" fill="${pal.muted}" text-anchor="end" letter-spacing="1">MONTHLY SALARY</text>`,
    );
    y += Math.round(hs * 1.2);
  }

  const startY = y;
  for (let c = 0; c < cols; c++) {
    // Planner and renderer share one column geometry, always.
    const colX = plan.margin + c * (colW + gutter);
    const colWHere = colW;
    let cy = startY;
    // Track the row box explicitly. Deriving rowTop from the drawing cursor
    // and then advancing the cursor to the row's BOTTOM made each row's box
    // drift up by ~0.92x titleSize against its own text — cumulative, so by
    // row nine the vacancy-count cell no longer matched its role.
    let rowTopCursor = startY - Math.round(titleSize * 0.92);
    let rowIndex = c * perCol;
    for (const p of facts.positions.slice(c * perCol, (c + 1) * perCol)) {
      // Each role is a card. SVG paints in document order, so the row's
      // marks are collected first and the card is emitted beneath them
      // once its true height is known.
      const rowParts: string[] = [];
      const rowTop = rowTopCursor;
      cy = rowTop + Math.round(titleSize * 0.92);
      if (p.count != null && !dense) {
        const bs = Math.round(titleSize * 0.78);
        rowParts.push(
          `<rect x="${colX}" y="${cy - Math.round(titleSize * 0.82)}" width="${px(0.042)}" height="${Math.round(titleSize * 1.06)}" rx="3" fill="${pal.accent}"/>`,
        );
        rowParts.push(
          `<text x="${colX + Math.round(px(0.042) / 2)}" y="${cy - Math.round(titleSize * 0.1)}" font-family="KaiSans, sans-serif" font-size="${bs}" font-weight="700" fill="${pal.ink}" text-anchor="middle">${esc(String(p.count))}</text>`,
        );
      }
      if (p.count != null && dense && badgeW > 0) {
        // A plain black numeral, no coloured cell behind it — neither real
        // reference indexes its rows with a filled badge.
        const rh = plan.rowHeights[rowIndex] ?? Math.round(titleSize * 1.6);
        rowParts.push(
          `<text x="${colX + Math.round(badgeW / 2)}" y="${rowTop + Math.round(rh / 2) + Math.round(titleSize * 0.32)}" ` +
            `font-family="KaiSans, sans-serif" font-size="${Math.round(titleSize * 0.82)}" font-weight="700" ` +
            `fill="${pal.ink}" text-anchor="middle">${esc(String(p.count))}</text>`,
        );
      }
      const tx = colX + badgeW + (dense ? Math.round(W * 0.008) : 0);
      const tw = colWHere - badgeW - plan.salaryW;
      // Titles wrap; they are never truncated and never shrunk below the floor.
      // Wrapped and measured on the true text — only the drawn glyphs are
      // uppercased in dense mode, matching how both real classifieds set
      // every trade name in the table.
      const lines = wrap(p.title, tw, titleSize, plan.maxLines);
      const firstBaseline = cy;
      for (const line of lines) {
        const drawn = dense ? line.toUpperCase() : line;
        const ls = fit(drawn, tw, titleSize, floor);
        rowParts.push(
          `<text x="${tx}" y="${cy}" font-family="KaiSans, sans-serif" font-size="${ls}" font-weight="600" fill="${pal.ink}">${esc(drawn)}</text>`,
        );
        cy += Math.round(titleSize * plan.lineFactor);
      }
      if (dense && p.salary && plan.hasSalary) {
        // Salary is the conversion driver: promoted to its own right-hand
        // column at title weight, on the row's first baseline.
        // Role reads first, salary second. Set at the same weight the two
        // competed and the eye had nowhere to land.
        const ss = fit(p.salary, plan.salaryW, Math.round(titleSize * 0.92), floor, false);
        rowParts.push(
          `<text x="${colX + colWHere}" y="${firstBaseline}" font-family="KaiSans, sans-serif" ` +
            `font-size="${ss}" font-weight="600" fill="${pal.muted}" text-anchor="end">${esc(p.salary)}</text>`,
        );
      }
      if (showDetail) {
        const d = roleDetail(p);
        if (d) {
          const ds = fit(d, tw, detailSize, floor);
          rowParts.push(
            `<text x="${tx}" y="${cy}" font-family="KaiSans, sans-serif" font-size="${ds}" fill="${pal.muted}">${esc(d)}</text>`,
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
        // Ruled DTP row: plain paper field, a hairline rule beneath each
        // row, and a hairline dividing the title from the salary figure.
        // Both real Gulf classifieds studied for this composition are
        // built this way — pure ruled rows on white, no card chrome, no
        // alternating tint, no coloured vacancy badge. Colour on a table
        // row is exactly the "AI-designed poster" signature this theme
        // must not have.
        if (plan.hasSalary) {
          parts.push(
            `<rect x="${colX + colWHere - plan.salaryW}" y="${rowTop}" width="1" height="${cardH}" fill="${pal.ink}" opacity="0.4"/>`,
          );
        }
        parts.push(
          `<rect x="${colX}" y="${rowTop + cardH}" width="${colWHere}" height="1" fill="${pal.ink}" opacity="0.5"/>`,
        );
      } else {
        parts.push(
          `<rect x="${colX - inset}" y="${rowTop}" width="${colW + inset * 2}" height="${cardH}" rx="${px(0.008)}" fill="${pal.paper}" stroke="${DIVIDER}" stroke-width="1"/>`,
        );
      }
      parts.push(...rowParts);
      rowTopCursor += plan.rowHeights[rowIndex] ?? cardH + 1;
      rowIndex++;
    }
  }

  let sy = startY + plan.listH + px(0.016);

  // Benefits — omitted entirely when absent (KDL §4.5.1).
  if (facts.benefits.length) {
    if (dense) {
      const text = facts.benefits.map((b) => (b.detail ? `${b.label}: ${b.detail}` : b.label)).join("   ·   ");
      const s = fit(text, plan.contentW, px(T.Caption), floor);
      const barH = Math.round(s * 2.4);
      parts.push(`<rect x="0" y="${sy - Math.round(s * 1.1)}" width="${W}" height="${barH}" fill="${pal.ink}"/>`);
      parts.push(
        `<text x="${margin}" y="${sy + Math.round(s * 0.42)}" font-family="KaiSans, sans-serif" font-size="${s}" fill="${pal.accent}">${esc(text)}</text>`,
      );
      sy += Math.round(s * 2.7);
    } else {
      // Premium: an icon-led benefit row, not a bullet-joined caption. A
      // candidate scanning a feed reads icons before they read words.
      const chipH = px(0.052);
      const iconR = Math.round(chipH * 0.28);
      const gap = px(0.018);
      parts.push(`<rect x="0" y="${sy - Math.round(chipH * 0.72)}" width="${W}" height="${chipH * 2}" fill="${pal.ink}"/>`);
      let bx = margin;
      const rowMidY = sy - Math.round(chipH * 0.72) + chipH;
      for (const b of facts.benefits) {
        const label = b.detail ? `${b.label}: ${b.detail}` : b.label;
        const s = Math.max(floor, Math.round(chipH * 0.34));
        const kind = benefitIconKind(b.label);
        parts.push(iconGlyph(kind, bx + iconR, rowMidY, iconR, pal.accent));
        const tx = bx + iconR * 2 + Math.round(gap * 0.5);
        parts.push(
          `<text x="${tx}" y="${rowMidY + Math.round(s * 0.32)}" font-family="KaiSans, sans-serif" font-size="${s}" font-weight="600" fill="${pal.reversed}">${esc(label)}</text>`,
        );
        bx = tx + Math.round(textWidth(label, s, true)) + gap * 2.2;
        if (bx > margin + plan.contentW * 0.92) break; // never truncates a fact — overflow benefits still verified, just not iconised on this row
      }
      sy += chipH * 2 + px(0.02);
    }
  }

  // Interview — omitted entirely when absent.
  const ev = dense ? undefined : facts.interview[0];
  if (ev) {
    const detail = [ev.date, ev.location].filter(Boolean).join(" · ");
    if (detail) {
      const s = fit(`INTERVIEW   ${detail}`, plan.contentW, px(T.Caption), floor);
      const iconR = Math.round(s * 0.55);
      parts.push(iconGlyph("calendar", margin + iconR, sy + Math.round(s * 0.55), iconR, pal.ink));
      const tx = margin + iconR * 2 + Math.round(px(0.012));
      parts.push(
        `<text x="${tx}" y="${sy + Math.round(s * 1.1)}" font-family="KaiSans, sans-serif" font-size="${s}" font-weight="700" fill="${pal.ink}">INTERVIEW</text>`,
      );
      parts.push(
        `<text x="${tx + Math.round(textWidth("INTERVIEW   ", s))}" y="${sy + Math.round(s * 1.1)}" font-family="KaiSans, sans-serif" font-size="${s}" fill="${pal.muted}">${esc(detail)}</text>`,
      );
      sy += Math.round(s * 2.2);
    }
  }

  return { svg: parts.join(""), endY: sy };
}
