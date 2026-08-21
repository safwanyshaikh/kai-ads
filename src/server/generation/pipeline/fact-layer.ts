import "../font-config"; // FONTCONFIG_FILE must be set before any rasterization
import sharp from "sharp";
import { brandingStripHeight, type FooterContent } from "./branding-overlay";
import { displayTitle } from "@/lib/display-title";
import { roleFamily, roleTextWidth, type TypeRole } from "@/lib/kdl-typography";
import { classifyRoleFamily } from "@/lib/role-families";
import {
  compressPresentation,
  compressSalaryPresentation,
  buildCandidateHeadline,
  buildCandidateCta,
} from "./content-intelligence";
import { isApprovedDtpWidthPx, nearestApprovedDtpSlot, DTP_DEFAULT_DPI } from "@/lib/dtp-format-law";
import type { AdvertisementFacts } from "./types";

/**
 * ============================================================================
 * KAI FACT LAYER — RESTORED
 * ============================================================================
 *
 * This is the deterministic Rendering Engine, ported from the proven
 * implementation on claude/kai-ads-verify-state-upnt70 and adapted to this
 * branch's simpler (non-DNA) AdvertisementFacts/types.ts.
 *
 * The image model supplies background artwork only. Every verified
 * recruitment fact — headline, country, industry, project/employer, exact
 * position names, exact vacancy counts, salary, benefits, interview,
 * campaign contact, and any source-supplied footer note — is drawn here,
 * from structured data, at a known coordinate, at a known size. Nothing is
 * dropped silently: text never shrinks below the legibility floor and
 * titles are never truncated — when a requirement is large the CANVAS
 * GROWS rather than the type shrinking. Only when the canvas would stop
 * being publishable does this throw LayoutCapacityError.
 *
 * This branch has no Design DNA registry (no `dna/` folder — that system
 * lives only on the other branch and is out of scope for this port). One
 * fixed palette/type-scale/layout/motif set is used instead — the same
 * values the proven implementation's default DNA ("PS-01"/"AA-01", the
 * KDL v1.0 shipping defaults) already used. Nothing about the rendering
 * ALGORITHM below was changed; only the pluggable-DNA indirection was
 * removed, since there is nothing on this branch for it to plug into.
 */

/**
 * Colour ROLES. The engine never names a colour; it asks the palette for
 * the role it needs, which is what lets the drawing code below stay a
 * single, unconditional implementation.
 */
export interface DnaPalette {
  /** Bars, rules, headings, primary factual text. */
  ink: string;
  /** Straps, vacancy cells, the hero numeral. */
  accent: string;
  /** Text sitting on `accent`. */
  accentText: string;
  /** Secondary factual text (role detail, salary column). */
  muted: string;
  /** Card and table-field fill. */
  paper: string;
  /** The body surface beneath the hero. */
  surface: string;
  /** Alternating band / soft fill. */
  tint: string;
  /** Hairlines and dividers. */
  rule: string;
  /** Text sitting on `ink`. */
  reversed: string;
}

interface DnaTypeScale {
  D1: number;
  H1: number;
  H2: number;
  H3: number;
  BodyL: number;
  Body: number;
  Caption: number;
}

interface DnaLayout {
  margin: number;
  gutter: number;
  heroFractionSparse: number;
  heroFractionDense: number;
  heroCapSparse: number;
  heroCapDense: number;
  headerHeight: number;
  cornerRadius: number;
  rowGapScale: number;
}

interface DnaMotifs {
  layoutStyle: "POSTER" | "DOCUMENT";
  seam: "DIAGONAL_LEFT" | "DIAGONAL_RIGHT" | "FLAT" | "STEP";
  ribbon: "NOTCHED_LEFT" | "NOTCHED_RIGHT" | "BAR" | "NONE";
  ribbonText: string;
  numeral: "DISPLAY" | "COMPACT" | "NONE";
  rowStyle: "CARD" | "RULED" | "BANDED" | "PLAIN";
  benefitStyle: "ICON_BAR" | "TEXT_STRIP" | "CHIPS";
  heroAlign: "LEFT" | "CENTRE";
  headlineTracking: number;
  uppercaseHeadline: boolean;
  uppercaseTitles: boolean;
  outerFrame: boolean;
  trustCallout: boolean;
}

interface DesignDNA {
  composition: "PREMIUM_CAMPAIGN" | "AAT_DTP";
  palette: DnaPalette;
  type: DnaTypeScale;
  layout: DnaLayout;
  motifs: DnaMotifs;
}

/** KDL v1.0 §3.1 — the KAI palette (Navy/Gold), the engine's shipping default. */
const KDL_PALETTE: DnaPalette = {
  ink: "#0B1F33",
  accent: "#F3D98B",
  accentText: "#0B1F33",
  muted: "#4A5A6C",
  paper: "#FFFFFF",
  surface: "#F3EEE3",
  tint: "#EDE6D8",
  rule: "#C9C0AB",
  reversed: "#FFFFFF",
};

/** KDL v1.0 §3.2 — the engine's shipping type scale, as fractions of canvas width. */
const KDL_TYPE: DnaTypeScale = {
  D1: 0.072,
  H1: 0.052,
  H2: 0.038,
  H3: 0.028,
  BodyL: 0.024,
  Body: 0.02,
  Caption: 0.016,
};

/** KDL v1.0 §2, §4 — the engine's shipping geometry. */
const KDL_LAYOUT: DnaLayout = {
  margin: 0.065,
  gutter: 0.02,
  heroFractionSparse: 0.42,
  heroFractionDense: 0.3,
  heroCapSparse: 0.62,
  heroCapDense: 0.5,
  headerHeight: 0.11,
  cornerRadius: 0.008,
  rowGapScale: 1,
};

const KDL_MOTIFS: DnaMotifs = {
  layoutStyle: "POSTER",
  seam: "DIAGONAL_LEFT",
  ribbon: "NOTCHED_LEFT",
  ribbonText: "HIRING NOW",
  numeral: "NONE",
  rowStyle: "CARD",
  benefitStyle: "ICON_BAR",
  heroAlign: "LEFT",
  headlineTracking: -1,
  uppercaseHeadline: true,
  uppercaseTitles: false,
  outerFrame: false,
  trustCallout: true,
};

/** The engine's shipping motifs for the classified/print composition. */
const KDL_DTP_MOTIFS: DnaMotifs = {
  layoutStyle: "DOCUMENT",
  seam: "FLAT",
  ribbon: "NONE",
  ribbonText: "",
  numeral: "NONE",
  rowStyle: "RULED",
  benefitStyle: "TEXT_STRIP",
  heroAlign: "CENTRE",
  headlineTracking: -1,
  uppercaseHeadline: true,
  uppercaseTitles: true,
  outerFrame: true,
  trustCallout: false,
};

/** The one social/campaign composition this branch renders in. */
const PREMIUM_DNA: DesignDNA = {
  composition: "PREMIUM_CAMPAIGN",
  palette: KDL_PALETTE,
  type: KDL_TYPE,
  layout: KDL_LAYOUT,
  motifs: KDL_MOTIFS,
};

/**
 * Kept for a caller that sets `printOrNewspaper` — proven, unmodified
 * DTP/classified composition logic (see the `dense` branch below). Not
 * wired to anything on this branch today; retained because removing a
 * working, already-solved code path would not be a smaller change than
 * keeping it, and a future print destination gets it for free.
 */
const DTP_DNA: DesignDNA = {
  composition: "AAT_DTP",
  palette: KDL_PALETTE,
  type: KDL_TYPE,
  layout: KDL_LAYOUT,
  motifs: KDL_DTP_MOTIFS,
};

/**
 * KDL §3.2 — no factual text renders below this fraction of W. This is
 * what makes "no verified fact is ever omitted" a true statement rather
 * than an aspiration.
 */
const LEGIBILITY_FLOOR = 0.016;

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

/**
 * The engine never names a colour; it asks the palette for the ROLE it
 * needs, which is what lets one renderer wear the campaign and classified
 * compositions without a single conditional on colour.
 */
type Palette = DnaPalette;

/**
 * KDL §4 — the branding strip owns the bottom of the canvas. Its exact
 * height comes from the Rendering Engine itself (brandingStripHeight), so
 * the two can never drift apart; this fraction is the fallback bound used
 * when solving for canvas height.
 */
const RESERVED_TOP = 0.8;
void RESERVED_TOP;

/**
 * Type scale, grid and hero proportions all come from the Design DNA now
 * (`dna.type`, `dna.layout`). The legibility floor does NOT: a DNA may
 * make type larger but can never make a fact smaller than a candidate can
 * read, because that floor is what makes "no verified fact is ever
 * omitted" a true statement rather than an aspiration.
 */

/**
 * Taller than this stops being publishable. A bulk drive of 100+ roles is
 * legitimately a tall poster (and prints/PDFs fine); beyond 4:1 it stops
 * being usable on a feed, and that is a real capacity limit, not a
 * licence to drop roles.
 */
const MAX_ASPECT = 4.0;

/**
 * The most of an advertisement's HEIGHT the POSTER artwork band may take.
 *
 * The band is specified as a fraction of width (0.34W), which is correct
 * for a tall dense canvas and badly wrong for a short one, where it
 * silently became 35-40% of the whole advertisement. Content decides the
 * canvas; this stops decoration from deciding it instead.
 */
const POSTER_ARTWORK_MAX_FRACTION = 0.22;

/**
 * `reason` distinguishes WHERE capacity ran out, for callers that want to
 * react differently (e.g. surface "book a taller slot" vs "this campaign
 * is too broad to compress into one advertisement"). `undefined` is the
 * original, pre-existing meaning: fact-layer's own height/aspect solve
 * ran out of room. `"content-exceeds-max-tier"` is raised by the DTP
 * Decision Engine's pre-flight check (content-intelligence.ts) before a
 * Gemini call is even spent — same error, same law, earlier stage.
 */
export type LayoutCapacityReason =
  | "content-exceeds-max-tier"
  | "social-feed-exceeds-max-height"
  | undefined;

export class LayoutCapacityError extends Error {
  readonly code = "LAYOUT_CAPACITY";
  constructor(
    readonly unplaced: string[],
    readonly reason?: LayoutCapacityReason,
  ) {
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
 * Recruiters never choose a theme. KAI reads the DESTINATION of the
 * advertisement — social/campaign, or an explicit print/newspaper slot —
 * never the position count. A social recruitment advertisement keeps its
 * Gemini visual hero regardless of how many roles it carries; role count
 * affects density (tier, columns, canvas height — see planBody/planHero),
 * never whether the hero exists at all. AAT_DTP (the photography-free
 * classified composition) is reachable ONLY through an explicit
 * printOrNewspaper destination or an explicit override — never inferred
 * from role count, which previously stripped the hero off any campaign
 * with more than 15 roles.
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
  return {
    theme: "PREMIUM_CAMPAIGN",
    reason:
      roles <= 3
        ? `${roles} position${roles === 1 ? "" : "s"} — a hero-led campaign gives each role full weight.`
        : `${roles} positions — a campaign layout keeps the Gemini visual hero while holding every role.`,
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
 * KDL typography roles come from the ONE shared registry in
 * src/lib/kdl-typography.ts (Final Production Lock §24) — both this
 * renderer and the trust footer read the same families and the same
 * measured advance-width factors, so a role can never mean two
 * different widths in two places.
 */
const textWidth = roleTextWidth;


/**
 * A thin ink stroke behind a text fill — the same technique proven on the
 * POSTER headline (LOCK 2): a scrim guarantees legibility for the whole
 * panel at once, but this composition's panel scrim is now much lighter
 * (LOCK 2's zoned target: 0.25-0.60, well under what a flat scrim would
 * need to guarantee contrast against an unknown bright photo on its own).
 * Every other panel text element gets its own scrim-independent contrast
 * guarantee via this same outline, rather than relying on panel opacity
 * to protect all of them. Never a typography change — same font, weight,
 * size and tracking wherever it's applied.
 */
const textStroke = (inkColor: string, fontSize: number) =>
  `stroke="${inkColor}" stroke-width="${Math.max(1, Math.round(fontSize * 0.045))}" stroke-linejoin="round" paint-order="stroke fill"`;

function fit(text: string, maxWidth: number, preferred: number, min: number, role: TypeRole = "BASE"): number {
  let size = preferred;
  while (size > min && textWidth(text, size, role) > maxWidth) size -= 1;
  return Math.max(size, min);
}

/** All wrapped lines, uncapped — used both to measure and to draw. */
function wrapLines(text: string, maxWidth: number, size: number, role: TypeRole = "BASE"): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, size, role) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function wrap(text: string, maxWidth: number, size: number, maxLines: number, role: TypeRole = "BASE"): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, size, role) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

/**
 * The exact single string the POSTER composition typesets for one role.
 *
 * The vacancy count is folded into the wrapped title rather than set as a
 * separate badge, so it can never be silently dropped. That makes the
 * drawn string LONGER than the stored title, which is precisely why this
 * lives in one shared function: planBody measures this string and
 * renderPosterBody draws this string. When the planner measured the bare
 * title while the renderer drew the title plus "(N NOS)", a role whose
 * title fitted on one line but whose title-plus-count needed two wrapped
 * into a second line the row box never reserved — and that second line
 * printed straight through the role beneath it.
 */
function posterRoleLine(p: AdvertisementFacts["positions"][number]): string {
  const title = displayTitle(p.title).toUpperCase();
  return p.count != null ? `${title} (${p.count} NOS)` : title;
}

/**
 * Splits row indices into `cols` columns, in strict source order — never
 * jumping a role out of sequence — but choosing each split point by
 * cumulative HEIGHT rather than a fixed item count. A count-only split
 * (ceil(n/cols) per column) put a title that happened to wrap onto two
 * lines in one column and not the other, so that column ran visibly
 * taller than its neighbour and the shorter column left a real, empty
 * gap above the trust strip that nothing else filled — measured at 92px
 * between the two columns' last rows on the real 19-role requirement.
 * Each column boundary is still picked greedily left-to-right (the
 * reading order every reference recruitment column uses), just balanced
 * against the actual height of what's being placed, recomputing the
 * target from the height still remaining so an early heavy item can't
 * starve every column after it.
 */
export function splitColumnsByHeight(rowHeights: number[], cols: number): number[][] {
  const n = rowHeights.length;
  if (n === 0) return Array.from({ length: cols }, () => []);
  if (cols <= 1) return [Array.from({ length: n }, (_, i) => i)];

  // Classic "split an array into K contiguous parts, minimizing the
  // tallest part" (binary search on the answer + a greedy feasibility
  // check) — provably optimal, unlike a single-pass local comparison,
  // which can commit to including one disproportionately tall row (a
  // wrapped title) because it looked closer to a per-column target in
  // isolation, then have nothing left to rebalance the columns after it.
  const total = rowHeights.reduce((a, b) => a + b, 0);
  const tallestRow = Math.max(...rowHeights);

  const columnsNeededFor = (limit: number): number => {
    let count = 1;
    let sum = 0;
    for (const h of rowHeights) {
      if (sum + h > limit) {
        count++;
        sum = h;
      } else {
        sum += h;
      }
    }
    return count;
  };

  let lo = tallestRow;
  let hi = total;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (columnsNeededFor(mid) <= cols) hi = mid;
    else lo = mid + 1;
  }

  // `lo` is now the minimum possible height for the tallest column.
  // Materialize the actual row groups with one more greedy pass at that
  // bound — deterministic, and always in strict source order.
  const columns: number[][] = [];
  let current: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const h = rowHeights[i];
    if (sum + h > lo && current.length > 0) {
      columns.push(current);
      current = [];
      sum = 0;
    }
    current.push(i);
    sum += h;
  }
  if (current.length > 0) columns.push(current);

  // The optimal-max split can legitimately need fewer than `cols` groups
  // (e.g. one dominant row already sets the achievable max on its own) —
  // correct for minimizing height, but a rendered grid with an entirely
  // empty trailing column looks broken. When there are enough rows to
  // give every requested column at least one, split the largest group by
  // row COUNT (not re-optimizing height) until every column is filled;
  // this only ever fires on the rare extreme case the height-optimal
  // pass didn't already need `cols` groups for.
  while (columns.length < cols && n >= cols) {
    let biggest = 0;
    for (let c = 1; c < columns.length; c++) {
      if (columns[c].length > columns[biggest].length) biggest = c;
    }
    if (columns[biggest].length < 2) break;
    const mid = Math.ceil(columns[biggest].length / 2);
    const second = columns[biggest].splice(mid);
    columns.splice(biggest + 1, 0, second);
  }
  while (columns.length < cols) columns.push([]);
  return columns;
}

/** Detail string for one role — only ever built from values that are present. */
function roleDetail(
  p: AdvertisementFacts["positions"][number],
  /**
   * Statements already displayed once for the whole role family (its
   * "Common requirement" line). Repeating them under every member is
   * the exact duplication family grouping exists to remove — it costs
   * height the Social Feed ceiling cannot spare and reads as a stutter.
   * Never an omission: the statement is still on the advertisement,
   * stated once for the family instead of N times.
   */
  alreadyShown?: ReadonlySet<string>,
): string {
  const shown = (v: string) => alreadyShown?.has(v.trim().toLowerCase()) ?? false;
  const bits: string[] = [];
  // §6: PRESENTATION is compressed, FACTS are not. Experience and
  // qualification wording is abbreviated to an exact equivalent;
  // certifications are never reworded. Salary is reformatted for digit
  // grouping only (compressSalaryPresentation never merges two roles'
  // ranges — see that function's own contract).
  if (p.experience && !shown(p.experience)) bits.push(compressPresentation(p.experience));
  // Destination-market experience is a SEPARATE verified requirement
  // from total experience, and is labelled so a candidate can tell the
  // two apart. Its mandatory/preferred nuance is carried verbatim —
  // "Not Mandatory" must never read as a hard requirement.
  if (p.gulfExperience && !shown(p.gulfExperience)) {
    const g = p.gulfExperience.trim();
    bits.push(/mandator|preferred|optional/i.test(g) ? `Gulf/Aramco exp. ${g}` : `${compressPresentation(g)} Gulf/Aramco`);
  }
  if (p.salary) bits.push(compressSalaryPresentation(p.salary));
  if (p.qualification && !shown(p.qualification)) bits.push(compressPresentation(p.qualification));
  // Functional duties/skill description — the primary detail for a role
  // that states no formal qualification and no experience figure (a
  // trades requirement can have neither). Never invented when absent;
  // simply omitted, exactly like every other optional field here.
  if (p.technicalDuties && !shown(p.technicalDuties)) bits.push(compressPresentation(p.technicalDuties));
  if (p.certifications?.length) bits.push(p.certifications.join(", "));
  return bits.join(" · ");
}

/**
 * The N highest-volume roles, purely for FEATURED EMPHASIS — this never
 * replaces the full position list (every role still prints below it with
 * its own exact count; see renderPosterBody). Only roles with a verified
 * count can be ranked at all; ties keep source order. Capped at 4 so the
 * strip stays a hook, not a second list.
 */
function topDemandRoles(
  facts: AdvertisementFacts,
  max = 4,
): AdvertisementFacts["positions"] {
  return facts.positions
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => typeof p.count === "number" && p.count > 0)
    .sort((a, b) => (b.p.count as number) - (a.p.count as number) || a.index - b.index)
    .slice(0, max)
    .map(({ p }) => p);
}

/**
 * Qualification/certification keywords a candidate would actually search
 * for (e.g. "PMP", "NEBOSH", "Primavera P6") — collected ONLY from
 * facts.positions[].qualification/certifications, which are themselves
 * source-grounded fields (Truth Brain rule). Nothing here is invented:
 * when no position carries a qualification or certification, this
 * returns an empty array and the caller omits the section entirely,
 * exactly as every other optional fact in this file already behaves.
 */
function candidateHookKeywords(facts: AdvertisementFacts): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const p of facts.positions) {
    const values = [p.qualification, ...(p.certifications ?? [])];
    for (const raw of values) {
      const value = raw?.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      keywords.push(value);
    }
  }
  return keywords.slice(0, 8);
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
  /**
   * Header Safe Zone (Final Commercial Layout Lock): whether Gemini's own
   * artwork already carries a strong visual subject in the top header
   * band. Measured upstream (see generate.ts's `assessHeaderZoneVisualWeight`)
   * from the ACTUAL composited artwork — this module never sees pixels,
   * it only reads this one signal. When `true` or omitted (the default,
   * used by every caller that renders standalone — tests, previews — and
   * has no artwork to measure), the header stays minimal so it never
   * competes with or obscures a real photographic subject. When
   * explicitly `false` (Gemini's own header band measured flat/empty),
   * the identity treatment is allowed to claim a little more of that
   * otherwise-wasted space — never by cropping or replacing the artwork,
   * only by giving the agency mark more presence.
   */
  headerZoneHasStrongSubject?: boolean;
  /**
   * Social Format Law (LOCKED): the hard vertical ceiling for a
   * SOCIAL_FEED render — 1440px at the canonical 1080px width (see
   * socialFeedMaxHeightPx in src/lib/platform-formats.ts). When a dense
   * requirement would need more room than this, the canvas does NOT
   * keep growing past it — generation fails closed with
   * LayoutCapacityError (reason: "social-feed-exceeds-max-height"),
   * exactly the same fail-closed discipline the print fillSlot path
   * already uses for a booked physical slot. Omitted entirely for
   * SOCIAL_STORY/SOCIAL_OTHER formats and for print (printOrNewspaper),
   * which keep their own existing behaviour — this is never applied
   * outside the Social Feed family.
   */
  socialFeedMaxHeightPx?: number | null;
  /**
   * Run the canvas-height solve and return immediately, without
   * rasterizing and without applying the Social Feed ceiling. This is
   * how the Social Product Decision (social-product-decision.ts) gets
   * the AUTHORITATIVE required height: it asks the renderer's own solve
   * rather than maintaining a parallel height model that would drift
   * from it (Final Production Lock §7 "every rendering stage must
   * agree", §24 one source only). `png` and `svgMarkup` come back empty
   * — this mode measures, it never draws.
   */
  measureOnly?: boolean;
  /**
   * The EXACT footer identity the Rendering Engine will later typeset
   * into the reserved strip.
   *
   * The strip is sized from the footer's real content, so the
   * reservation made here and the band drawn by applyBrandingOverlay
   * must be computed from IDENTICAL inputs. The pipeline resolves that
   * identity once (campaign overrides, rcNumber fallbacks, whether logo
   * and QR assets actually loaded) and hands the same object to both.
   *
   * Omitted, the fact layer infers it from `facts.agencyProfile`, which
   * is correct for standalone renders and tests but cannot know about
   * caller-level overrides or which image buffers were actually
   * available. A reservation smaller than the band would let the band
   * paint over verified facts, so the resolved value always wins.
   */
  footerContent?: FooterContent | null;
  /**
   * INTERNAL. Skips the canvas-height solve and renders at exactly this
   * height.
   *
   * The POSTER solve budgets the panel from planned component heights
   * (`hero.contentH + highlights.height + plan.bodyH`), which is an
   * upper bound: the drawn body reliably ends above it. On a dense
   * requirement that overshoot is a few px; on a sparse one it was
   * 100-150px of empty panel between the last content and the trust
   * strip, which the renderer then papered over with a 5%-opacity
   * initial rather than removing.
   *
   * The only exact source for where the panel ends is the panel itself,
   * so the poster path measures its own drawn extent and re-renders once
   * at the height that extent implies. This field carries that height
   * into the second pass. It is never set by callers, and the second
   * pass never recurses again.
   */
  internalForcedHeightPx?: number;
  /**
   * INTERNAL. The artwork band the first pass settled on.
   *
   * The band is capped against canvas HEIGHT, and the tighten pass
   * lowers that height — so recomputing the band in the second pass
   * would shrink it, shift the whole panel up, and re-open the gap the
   * pass exists to close. The band is therefore decided once, from the
   * naturally solved height, and carried forward unchanged.
   */
  internalForcedArtworkPx?: number;
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
  /**
   * The same drawing, as live SVG markup instead of a flattened raster —
   * every heading, rule, box and divider is a real `<text>`/`<rect>`/
   * `<path>` element, editable in any SVG tool. This is the INNER content
   * only (no wrapping `<svg>` tag), so `editable-svg.ts` can nest it
   * inside one document alongside the background artwork and the
   * branding band without a second drawing pass. `png` above is produced
   * by rasterizing this exact markup — the two are never allowed to
   * diverge because one is derived from the other, not drawn twice.
   */
  svgMarkup: string;
}

/** Strips the wrapping `<svg ...>...</svg>` tag pair, keeping only the inner marks. */
function innerSvg(fullMarkup: string): string {
  return fullMarkup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

type Plan = ReturnType<typeof planBody>;

/**
 * Role-family grouping ("define the JD group-wise, show what's common"):
 * clusters positions by functional keyword — the same six families visible
 * in every real reference recruitment poster (Project/Management,
 * Procurement/Commercial, Planning/Controls, HVAC/Mechanical,
 * Electrical/IT, General Trades) — so the dense role list reads as
 * organised sections instead of one flat 19-line dump. The rules live in
 * the ONE shared registry (src/lib/role-families.ts) that the Content
 * Intelligence stage also classifies with, so a family can never mean
 * two different things in two places. Grouping only ever affects ORDER
 * and labelling — never which facts render, never their counts.
 */
interface RoleFamilyGroup {
  label: string;
  positionIndexes: number[];
  /** A qualification genuinely shared by 2+ members — never invented. */
  commonQualification: string | null;
}

/** One drawable line in the grouped role list — see planBody/renderPosterBody. */
type BodyEntry =
  | { kind: "familyHeader"; label: string }
  | {
      kind: "position";
      idx: number;
      /**
       * The EXACT detail string this row draws. Carried on the entry
       * rather than recomputed at draw time so the planner's row height
       * and the renderer's output can never disagree (§9 geometry
       * parity) — and so a statement already shown on the family's
       * "Common requirement" line can be excluded here without the two
       * sides of the layout drifting apart.
       */
      detail: string;
    }
  | { kind: "common"; text: string };

/**
 * Groups positions by family, preserving each family's first-appearance
 * order and each member's original relative order within its family —
 * grouping only ever reorders for READING clarity, it never drops,
 * merges or renumbers a role. Returns null when grouping would not help
 * (fewer than 2 distinct families, e.g. a small or homogeneous
 * requirement) so callers can fall back to the plain flat list.
 */
function groupPositionsByFamily(positions: AdvertisementFacts["positions"]): RoleFamilyGroup[] | null {
  const order: string[] = [];
  const byLabel = new Map<string, number[]>();
  positions.forEach((p, idx) => {
    const label = classifyRoleFamily(p.title, p.sourceDivision).heading;
    if (!byLabel.has(label)) {
      byLabel.set(label, []);
      order.push(label);
    }
    byLabel.get(label)!.push(idx);
  });
  if (order.length < 2) return null;

  return order.map((label) => {
    const positionIndexes = byLabel.get(label)!;
    // A qualification is "common" only when it is the SAME verified text
    // on 2+ members of this family — never a summary, never invented.
    const counts = new Map<string, number>();
    for (const idx of positionIndexes) {
      const q = positions[idx].qualification?.trim();
      if (!q) continue;
      const key = q.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let commonQualification: string | null = null;
    for (const idx of positionIndexes) {
      const q = positions[idx].qualification?.trim();
      if (q && (counts.get(q.toLowerCase()) ?? 0) >= 2) {
        commonQualification = q;
        break;
      }
    }
    return { label, positionIndexes, commonQualification };
  });
}

/**
 * Plans the body before anything is drawn (KDL §10.2.1). Column count is
 * chosen so the longest verified title fits at the legibility floor, which
 * is what makes truncation impossible.
 */
function planBody(
  dna: DesignDNA,
  facts: AdvertisementFacts,
  tier: Tier,
  W: number,
  dense = false,
  forceCols?: number,
  suppressSalaryCol = false,
  dpi?: number,
) {
  const T = dna.type;
  const L = dna.layout;
  const px = (f: number) => Math.round(f * W);
  const margin = px(L.margin);
  const contentW = W - margin * 2;
  const gutter = px(L.gutter);
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
  // The DNA can loosen or tighten that rhythm, but it scales the tier — it
  // does not replace it, so density still answers to the requirement first.
  const rowGap = px((tier === "T1" ? 0.02 : tier === "T2" ? 0.014 : tier === "T3" ? 0.009 : 0.007) * L.rowGapScale);
  const lineFactor = tier === "T4" ? 1.15 : 1.25;
  // Derived here rather than passed in, so every one of planBody's callers
  // measures the same composition the renderer will actually draw.
  const poster = !dense && dna.motifs.layoutStyle === "POSTER";
  // POSTER sets a small triangular bullet where the other compositions set
  // a numeric badge; the title measure must start after whichever of the
  // two this composition actually draws (renderPosterBody's bs + gap).
  const bulletW = Math.round(titleSize * 0.42) + px(0.014);
  const badgeW = poster
    ? bulletW
    : facts.positions.some((p) => p.count != null)
      ? px(0.05)
      : 0;
  /** Exactly the string this composition typesets for a role — see posterRoleLine. */
  const measuredTitle = (p: AdvertisementFacts["positions"][number]) =>
    poster ? posterRoleLine(p) : displayTitle(p.title);
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
    ? Math.ceil(Math.max(...facts.positions.map((p) => (p.salary ? textWidth(p.salary, floor, "NUMERIC") : 0))))
    : 0;
  let salaryW = hasSalary ? Math.max(Math.round(colW * 0.34), salaryNeed + Math.round(gutter / 2)) : 0;
  // A column must be wide enough for the widest UNBREAKABLE word. Testing
  // line count alone was not enough: with the badge and salary reserved, the
  // width left for a title could go negative and a two-word title still
  // reported "2 lines", so the grid never collapsed and the salary figures
  // printed straight through the job titles.
  const widestWord = Math.ceil(
    Math.max(
      ...facts.positions.flatMap((p) => measuredTitle(p).split(/\s+/).map((w) => textWidth(w, floor, "POSITION"))),
      0,
    ),
  );
  const titleFits = () => {
    const avail = colW - badgeW - salaryW;
    return avail >= widestWord &&
      !facts.positions.some((p) => wrapLines(measuredTitle(p), avail, floor, "POSITION").length > MAX_LINES);
  };
  while (cols > 1 && !titleFits()) {
    cols -= 1;
    colW = Math.round((contentW - gutter * (cols - 1)) / cols);
    salaryW = hasSalary ? Math.max(Math.round(colW * 0.34), salaryNeed + Math.round(gutter / 2)) : 0;
  }

  // Role-family grouping ("define the JD group-wise, show what's
  // common"): only for POSTER, and only once there's enough content to
  // organise — a 2-3 role requirement reads fine flat. Forces a single
  // column: splitting family sections across a height-balanced
  // multi-column layout would either duplicate a header at the top of
  // two columns or separate a family from its own common-requirement
  // line. Every position still gets its own row with its own exact
  // vacancy count — grouping only ever reorders for readability.
  const grouped = poster && facts.positions.length >= 4 ? groupPositionsByFamily(facts.positions) : null;
  if (grouped) {
    cols = 1;
    colW = contentW;
    salaryW = hasSalary ? Math.max(Math.round(colW * 0.34), salaryNeed + Math.round(gutter / 2)) : 0;
  }

  const anyDetail = showDetail && facts.positions.some((p) => roleDetail(p));
  // The detail line wraps like the title does — it is no longer only a
  // short "5-8 yrs · Diploma" phrase; a functional technical-duties
  // sentence (§4) can run to several lines. Uncapped, unlike the title's
  // wrap(): a title's column-count solve (titleFits, above) guarantees
  // it never needs more than MAX_LINES, so truncating past that bound is
  // provably safe there. Detail text has no such upstream guarantee, so
  // it is measured with the SAME wrapLines() the row draws with and
  // every wrapped line is reserved — never silently dropped.
  const detailLineCount = (detail: string, tw: number) =>
    detail ? wrapLines(detail, tw, detailSize, "FINE").length : 0;
  const positionRowHeight = (
    p: AdvertisementFacts["positions"][number],
    detailOverride?: string,
  ) => {
    const lines = Math.min(
      MAX_LINES,
      wrapLines(measuredTitle(p), colW - badgeW - salaryW, titleSize, "POSITION").length,
    );
    const detail = detailOverride ?? (anyDetail ? roleDetail(p) : "");
    const dLines = detailLineCount(detail, colW - badgeW - salaryW);
    return Math.round(titleSize * lineFactor * lines + dLines * detailSize * 1.3 + rowGap);
  };

  let rowHeights: number[];
  let columns: number[][];
  let listH: number;
  let perCol: number;
  let groupedEntries: BodyEntry[] | null = null;

  if (grouped) {
    const familyHeaderH = Math.round(detailSize * 1.9 + rowGap);
    const commonLineH = Math.round(detailSize * 1.5 + rowGap);
    const entries: BodyEntry[] = [];
    const heights: number[] = [];
    for (const family of grouped) {
      entries.push({ kind: "familyHeader", label: family.label });
      heights.push(familyHeaderH);
      // Anything hoisted to this family's shared line is not repeated on
      // its members' own rows (§10A Step 4).
      const hoisted = new Set<string>();
      if (family.commonQualification) hoisted.add(family.commonQualification.trim().toLowerCase());
      for (const idx of family.positionIndexes) {
        const detail = showDetail ? roleDetail(facts.positions[idx], hoisted) : "";
        entries.push({ kind: "position", idx, detail });
        heights.push(positionRowHeight(facts.positions[idx], detail));
      }
      if (family.commonQualification) {
        entries.push({ kind: "common", text: `Common requirement: ${family.commonQualification}` });
        heights.push(commonLineH);
      }
    }
    groupedEntries = entries;
    rowHeights = heights;
    columns = [grouped.flatMap((f) => f.positionIndexes)];
    listH = heights.reduce((sum, h) => sum + h, 0);
    perCol = facts.positions.length;
  } else {
    rowHeights = facts.positions.map((p) => positionRowHeight(p));
    perCol = Math.ceil(facts.positions.length / cols);
    columns = splitColumnsByHeight(rowHeights, cols);
    listH = Math.max(...columns.map((col) => col.reduce((sum, idx) => sum + rowHeights[idx], 0)));
  }
  const rowH = rowHeights[0] ?? 0;

  const headingH = Math.round(px(T.H2) * 1.6);
  // Must match what renderBody actually draws, or the canvas-height solve
  // under-reserves and the real content overruns the branding strip below
  // it. Premium's benefits are an icon-led bar (KDL trust/icon rebuild),
  // materially taller than High Density's single caption line.
  // Keyed off the DNA's benefit motif, NOT off `dense`. When these two
  // disagreed the solve reserved a caption line and the renderer drew a
  // two-row icon bar, which landed the benefits band inside the branding
  // strip and let the trust band paint over a verified benefit.
  const benefitsH = facts.benefits.length
    ? dna.motifs.benefitStyle === "TEXT_STRIP"
      ? Math.round(px(T.Caption) * 2.6)
      : Math.round(px(0.052) * 2) + px(0.02)
    : 0;
  // A recruiter-stated blanket eligibility note (e.g. "minimum 5 years
  // experience") is a verified fact like any other — the budget must
  // reserve room for it or the draw and the canvas-height solve disagree
  // and it either overflows into the branding strip or gets silently
  // painted over by it. Deliberately generous (9% of width, several times
  // the note's own one-line height): in the AAT_DTP fillSlot path the
  // chrome/masthead budget (dtpMastheadH + dtpChromeH) is itself a close
  // estimate of the real drawn masthead, not exact, and a tightly-sized
  // reservation here reproduced the exact defect this guards against —
  // the note landed a few dozen px past the paper boundary and was
  // overpainted by the branding strip despite "fitting" on paper.
  const footerNoteH = facts.footer ? px(0.09) : 0;
  const extraH =
    benefitsH +
    (facts.interview.length ? Math.round(px(T.Caption) * (dense ? 2.8 : 2.2)) : 0) +
    footerNoteH;

  return {
    cols, colW, margin, contentW, gutter, titleSize, detailSize, showDetail,
    rowGap, badgeW, salaryW, hasSalary, perCol, columns, rowH, rowHeights, listH, headingH, extraH, floor, lineFactor,
    maxLines: MAX_LINES,
    bodyH: headingH + listH + extraH,
    groupedEntries,
  };
}

/**
 * Featured-demand strip, drawn above the full position list on POSTER
 * (commercial content strategy, not a data change): a label, the top
 * roles by verified count, and any real qualification/certification
 * keywords — a candidate hook. Purely additive: this reserves its own
 * height so the canvas-height solve can never mistake it for space the
 * full list already owns, and the full list below it is untouched.
 * Skipped entirely (zero height) when there is nothing to feature, and
 * — critically — when featuring would REPEAT rather than summarise. A
 * "top roles" strip only earns its ~250px when it covers a genuine
 * minority of the list: above a 4-role list it simply prints the same
 * four roles twice, costing height that the Social Feed ceiling
 * (1080x1440) cannot spare and adding a duplicate-looking row the lock
 * explicitly forbids (§8: "No duplicate role caused by rendering").
 */
function planHighlights(dna: DesignDNA, facts: AdvertisementFacts, W: number, tier: Tier) {
  const T = dna.type;
  const px = (f: number) => Math.round(f * W);
  const contentW = W - px(dna.layout.margin) * 2;
  const floor = Math.max(px(LEGIBILITY_FLOOR), 0);

  // The strip must summarise, not echo: it is drawn only when the roles
  // it features are fewer than half the roles listed below it.
  const candidates = topDemandRoles(facts);
  const featured = candidates.length * 2 < facts.positions.length ? candidates : [];
  // Same law for the keyword strip: summarise, never echo. Every value
  // it would print (qualification, certifications) is already drawn
  // verbatim on each role's own detail line whenever detail lines are
  // drawn at all — repeating them above the list is the duplicate the
  // lock forbids, and it costs height the Feed ceiling cannot spare. The
  // strip therefore earns its place only in the dense tiers, where
  // per-role detail is not shown and these keywords are the only place
  // a candidate can see what is required.
  const detailLinesAreDrawn = tier === "T1" || tier === "T2";
  const hookKeywords = detailLinesAreDrawn ? [] : candidateHookKeywords(facts);

  if (featured.length === 0 && hookKeywords.length === 0) {
    return { featured, hookKeywords, labelSize: 0, roleSize: 0, hookSize: 0, height: 0 };
  }

  const labelSize = Math.max(floor, Math.round(px(T.Caption) * 0.92));
  const roleSize = Math.max(floor, tier === "T1" || tier === "T2" ? px(T.BodyL) : px(T.Body));
  const hookSize = Math.max(floor, Math.round(px(T.Caption) * 0.9));

  let height = 0;
  if (featured.length > 0) {
    height += Math.round(labelSize * 1.6) + px(0.014);
    height += featured.length * Math.round(roleSize * 1.35);
    height += px(0.018);
  }
  if (hookKeywords.length > 0) {
    const hookLine = hookKeywords.join("   ·   ");
    const hookLines = wrapLines(hookLine, contentW, hookSize, "FINE").length;
    height += hookLines * Math.round(hookSize * 1.5) + px(0.014);
  }
  height += px(0.02);

  return { featured, hookKeywords, labelSize, roleSize, hookSize, height };
}

type Highlights = ReturnType<typeof planHighlights>;

/** Gulf destinations stripped generically, even when they don't match facts.country verbatim. */
const GULF_COUNTRIES = ["Saudi Arabia", "UAE", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Oman"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The destination appears once in the top hierarchy, not twice. A
 * CRM-style header ("Construction Project — Saudi Arabia") restates the
 * country the composition already states on its own line — this strips
 * ONLY a trailing " <separator> <country>" suffix, never a country word
 * appearing elsewhere in a legitimate project name, because the pattern
 * is anchored to the end of the string. facts.country is always checked;
 * the fixed Gulf list is checked too, so a header naming a different Gulf
 * destination than facts.country (a stale/mismatched source header) still
 * gets its own redundant suffix removed.
 */
function stripDestinationSuffix(header: string, country?: string | null): string {
  const names = Array.from(
    new Set([country, ...GULF_COUNTRIES].filter((c): c is string => Boolean(c?.trim())).map((c) => c.trim())),
  );
  if (names.length === 0) return header;
  const alternation = names.map(escapeRegExp).join("|");
  const pattern = new RegExp(`\\s*[—–-]\\s*(?:${alternation})\\s*$|\\s*·\\s*(?:${alternation})\\s*$`, "i");
  return header.replace(pattern, "").trim();
}

/**
 * Measures the hero block so the hero box can be sized to hold it. Laying
 * the hero out by accumulating y without knowing the box height is what
 * pushed the subtitle onto the cream body surface (white on cream) and
 * collided the total badge with the first position row.
 */
function planHero(dna: DesignDNA, facts: AdvertisementFacts, W: number, dpi?: number) {
  const T = dna.type;
  const px = (f: number) => Math.round(f * W);
  const contentW = W - px(dna.layout.margin) * 2;
  // 7pt is the smallest a Gulf recruitment classified sets a trade name.
  // Below it the advertisement is unreadable in print no matter how well
  // it fits.
  const MIN_PRINT_PT = 7;
  const floor = Math.max(px(LEGIBILITY_FLOOR), dpi ? Math.round((MIN_PRINT_PT / 72) * dpi) : 0);

  // The source/CRM header is source data, not automatically the public
  // headline (see AdvertisementCampaignIdentity's doc comment) — a raw
  // CRM summary like "Fireproofing Mason + 8 more roles" is exactly the
  // shape stripDestinationSuffix was never meant to fix (it only strips
  // a trailing "— Country"). When the header is empty, or matches that
  // literal "+N more roles" source-dump pattern, a candidate-facing
  // headline is reconstructed from verified facts (industry, or the
  // role families the positions themselves cluster into) instead of
  // typesetting the raw source text. Every other header is untouched.
  const rawHeader = stripDestinationSuffix(facts.header, facts.country);
  const isSourceDumpHeader = /\+\s*\d+\s*more\s*roles?\b/i.test(rawHeader);
  const stated =
    !rawHeader || isSourceDumpHeader
      ? buildCandidateHeadline(facts) ?? `Hiring — ${facts.country}`
      : rawHeader;
  const headline = dna.motifs.uppercaseHeadline ? stated.toUpperCase() : stated;
  const headlineSize = fit(headline, contentW, px(T.D1), px(T.H3), "DISPLAY");
  const headlineLines = wrapLines(headline, contentW, headlineSize, "DISPLAY");

  const employerSize = facts.employer
    ? fit(facts.employer, contentW, px(T.H1), px(T.H3), "DISPLAY")
    : 0;
  // Final Content Intelligence Correction: urgency is a MESSAGE, not a
  // number, and it must not be buried behind operational detail. For
  // POSTER, the headline slot itself is pinned to the country (see
  // heroFacts above) — the sub-line is the next most prominent slot the
  // hero actually draws, so a verified urgency signal leads there
  // rather than a bare "Industry · Project" join. Never fires from
  // parsing header text — only from the verified `urgent` fact.
  const projectLine = [facts.projectType, facts.industry].filter(Boolean).join(" · ");
  const sub = facts.urgent === true && projectLine ? `Urgent Hiring — ${projectLine}` : projectLine;
  const subSize = sub ? fit(sub, contentW, px(T.H3), floor, "SECTION") : 0;
  // CTA leads the meta line rather than trailing after operational
  // detail (dutyHours/visaType/rotation) — "what to do" reads before
  // "what the working hours are". Still fires only from the verified
  // `urgent` fact, never from parsing the header text — see
  // buildCandidateCta's own contract.
  const meta = [buildCandidateCta(facts), facts.visaType, facts.dutyHours, facts.rotation]
    .filter(Boolean)
    .join("  ·  ");
  const metaSize = meta ? fit(meta, contentW, px(T.Caption), floor, "SECTION") : 0;
  const badgeH = Math.round(px(T.Caption) * 2.2);
  // Reserves the ribbon banner drawn above the headline in the Premium
  // composition (dense ignores this — it never draws a ribbon). Omitting
  // it under-reserved the hero by exactly the ribbon's height, and the
  // real content ran past the branding strip below it.
  // A DNA that draws no ribbon reserves no ribbon: leaving the reserve in
  // place would open a band of dead colour above the headline exactly the
  // height of a banner that never gets painted.
  const ribbonH = dna.motifs.ribbon === "NONE" ? 0 : Math.round(px(T.Caption) * 2.1);
  // The gap beneath the ribbon must clear the headline's own cap-height,
  // not just a fixed margin — a short headline (a destination name) is
  // never width-constrained the way a long free-text one is, so it renders
  // at the full preferred size and a flat 0.045W gap that was tuned for a
  // shrunk headline let its ascender overlap the ribbon above it.
  const ribbonGap = Math.max(px(0.045), Math.round(headlineSize * 0.85));
  const ribbonReserve = dna.motifs.ribbon === "NONE" ? px(0.03) : px(0.02) + ribbonH + ribbonGap;

  // A centred hero cannot park the vacancy numeral in a right-hand column
  // — centred text runs through that column. So a centred DNA sets the
  // numeral INLINE, beneath the text, and the space it needs is reserved
  // here. Sized off the type scale rather than off heroPx, because heroPx
  // is solved from this measurement and cannot be an input to it.
  const inlineNumeral = dna.motifs.heroAlign === "CENTRE" && dna.motifs.numeral !== "NONE" && heroNumeral(facts) !== null;
  const numeralSize = inlineNumeral
    ? Math.round(px(T.D1) * (dna.motifs.numeral === "DISPLAY" ? 1.6 : 0.9))
    : 0;
  const numeralCaptionSize = inlineNumeral ? Math.max(floor, Math.round(numeralSize * 0.22)) : 0;
  const numeralReserve = inlineNumeral
    ? px(0.012) + Math.round(numeralSize * 1.02) + Math.round(numeralCaptionSize * 1.5)
    : 0;

  const h =
    ribbonReserve +
    numeralReserve +
    headlineLines.length * Math.round(headlineSize * 1.14) +
    (employerSize ? px(0.01) + Math.round(employerSize * 1.08) : 0) +
    (subSize ? px(0.006) + Math.round(subSize * 1.15) : 0) +
    (metaSize ? Math.round(metaSize * 1.3) : 0) +
    px(0.008) + badgeH + px(0.03);

  return {
    headline, headlineSize, headlineLines, employerSize, sub, subSize, meta, metaSize, badgeH,
    inlineNumeral, numeralSize, numeralCaptionSize,
    contentH: h,
  };
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
/**
 * The TRUE campaign totals when this canvas carries only a selection of
 * the campaign's positions (a carousel cover hook). Returns null for the
 * ordinary case, where the positions on the canvas ARE the campaign and
 * the counts below are computed from them directly.
 *
 * A total that does not agree with the positions actually listed here is
 * only honest because the remaining positions are stated in full
 * elsewhere in the same product — the carousel planner guarantees that.
 */
/**
 * The verified agency name. `agencyProfile` is the canonical source
 * (LIVE SCHEMA); the flat `agencyName` field is legacy and remains only
 * for callers that have not migrated. Reading the legacy field directly
 * crashed the whole render for any caller that supplied only the
 * profile — which is what the carousel path does.
 */
function agencyNameOf(facts: AdvertisementFacts): string {
  return facts.agencyProfile?.agencyName ?? facts.agencyName ?? "";
}

function campaignTotals(facts: AdvertisementFacts): { vacancies: number; roles: number } | null {
  const t = facts.campaignTotals;
  if (!t) return null;
  if (t.roles <= 0 || t.vacancies <= 0) return null;
  return t;
}

// Final Content Intelligence Correction: vacancy/role counts are
// supporting metadata, never the primary marketing message. The role
// COUNT in particular reads as a database statistic ("9 ROLES") rather
// than a recruitment hook, so this badge states the vacancy figure
// alone — still the exact verified number, just without the role-count
// tail. The individual role TITLES (drawn separately, below) are what
// actually tell a candidate what's on offer.
// Final 10/10 Human Recruiter Intelligence Gate: a summed vacancy figure
// is a database aggregate ACROSS DIFFERENT JOBS — a candidate for one
// role gets no information from learning that unrelated roles also have
// openings. It is genuinely persuasive only in the one case where it
// describes a SINGLE real job: either the canvas lists exactly one role,
// or the true campaign (campaignTotals) is itself one role shown from a
// hook selection. Every other case: the number belongs on the job it
// describes (posterRoleLine already draws "(N NOS)" next to every role),
// not as a standalone aggregate badge. This generalizes to any source —
// nothing here is specific to any one requirement's role names or counts.
function headlineCountLabel(facts: AdvertisementFacts): string | null {
  const totals = campaignTotals(facts);
  if (totals) {
    return totals.roles === 1 ? `${totals.vacancies} VACANCIES` : null;
  }

  const roles = facts.positions.length;
  if (roles === 0) return null;
  if (roles > 1) return null;

  const allCounted = facts.positions.every((p) => typeof p.count === "number");
  if (allCounted) {
    const vacancies = facts.positions.reduce((sum, p) => sum + (p.count ?? 0), 0);
    if (vacancies > 0) return `${vacancies} VACANCIES`;
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
  // Same rule as headlineCountLabel: a hero-scale number is only drawn
  // for a genuinely single job, never a cross-role aggregate.
  const totals = campaignTotals(facts);
  if (totals) {
    return totals.roles === 1
      ? { num: String(totals.vacancies), caption: totals.vacancies === 1 ? "VACANCY" : "VACANCIES" }
      : null;
  }

  const roles = facts.positions.length;
  if (roles === 0 || roles > 1) return null;
  const allCounted = facts.positions.every((p) => typeof p.count === "number");
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
  // The composition is a property of the REQUIREMENT (how many roles, and
  // where it is going) — position count first, print/newspaper intent
  // second, exactly as the proven implementation decides it.
  const themeSelection = selectTheme(facts, input.theme, { printOrNewspaper: input.printOrNewspaper });
  const dense = themeSelection.theme === "AAT_DTP";
  const dna = dense ? DTP_DNA : PREMIUM_DNA;
  const T = dna.type;
  const L = dna.layout;
  const M = dna.motifs;
  const poster = !dense && M.layoutStyle === "POSTER";
  const tier = tierFor(total);
  // High Density trades hero height for information: minimal artwork, and
  // the page belongs to the table.
  //
  // A DNA states the hero proportion it wants; the engine still tightens it
  // as the requirement gets denser, because the roles are what the reader
  // came for. These two factors are the engine's, not the DNA's — a design
  // may not buy itself artwork space at the cost of the position list.
  const MID_DENSITY_HERO_FACTOR = 0.71; // 13+ roles, campaign composition
  const CLASSIFIED_HERO_FACTOR = 0.53; // the masthead of a ruled table
  const spare = tier === "T1" || tier === "T2";
  const heroFrac = dense
    ? L.heroFractionDense * CLASSIFIED_HERO_FACTOR
    : L.heroFractionSparse * (spare ? 1 : MID_DENSITY_HERO_FACTOR);
  // The hero is capped in absolute terms so a tall directory poster does not
  // spend a third of its height on artwork it does not need.
  const heroCap = Math.round(
    (dense ? L.heroCapDense * 0.6 : L.heroCapSparse * (spare ? 1 : 0.81)) * W,
  );
  // POSTER's photo band is a proportion of WIDTH — not of the
  // still-unsolved canvas height, and not derived from hero.contentH the
  // way heroCap is. The panel beneath it is what actually needs to grow
  // with content, so the photo band must be a stable, independent
  // quantity the solve below can safely add to.
  //
  // Header Safe Zone (Final Commercial Layout Lock): the band is no
  // longer one fixed fraction regardless of the requirement. A dense
  // T3/T4 list needs its vertical room going to the body, not to a full
  // 0.34W of header that dwarfs the single-line agency mark actually
  // drawn there — so the band compresses modestly as density rises. It
  // never compresses so far that it would crowd the seam or crop the
  // hero photo; this only ever shrinks the RESERVE, the artwork itself
  // is never touched or cropped.
  const HEADER_DENSITY_FACTOR = tier === "T1" || tier === "T2" ? 1 : tier === "T3" ? 0.92 : 0.85;
  /**
   * The artwork band, capped against the canvas it actually sits on.
   *
   * 0.34W alone is blind to how much content sits beneath it. On a dense
   * requirement the canvas is tall and 0.34W is a modest header; on a
   * sparse one the canvas is short and the SAME band becomes 35-40% of
   * the advertisement — a large empty region the reader must travel
   * through before reaching the recruitment message, with the seam
   * marking the bottom of it. That is the "stranded agency mark over a
   * huge empty area" defect: the band never grew, the advertisement
   * around it shrank.
   *
   * Capping it as a fraction of the SOLVED height makes the opening
   * composition content-driven: the agency mark, the headline and the
   * destination stay one coherent block whatever the requirement's size.
   * Dense requirements are unaffected (their 0.34W is already below the
   * cap); sparse ones reclaim the difference for the recruitment
   * message.
   *
   * H-dependent, so it is evaluated INSIDE the height solve and again
   * for the draw pass from the settled H — the two must agree about
   * where the panel begins or the seam and the reserve drift apart.
   */
  const posterArtworkWidthCap = Math.round(0.34 * W * HEADER_DENSITY_FACTOR);
  /**
   * A dense requirement keeps a genuine artwork band.
   *
   * T3/T4 is where the "Gemini visual hero" archetype has to hold: those
   * requirements are the ones that would otherwise degrade into a thin
   * masthead over a long table, which is the DTP look the visual hero
   * exists to avoid. Their canvases are tall, so the floor costs them a
   * small share of the advertisement.
   *
   * T1/T2 gets no floor. Those canvases are short, and a floor there is
   * exactly how the band became 30-40% of a sparse advertisement — the
   * defect this cap was introduced to remove.
   */
  const posterArtworkFloor = tier === "T3" || tier === "T4" ? Math.round(0.26 * W) : 0;
  const posterPhotoBandFor = (h: number) =>
    Math.min(
      posterArtworkWidthCap,
      Math.max(posterArtworkFloor, Math.round(POSTER_ARTWORK_MAX_FRACTION * h)),
    );
  // Signal from generate.ts, measured from Gemini's ACTUAL artwork in the
  // header band (see assessHeaderZoneVisualWeight). Absent a signal
  // (standalone renders — tests, previews, no artwork to measure) this
  // defaults to "assume a real subject is there" so the header treatment
  // never grows on a guess and risks fighting real photography.
  const headerZoneHasStrongSubject = input.headerZoneHasStrongSubject ?? true;
  let plan = planBody(dna, facts, tier, W, dense, undefined, false, input.dpi);
  // Every reference recruitment poster leads with the DESTINATION, not
  // with a free-text requirement headline — "SAUDI ARABIA" huge, the
  // project/industry as a smaller line beneath it. Substituting the
  // headline input only (employer/project/industry keep reading from the
  // real facts, exactly as before) reproduces that hierarchy without a
  // second hero-measurement path: planHero and every drawing line below
  // it are untouched, they just measure and draw a different string.
  const heroFacts = poster && facts.country ? { ...facts, header: facts.country } : facts;
  const hero = planHero(dna, heroFacts, W, input.dpi);
  // Featured-demand strip — POSTER only (see planHighlights); zero height
  // everywhere else, so this never affects AAT_DTP's fixed-slot maths.
  const highlights: Highlights = poster
    ? planHighlights(dna, facts, W, tier)
    : { featured: [], hookKeywords: [], labelSize: 0, roleSize: 0, hookSize: 0, height: 0 };
  const pad = px(0.06);

  // Solve for the canvas height that holds every fact at the floor. The
  // branding strip and the hero are both capped against width, so the
  // relationship is piecewise — settle it with a short fixed-point loop
  // rather than assuming which regime applies.
  const hasContact = Boolean(facts.contact.phone || facts.contact.email);
  // The reserved branding strip is sized from the footer's REAL content
  // (Final Production UI Correction §6): the same verified Agency Profile
  // fields the overlay will typeset. Reserving a fixed slab sized for the
  // maximum-content case is what left short-profile advertisements with a
  // large dead band between the last body content and the agency name.
  //
  // Assets (logo/QR) are not held here — the fact layer never loads them —
  // but their presence changes the strip's floor, so it reports whether
  // the profile HAS them rather than passing the buffers themselves.
  const footerContent: FooterContent = input.footerContent ?? {
    agencyName: agencyNameOf(facts),
    registrationNumber:
      facts.agencyProfile?.fullRegistrationNumber ?? facts.fullRegistrationNumber ?? null,
    officialEmail: facts.agencyProfile?.officialEmail ?? null,
    officialPhone: facts.agencyProfile?.officialPhone ?? null,
    website: facts.agencyProfile?.website ?? null,
    addressLine: facts.agencyProfile?.registeredAddress ?? null,
    brandBadges: facts.agencyProfile?.approvedBadges ?? null,
    hasLogo: Boolean(facts.agencyProfile?.logoUrl),
    hasQr: Boolean(facts.agencyProfile?.verificationUrl ?? facts.agencyProfile?.verificationId),
  };
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
  const pal: Palette = dna.palette;
  let H = input.heightPx;
  for (let i = 0; i < 8; i++) {
    if (fillSlot) break;
    if (input.internalForcedHeightPx) {
      H = input.internalForcedHeightPx;
      break;
    }
    const heroAt = Math.max(
      Math.min(Math.round(heroFrac * H), heroCap),
      Math.min(Math.round(L.headerHeight * H), Math.round(0.15 * W)) + hero.contentH,
    );
    const stripAt = brandingStripHeight(W, H, hasContact, footerContent) + Math.round(0.025 * H);
    // The DTP section bar replaces planBody()'s own heading; counting both
    // left a band of dead white above the contact bar.
    // POSTER's hero text now lives INSIDE the panel, stacked before the
    // position list rather than occupying a separate photo-bound box that
    // ends where the list begins — so its reserve is ADDITIVE with the
    // panel's own content, not folded into heroAt the way DOCUMENT's is.
    //
    // Social/premium campaign output (poster and the plain hero regime) is
    // sized to its OWN content, not floored at the requested input.heightPx
    // — a short requirement must not carry hundreds of px of dead white
    // canvas below it just because a taller platform format was asked for.
    // AAT_DTP keeps its floor at the requested height: a bought print slot
    // is filled exactly, never left short, per the DTP fillSlot convention
    // below (this branch only runs for an explicit AAT_DTP override without
    // printOrNewspaper — the ordinary print path skips this loop entirely).
    const need = dense
      ? Math.max(input.heightPx, dtpMastheadH + dtpChromeH + (plan.bodyH - plan.headingH) + pad + stripAt)
      : poster
        ? // No flat `pad` here: stripAt already carries KDL's own 0.025H
          // clearance gap above the trust strip (docs/012 §4.1). Adding a
          // second, flat 0.06W pad on top of it double-reserved breathing
          // room — measured at ~92px of genuinely empty navy panel between
          // the last drawn role row and the trust strip on a real 19-role
          // generation with no benefits/interview to fill it. Every other
          // section here (hero, highlights, the list) already reserves
          // exactly what it draws.
          posterPhotoBandFor(H) + hero.contentH + highlights.height + plan.bodyH + stripAt
        : heroAt + plan.bodyH + pad + stripAt;
    // Converge rather than only grow: shrink for a short requirement, grow
    // for a dense one, stop once the solve stabilises (stripAt/heroAt are
    // the only H-dependent terms, so this settles in a handful of steps).
    //
    // Shrink-to-content exists to remove HUNDREDS of px of dead canvas
    // under a short requirement — not to miss a requested format by a
    // hair. A requested canvas is a format contract (1080x1350 is a 4:5
    // Instagram portrait; 1240x1754 is A4), so a solve that lands just
    // under it is neither a deliberate compaction nor a valid format:
    // snap up and let the existing slack branch below give the few
    // reclaimed pixels to the hero. Only a genuinely shorter requirement
    // — one needing less than 90% of the request — still shrinks.
    const snapped =
      need < input.heightPx && need >= Math.round(input.heightPx * 0.9) ? input.heightPx : need;
    if (Math.abs(snapped - H) <= 1) {
      H = snapped;
      break;
    }
    H = snapped;
  }

  if (fillSlot) {
    // DTP Format Law (LOCKED): the renderer must select an approved
    // physical slot before rendering — never an arbitrary giant canvas.
    // Checked against the Assignments Abroad Times appointment-ad
    // column widths (2/4/6/8/10 columns = 6.0/12.7/19.4/26.1/32.8cm) at
    // the request's own DPI (standard newsprint 300dpi when unspecified).
    const dpi = input.dpi ?? DTP_DEFAULT_DPI;
    if (!isApprovedDtpWidthPx(W, dpi)) {
      const nearest = nearestApprovedDtpSlot(W, dpi);
      throw new LayoutCapacityError([
        `${W}px at ${dpi}dpi is not an approved DTP column width. The nearest approved slot is ` +
          `${nearest.columns} columns (${nearest.widthCm}cm) — select an approved physical slot before rendering.`,
      ]);
    }
    H = input.heightPx;
    const stripFixed = brandingStripHeight(W, H, hasContact, footerContent);
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
      const wider = planBody(dna, facts, tier, W, dense, c, false, input.dpi);
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
      let best = planBody(dna, facts, tier, W, dense, undefined, true, input.dpi);
      for (let c = best.cols + 1; c <= 6 && H - chromeFor(best) < best.listH; c++) {
        const wider = planBody(dna, facts, tier, W, dense, c, true, input.dpi);
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

  // Measurement-only exit (see FactLayerInput.measureOnly): the solve
  // above has produced the height this requirement genuinely needs.
  // The artwork band, settled from the final canvas height — declared
  // before the measure-only return so the Social Product Decision reads
  // the same band the draw pass will use.
  const posterPhotoBand = input.internalForcedArtworkPx ?? posterPhotoBandFor(H);

  // Returned BEFORE the ceiling and aspect gates so the caller sees the
  // real requirement and can decide what product it deserves, rather
  // than only that it failed.
  //
  // POSTER is the exception: its final height is only known after the
  // panel has measured its own drawn extent (see the tighten pass
  // below), so a measure-only caller must be taken through the same
  // path rather than handed the pre-correction estimate. Returning early
  // here would make measureOnly disagree with the real render, which is
  // exactly what the "every rendering stage must agree" law forbids. The
  // second pass carries internalForcedHeightPx and so exits here at once
  // with the corrected height.
  if (input.measureOnly && (!poster || input.internalForcedHeightPx)) {
    return {
      png: Buffer.alloc(0),
      heightPx: H,
      artworkHeightPx: poster ? posterPhotoBand : 0,
      themeSelection,
      svgMarkup: "",
    };
  }

  // Social Format Law: a SOCIAL_FEED render has a hard ceiling well
  // below the generic MAX_ASPECT bound — checked first (it is always
  // the tighter of the two whenever it applies) so a dense requirement
  // never grows into an A4-like poster under the Feed format. Print
  // (fillSlot) is never subject to this — it has its own physical-slot
  // capacity law below.
  /**
   * The height gates must judge the FINAL canvas.
   *
   * POSTER settles its height in two steps: the solve produces an upper
   * bound, then the panel measures its own drawn extent and the canvas
   * is re-rendered at the height that extent implies. Gating on the
   * first number rejects advertisements that do fit — and, worse, makes
   * the measure-only probe (which reports the settled height) disagree
   * with the real render, which is precisely what the Social Feed
   * carousel uses to decide how many roles its cover can carry.
   *
   * So for a poster these gates are deferred to the pass that holds the
   * final height: the forced second pass, or the first pass when it
   * turns out no tightening was needed.
   */
  const heightIsFinal = !poster || Boolean(input.internalForcedHeightPx);

  const assertHeightWithinLimits = (h: number): void => {
    if (input.socialFeedMaxHeightPx && h > input.socialFeedMaxHeightPx && !fillSlot) {
      throw new LayoutCapacityError(
        [
          `${total} positions need a ${h}px canvas at minimum readability, beyond the Social Feed format's ` +
            `${input.socialFeedMaxHeightPx}px hard ceiling. Move this requirement to Story/Reel (1080x1920) or a DTP ` +
            `print slot, or reduce the requirement.`,
        ],
        "social-feed-exceeds-max-height",
      );
    }
    if (h > W * MAX_ASPECT && !fillSlot) {
      throw new LayoutCapacityError([
        `${total} positions need a ${h}px canvas at minimum readability, beyond the ${Math.round(W * MAX_ASPECT)}px publishable limit`,
      ]);
    }
  };

  if (heightIsFinal && input.socialFeedMaxHeightPx && H > input.socialFeedMaxHeightPx && !fillSlot) {
    throw new LayoutCapacityError(
      [
        `${total} positions need a ${H}px canvas at minimum readability, beyond the Social Feed format's ` +
          `${input.socialFeedMaxHeightPx}px hard ceiling. Move this requirement to Story/Reel (1080x1920) or a DTP ` +
          `print slot, or reduce the requirement.`,
      ],
      "social-feed-exceeds-max-height",
    );
  }

  if (heightIsFinal && H > W * MAX_ASPECT && !fillSlot) {
    throw new LayoutCapacityError([
      `${total} positions need a ${H}px canvas at minimum readability, beyond the ${Math.round(W * MAX_ASPECT)}px publishable limit`,
    ]);
  }

  // The hero box always holds its measured content — the cap only trims
  // decorative slack, it never clips a fact.
  let heroPx = Math.max(
    Math.min(Math.round(heroFrac * H), heroCap),
    Math.min(Math.round(L.headerHeight * H), Math.round(0.15 * W)) + hero.contentH,
  );

  // A short requirement on a square canvas left a large dead band of cream
  // below the last line. Give the slack to the artwork instead: a one-role
  // advertisement should be photo-led, not half-empty. Capped so the hero
  // never crowds out the facts.
  const strip = brandingStripHeight(W, H, hasContact, footerContent);
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
    const stripHere = brandingStripHeight(W, H, hasContact, footerContent);
    const paperH = H - stripHere;

    parts.push(`<rect x="0" y="0" width="${W}" height="${paperH}" fill="${pal.paper}"/>`);
    parts.push(
      `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${pal.ink}" stop-opacity="0.55"/>` +
        `<stop offset="1" stop-color="${pal.ink}" stop-opacity="0.30"/>` +
        `</linearGradient></defs>`,
    );
    // The hard outer frame is the classified convention, and a DNA can
    // decline it — a bought half-page reads calmer without one.
    if (M.outerFrame) {
      parts.push(
        `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${paperH - inset * 2}" ` +
          `fill="none" stroke="${pal.ink}" stroke-width="${FRAME}"/>`,
      );
    }

    const edge = M.outerFrame ? inset + FRAME : inset;
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
    const uSize = fit(destination, innerW * 0.55, Math.round(barH * 0.46), plan.floor, "SECTION");
    parts.push(
      `<text x="${edge + bandPad}" y="${edge + Math.round(barH * 0.68)}" font-family="${roleFamily("SECTION")}" ` +
        `font-size="${uSize}" font-weight="700" fill="${pal.reversed}" letter-spacing="3">${esc(destination)}</text>`,
    );
    const interviewBit = facts.interview[0]?.date
      ? `INTERVIEW ${facts.interview[0].date}`
      : facts.raLicenseId ?? "";
    if (interviewBit) {
      const iSize = fit(interviewBit, innerW * 0.42, Math.round(barH * 0.32), plan.floor, "FINE");
      parts.push(
        `<text x="${W - edge - bandPad}" y="${edge + Math.round(barH * 0.66)}" font-family="${roleFamily("FINE")}" ` +
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
        `<text x="${Math.round(W / 2)}" y="${my}" font-family="${roleFamily("DISPLAY")}" ` +
          `font-size="${hero.headlineSize}" font-weight="800" fill="${pal.reversed}" text-anchor="middle" ` +
          `letter-spacing="-1">${esc(l.toUpperCase())}</text>`,
      );
      my += Math.round(hero.headlineSize * 1.06);
    }
    if (facts.employer && hero.employerSize) {
      // A long header (fit() shrinks it hard to hold its full length) can
      // end up SMALLER than a short employer name — advancing by the
      // headline's own line height then left too little clearance for the
      // employer's ascent, and its glyphs ran up into the header line above.
      my += Math.max(0, Math.round((hero.employerSize - hero.headlineSize) * 0.8));
      parts.push(
        `<text x="${Math.round(W / 2)}" y="${my}" font-family="${roleFamily("DISPLAY")}" ` +
          `font-size="${hero.employerSize}" font-weight="700" fill="${pal.accentText === "#FFFFFF" ? pal.reversed : pal.accent}" text-anchor="middle">${esc(facts.employer.toUpperCase())}</text>`,
      );
      my += Math.round(hero.employerSize * 1.08);
    }
    if (hero.meta && hero.metaSize) {
      my += Math.max(0, Math.round((hero.metaSize - hero.headlineSize) * 0.8));
      parts.push(
        `<text x="${Math.round(W / 2)}" y="${my}" font-family="${roleFamily("SECTION")}" ` +
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
    const strapSize = fit(strapBits, innerW - bandPad * 2, Math.round(strapH * 0.4), plan.floor, "SECTION");
    parts.push(
      `<text x="${Math.round(W / 2)}" y="${strapY + Math.round(strapH * 0.66)}" font-family="${roleFamily("SECTION")}" ` +
        `font-size="${strapSize}" font-weight="700" fill="${pal.accentText}" text-anchor="middle" letter-spacing="1">${esc(strapBits)}</text>`,
    );

    parts.push(renderBody(dna, facts, W, strapY + strapH, plan, true, edge, innerW, dtpScale, pal).svg);
    parts.push(`</svg>`);
    const dtpMarkup = parts.join("");
    const dtpPng = await sharp(Buffer.from(dtpMarkup)).png().toBuffer();
    return { png: dtpPng, heightPx: H, artworkHeightPx: heroPx, themeSelection, svgMarkup: innerSvg(dtpMarkup) };
  }

  // Composition is set by the Design DNA's motifs — seam direction, ribbon
  // corner, whether a vacancy numeral is drawn at all. These are VALUES,
  // read below by the same drawing code for every DNA: there is one hero,
  // one body, one callout, and a DNA only says how they are dressed.
  //
  // layoutStyle is the one motif that changes DRAWING STRUCTURE rather than
  // just dressing: POSTER runs the artwork the full height of the canvas
  // (down to the branding strip) and sets every fact directly on it, the
  // way a real social recruitment poster is built — no seam, no separate
  // white body surface holding the position list. (`poster` itself is
  // computed earlier, alongside `dna`, because it also decides what the
  // hero headline reads before a single mark is drawn.)

  // ---- Hero scrim (KDL §4.3): a known contrast floor over unknown artwork.
  parts.push(
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${pal.ink}" stop-opacity="0.94"/>` +
      `<stop offset="0.75" stop-color="${pal.ink}" stop-opacity="0.82"/>` +
      `<stop offset="1" stop-color="${pal.ink}" stop-opacity="0.35"/>` +
      `</linearGradient></defs>`,
  );
  const diag = Math.round(W * 0.055);
  const step = Math.round(W * 0.03);
  const mid = Math.round(W * 0.52);
  const stripH = brandingStripHeight(W, H, hasContact, footerContent);

  // The vertical split point for POSTER — the exact same fixed quantity
  // (`posterPhotoBand`) the canvas-height solve above already reserved
  // room for, so the drawn seam and the solved capacity can never
  // disagree about where the panel begins.
  const panelTop = posterPhotoBand;

  let headH = 0;
  let ribbonY = 0;
  let ribbonH = 0;
  let numeral: ReturnType<typeof heroNumeral> = null;
  let posterBodyEndY = 0;

  if (poster) {
    // ============================================================
    // SPLIT COMPOSITION — a confined photograph and a solid identity
    // panel, not text laid over a picture. The photograph is a pure
    // visual anchor: nothing is typeset on it, so nothing about its
    // colour, business or lighting can ever threaten legibility.
    // ============================================================

    // A restrained duotone lift on the photo itself — the single frame
    // reads as though it was graded FOR this advertisement's palette,
    // not dropped in from a generic stock library.
    parts.push(
      // LOCK 2, Zone A (image-led hero, above the seam): target 0.05-0.15
      // — the agency-name chip carries its own solid contrast guarantee
      // now (see the identity mark below), so this tint no longer needs
      // to protect any text on its own; it's purely a "graded FOR this
      // frame" polish, kept within the zone's own target range.
      // Commercial Lock (2026-08): pushed to the low end of LOCK 2's own
      // Zone A target (0.05-0.15) — the range itself is unchanged, this
      // moves within it toward maximum photo visibility, since the
      // agency-name chip already carries its own contrast guarantee.
      `<defs><linearGradient id="pt" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${pal.ink}" stop-opacity="0.08"/>` +
        `<stop offset="0.55" stop-color="${pal.ink}" stop-opacity="0.02"/>` +
        `<stop offset="1" stop-color="${pal.ink}" stop-opacity="0.1"/>` +
        `</linearGradient></defs>`,
    );

    // The seam is never a flat cut — an off-axis line is the difference
    // between "a template with a photo slot" and a composed page. Reuses
    // the DNA's own seam language (the same motif DOCUMENT reads) so a
    // recruiter's choice of DNA still visibly changes this composition,
    // just applied to a smaller, quieter plane.
    let edgeLeft = panelTop;
    let edgeRight = panelTop;
    if (M.seam === "DIAGONAL_LEFT") {
      edgeLeft = panelTop - diag;
      edgeRight = panelTop + diag;
    } else if (M.seam === "DIAGONAL_RIGHT") {
      edgeLeft = panelTop + diag;
      edgeRight = panelTop - diag;
    }
    parts.push(`<polygon points="0,0 ${W},0 ${W},${edgeRight} 0,${edgeLeft}" fill="url(#pt)"/>`);
    // A hairline of accent colour along the seam — the one recurring
    // "premium detail" every reference mark shares: a deliberate edge,
    // not an accident of where two layers happen to meet.
    parts.push(
      `<line x1="0" y1="${edgeLeft}" x2="${W}" y2="${edgeRight}" stroke="${pal.accent}" stroke-width="${Math.max(2, Math.round(W * 0.0028))}"/>`,
    );
    // Header Safe Zone: when Gemini's own header-band artwork measured
    // flat (no strong subject — see headerZoneHasStrongSubject), give
    // that space a little more intentional presence instead of leaving
    // it read as empty. This is a soft, full-width accent band at the
    // BASE of the photo band only — never a solid overlay, never a crop,
    // never touching the artwork itself — so full-bleed photography is
    // still visible through it wherever Gemini did paint something.
    if (!headerZoneHasStrongSubject) {
      parts.push(
        `<defs><linearGradient id="headerBase" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${pal.ink}" stop-opacity="0"/>` +
          `<stop offset="1" stop-color="${pal.ink}" stop-opacity="0.22"/>` +
          `</linearGradient></defs>`,
      );
      const headerBaseH = Math.round(posterPhotoBand * 0.32);
      parts.push(
        `<rect x="0" y="${Math.max(0, panelTop - headerBaseH)}" width="${W}" height="${headerBaseH}" fill="url(#headerBase)"/>`,
      );
    }
    // The identity panel: brand ink as a GRADIENT scrim, not a lid.
    //
    // Painted fully opaque, this polygon used to cover every pixel of
    // Gemini's artwork below the seam — on a dense requirement that is
    // ~80% of the canvas, so the "visual hero campaign" archetype
    // rendered as a text-heavy structural list and Visual QA rejected it
    // for exactly that. A flat 0.88 fixed that but still darkened the
    // headline/employer/badge area needlessly — that block is large,
    // bold text that tolerates far less scrim than the dense small-
    // caption role list below it actually needs, and product direction
    // (LOCK 2) is explicit that the photograph must stay "clearly
    // recognisable", not just technically present behind a heavy wash.
    //
    // LOCK 2 (2026-08 visibility spec) tightened this further: the panel
    // is now zoned per the spec's own targets — Zone B (headline/campaign
    // metadata) ~0.25-0.40, Zone C (dense role list) ~0.45-0.60 — well
    // under what a flat scrim would need to GUARANTEE contrast against an
    // unknown bright photo on its own (that guarantee required ~0.87,
    // proven when this was still a flat 0.88). Going this much lighter is
    // only safe because every text element the scrim used to protect
    // alone now also carries its own scrim-independent stroke (see
    // textStroke, applied throughout this panel) — a local, per-element
    // contrast guarantee, exactly the "local contrast problem, not a
    // global opacity problem" LOCK 2 asks for.
    // Commercial Lock (2026-08): pushed toward the low end of LOCK 2's own
    // Zone B/C targets (0.25-0.40 / 0.45-0.60 respectively) — the approved
    // ranges are unchanged, this moves within them for maximum photograph
    // visibility (workers/cranes/machinery/project scale must read
    // clearly), safe only because every panel text element still carries
    // its own scrim-independent contrast guarantee via textStroke().
    const PANEL_SCRIM_LIGHT = 0.26;
    const PANEL_SCRIM_FULL = 0.48;
    const panelBottom = H - stripH;
    // Where the dense list begins, estimated the same way the
    // canvas-height solve above already does (panelTop + hero.contentH +
    // highlights.height) — this scrim is drawn before that point is
    // reached in the actual draw sequence, so it can only be estimated,
    // not read back; clamped so a degenerate panel (near-zero height)
    // never produces an invalid or inverted gradient.
    const listStartEstimate = panelTop + hero.contentH + highlights.height;
    const scrimTransition = Math.min(
      0.92,
      Math.max(0.08, (listStartEstimate - panelTop) / Math.max(1, panelBottom - panelTop)),
    );
    parts.push(
      `<defs><linearGradient id="panelScrim" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${pal.ink}" stop-opacity="${PANEL_SCRIM_LIGHT}"/>` +
        `<stop offset="${scrimTransition}" stop-color="${pal.ink}" stop-opacity="${PANEL_SCRIM_FULL}"/>` +
        `<stop offset="1" stop-color="${pal.ink}" stop-opacity="${PANEL_SCRIM_FULL}"/>` +
        `</linearGradient></defs>`,
    );
    parts.push(
      `<polygon points="0,${edgeLeft} ${W},${edgeRight} ${W},${H - stripH} 0,${H - stripH}" fill="url(#panelScrim)"/>`,
    );
    // The faintest lift toward the top of the panel gives it depth
    // without ever being visible as a "gradient" — a matte surface, not
    // a flat sticker.
    parts.push(
      `<defs><linearGradient id="pp" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${pal.reversed}" stop-opacity="0.05"/>` +
        `<stop offset="0.2" stop-color="${pal.reversed}" stop-opacity="0"/>` +
        `</linearGradient></defs>`,
    );
    parts.push(
      `<polygon points="0,${edgeLeft} ${W},${edgeRight} ${W},${H - stripH} 0,${H - stripH}" fill="url(#pp)"/>`,
    );

    // The agency's name, top-left, ON the photograph — the only thing the
    // reference genre consistently keeps directly on the image. Every
    // other mark in this composition sits on a scrim or a flat surface
    // with a guaranteed contrast floor; this text alone had neither —
    // the duotone photo tint above (id="pt") is tuned for the whole
    // frame, not for guaranteeing this one line of text stays readable
    // against an unknown bright sky or pale wall Gemini might place
    // top-left. A small solid chip gives it the same guarantee every
    // other fact in this file already has, and matches how the reference
    // genre itself always sets agency identity on its own contrast card
    // rather than bare on the photo.
    // Header Safe Zone: a modestly larger mark when Gemini's own header
    // band is flat/empty — claiming a bit more of that otherwise-wasted
    // space for the one piece of identity content that already lives
    // there, never by adding new content, only by giving it more weight.
    const headerMarkScale = headerZoneHasStrongSubject ? 1 : 1.15;
    const markText = agencyNameOf(facts).toUpperCase();
    // letter-spacing="2" below adds a literal 2px between EVERY character
    // pair — a reserve that must scale with the string's own length, not
    // a fixed fraction of font size, or a long agency name silently runs
    // the chip's text past its own background rectangle.
    const letterSpacingReserve = () => Math.round(Math.max(0, markText.length - 1) * 2.1);
    const measureChip = (size: number) => {
      const padX = Math.round(size * 0.7);
      const padY = Math.round(size * 0.55);
      const textW = Math.ceil(textWidth(markText, size, "SECTION")) + letterSpacingReserve();
      return { padX, padY, textW, chipW: textW + padX * 2, chipH: size + padY * 2 };
    };
    // Never let the identity chip run past the safe margin — shrink
    // (never truncate) until it fits, exactly like every other text
    // element in this file.
    const maxChipW = Math.round(W - margin * 2);
    let markSize = Math.max(plan.floor, Math.round(px(T.Caption) * headerMarkScale));
    let chip = measureChip(markSize);
    while (chip.chipW > maxChipW && markSize > plan.floor) {
      markSize -= 1;
      chip = measureChip(markSize);
    }
    const markPadX = chip.padX;
    const markPadY = chip.padY;
    const markTextW = chip.textW;
    const chipW = chip.chipW;
    const chipH = chip.chipH;
    const chipX = margin;
    const chipY = Math.round(margin * 0.55);
    parts.push(
      `<rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${Math.round(chipH * 0.16)}" ` +
        `fill="${pal.ink}" fill-opacity="0.78"/>`,
    );
    parts.push(
      `<rect x="${chipX}" y="${chipY + chipH - 3}" width="${Math.round(chipW * 0.42)}" height="3" fill="${pal.accent}"/>`,
    );
    parts.push(
      `<text x="${chipX + markPadX}" y="${chipY + markPadY + Math.round(markSize * 0.82)}" font-family="${roleFamily("SECTION")}" ` +
        `font-size="${markSize}" font-weight="600" fill="${pal.reversed}" letter-spacing="2">${esc(markText)}</text>`,
    );

    // ---- Panel content: eyebrow, destination, employer, project — a
    // true three-tier hierarchy (weight AND size, not size alone), set
    // on one flat surface so contrast is never in question. ----
    const panelX = margin;
    const panelW = contentW;

    if (M.ribbon !== "NONE") {
      const ribbonText = "WE ARE HIRING FOR";
      ribbonH = Math.round(px(T.Caption) * 1.7);
      ribbonY = panelTop + px(0.05);
      const ribbonS = Math.max(plan.floor, Math.round(ribbonH * 0.5));
      parts.push(
        `<text x="${panelX}" y="${ribbonY + Math.round(ribbonH * 0.7)}" font-family="${roleFamily("SECTION")}" font-size="${ribbonS}" ` +
          `font-weight="700" fill="${pal.accent}" ${textStroke(pal.ink, ribbonS)} letter-spacing="3">${esc(ribbonText)}</text>`,
      );
    }

    let y = ribbonY > 0 ? ribbonY + ribbonH + px(0.01) : panelTop + px(0.06);
    for (const l of hero.headlineLines) {
      const ls = Math.min(hero.headlineSize, fit(l, panelW, hero.headlineSize, plan.floor, "DISPLAY"));
      y += Math.round(ls * 0.86);
      // A thin ink stroke behind the fill — the KDL §4.3 scrim guarantees
      // legibility through darkening the WHOLE panel; the headline is
      // rank 1 ("always the largest element", KDL §4.4) and the one line
      // most exposed by lightening that scrim near the seam (LOCK 2), so
      // it also gets its own, scrim-independent contrast guarantee: dark
      // ink immediately at the glyph edge reads clearly against literally
      // any background, at any scrim opacity. Never a "typography system"
      // change — same font, weight, size and tracking as before.
      parts.push(
        `<text x="${panelX}" y="${y}" font-family="${roleFamily("DISPLAY")}" font-size="${ls}" font-weight="800" ` +
          `fill="${pal.reversed}" ${textStroke(pal.ink, ls)} letter-spacing="${M.headlineTracking}">${esc(l)}</text>`,
      );
      y += Math.round(ls * 0.28);
    }
    if (facts.employer && hero.employerSize) {
      y += px(0.016);
      const es = Math.min(hero.employerSize, fit(facts.employer, panelW, hero.employerSize, plan.floor, "DISPLAY"));
      y += Math.round(es * 0.78);
      parts.push(
        `<text x="${panelX}" y="${y}" font-family="${roleFamily("DISPLAY")}" font-size="${es}" font-weight="500" ` +
          `fill="${pal.accent}" ${textStroke(pal.ink, es)}>${esc(facts.employer)}</text>`,
      );
      y += Math.round(es * 0.3);
    }
    if (hero.sub && hero.subSize) {
      y += px(0.014);
      const ss = Math.min(hero.subSize, fit(hero.sub.toUpperCase(), panelW, hero.subSize, plan.floor, "SECTION"));
      y += Math.round(ss * 0.75);
      parts.push(
        `<text x="${panelX}" y="${y}" font-family="${roleFamily("SECTION")}" font-size="${ss}" font-weight="400" ` +
          `fill="${pal.reversed}" fill-opacity="0.72" ${textStroke(pal.ink, ss)} letter-spacing="2">${esc(hero.sub.toUpperCase())}</text>`,
      );
      y += Math.round(ss * 0.3);
    }
    if (hero.meta && hero.metaSize) {
      y += px(0.01);
      const ms = Math.min(hero.metaSize, fit(hero.meta, panelW, hero.metaSize, plan.floor, "SECTION"));
      y += Math.round(ms * 0.8);
      parts.push(
        `<text x="${panelX}" y="${y}" font-family="${roleFamily("SECTION")}" font-size="${ms}" fill="${pal.reversed}" fill-opacity="0.62" ${textStroke(pal.ink, ms)}>${esc(hero.meta)}</text>`,
      );
      y += Math.round(ms * 0.35);
    }
    // The verified vacancy total — commercially the single most important
    // number on a recruitment advertisement, and the exact fact planHero
    // already reserves badgeH for. While it went undrawn here, that
    // reserve turned into dead panel depth AND the advertisement never
    // stated how many jobs it was actually offering: a 127-vacancy
    // requirement published without its own headline number.
    const countLabel = headlineCountLabel(facts);
    if (countLabel) {
      const cs = Math.max(plan.floor, Math.round(hero.badgeH * 0.4));
      const cw = Math.min(panelW, Math.round(textWidth(countLabel, cs, "NUMERIC") + px(0.055)));
      y += px(0.022);
      parts.push(
        `<rect x="${panelX}" y="${y}" width="${cw}" height="${hero.badgeH}" rx="${Math.round(hero.badgeH * 0.5)}" fill="${pal.accent}"/>`,
      );
      parts.push(
        `<text x="${panelX + Math.round(cw / 2)}" y="${y + Math.round(hero.badgeH * 0.66)}" font-family="${roleFamily("NUMERIC")}" ` +
          `font-size="${cs}" font-weight="700" fill="${pal.accentText}" text-anchor="middle" letter-spacing="1.5">${esc(countLabel)}</text>`,
      );
      y += hero.badgeH;
    }

    // A short accent rule closes the identity block and opens the
    // positions section — the one recurring "custom divider" a reader
    // can learn to trust as "facts start here" across every advertisement.
    y += px(0.024);
    parts.push(`<rect x="${panelX}" y="${y}" width="${px(0.1)}" height="3" fill="${pal.accent}"/>`);
    y += px(0.03);

    // Featured-demand strip: emphasis only. Every role it names also
    // appears, with its own exact count, in the full list drawn right
    // below — this never substitutes for that list (Factual Integrity
    // Law, docs/010 Amendment 1: no verified role may be omitted).
    if (highlights.height > 0) {
      if (highlights.featured.length > 0) {
        parts.push(
          `<text x="${panelX}" y="${y + highlights.labelSize}" font-family="${roleFamily("SECTION")}" ` +
            `font-size="${highlights.labelSize}" font-weight="700" fill="${pal.accent}" ${textStroke(pal.ink, highlights.labelSize)} ` +
            `letter-spacing="2.5">HIGH-DEMAND TRADES</text>`,
        );
        y += Math.round(highlights.labelSize * 1.6) + px(0.014);
        const roleLineH = Math.round(highlights.roleSize * 1.35);
        for (const p of highlights.featured) {
          const line = posterRoleLine(p);
          const ls = fit(line, panelW, highlights.roleSize, plan.floor, "POSITION");
          parts.push(
            `<text x="${panelX}" y="${y + Math.round(highlights.roleSize * 0.85)}" font-family="${roleFamily("POSITION")}" ` +
              `font-size="${ls}" font-weight="800" fill="${pal.reversed}" ${textStroke(pal.ink, ls)} letter-spacing="0.3">${esc(line)}</text>`,
          );
          y += roleLineH;
        }
        y += px(0.018);
      }
      if (highlights.hookKeywords.length > 0) {
        const hookLine = highlights.hookKeywords.join("   ·   ");
        const hookLines = wrapLines(hookLine, panelW, highlights.hookSize, "FINE");
        for (const line of hookLines) {
          y += Math.round(highlights.hookSize * 1.1);
          parts.push(
            `<text x="${panelX}" y="${y}" font-family="${roleFamily("FINE")}" font-size="${highlights.hookSize}" ` +
              `font-weight="700" fill="${pal.accent}" fill-opacity="0.9" ${textStroke(pal.ink, highlights.hookSize)}>${esc(line.toUpperCase())}</text>`,
          );
          y += Math.round(highlights.hookSize * 0.4);
        }
        y += px(0.014);
      }
      y += px(0.02);
    }

    const posterBody = renderPosterBody(facts, W, y - px(0.014) - Math.round(plan.headingH), plan, pal);
    parts.push(posterBody.svg);
    posterBodyEndY = posterBody.endY;

    // The panel ends where its content ends.
    //
    // The solve budgets the panel from PLANNED component heights, which
    // is an upper bound — the drawn body reliably finishes above it. That
    // overshoot used to be left in place and filled with a giant
    // 5%-opacity initial, on the reasoning that an empty panel "reads as
    // an unfinished page". It does; but the answer is to not have an
    // empty panel, not to decorate one. A decorative mark must never be
    // the reason an advertisement is taller than its content (Final
    // Production UI Correction §2).
    //
    // Only the panel knows where it actually ended, so when the leftover
    // is material the canvas is re-rendered once at the height that
    // measured extent implies. The second pass runs this identical code
    // with the corrected H, so nothing is measured twice or estimated.
    // NB: edgeLeft/edgeRight are the seam's two ends — the TOP of the
    // panel — so they only ever floor this on a canvas whose body is
    // shorter than the seam itself. renderPosterBody's endY already
    // carries its own trailing advance past the last drawn row, so no
    // further pad is added here; the breathing space below is the whole
    // deliberate separation.
    const panelFloor = Math.max(edgeLeft, edgeRight);
    const leftoverTop = Math.max(posterBodyEndY, panelFloor);
    const leftover = H - stripH - leftoverTop;
    const TIGHTEN_THRESHOLD = px(0.03);
    // measureOnly deliberately takes this path too: the corrected height
    // IS the height, and a measure that skipped the correction would
    // report a canvas the renderer never produces.
    if (leftover > TIGHTEN_THRESHOLD && !input.internalForcedHeightPx && !fillSlot) {
      // Deliberate breathing space between the last content and the
      // trust strip (§6) — present, and no longer whatever the estimate
      // happened to leave over.
      const breathing = px(0.02);
      // The band and the tightened height depend on each other: the band
      // is capped at a fraction of the canvas, and shrinking the canvas
      // shrinks the band, which lifts the whole panel and shrinks the
      // canvas again. Iterating that would oscillate, and freezing the
      // band lets its share of a now-shorter canvas drift above the cap.
      //
      // The relationship is linear, so solve it once instead. Everything
      // below the band moves with it, so with
      //   K = (content depth below the band) + breathing + strip
      // the canvas is H = K + band, and the cap says band = 0.22H:
      //   H = K / (1 - 0.22),  band = H - K
      // bounded by the width-derived cap, which wins on tall canvases.
      const belowBand = leftoverTop - posterPhotoBand;
      const K = belowBand + breathing + stripH;
      const jointH = Math.round(K / (1 - POSTER_ARTWORK_MAX_FRACTION));
      const band = Math.min(posterArtworkWidthCap, Math.max(posterArtworkFloor, jointH - K));
      const tightened = K + band;

      // A requested canvas is a format contract, so the tighten pass
      // honours the same rule the solve does: shrink freely when the
      // requirement is genuinely shorter, but never land just under a
      // requested format (1080x1350 is a 4:5 portrait; 1240x1754 is A4).
      const snapsToFormat =
        tightened < input.heightPx && tightened >= Math.round(input.heightPx * 0.9);

      return renderFactLayer({
        ...input,
        internalForcedHeightPx: snapsToFormat ? input.heightPx : tightened,
        // When the canvas snaps back up to the requested format the band
        // may take its full share of that taller canvas again.
        internalForcedArtworkPx: snapsToFormat
          ? posterPhotoBandFor(input.heightPx)
          : band,
      });
    }
    // No tightening needed, so this IS the final height — the gates the
    // solve deferred now apply.
    assertHeightWithinLimits(H);

    // Already tight (or forced): a measure-only caller has its answer and
    // never needs the raster.
    if (input.measureOnly) {
      return {
        png: Buffer.alloc(0),
        heightPx: H,
        artworkHeightPx: posterPhotoBand,
        themeSelection,
        svgMarkup: "",
      };
    }
  } else {
    let seamLeft = heroPx;
    let seamRight = heroPx;
    if (M.seam === "DIAGONAL_LEFT") {
      seamLeft = heroPx - diag;
      seamRight = heroPx + diag;
    } else if (M.seam === "DIAGONAL_RIGHT") {
      seamLeft = heroPx + diag;
      seamRight = heroPx - diag;
    }
    if (M.seam === "STEP") {
      const top = heroPx - step;
      const bottom = heroPx + step;
      parts.push(`<polygon points="0,0 ${W},0 ${W},${bottom} ${mid},${bottom} ${mid},${top} 0,${top}" fill="url(#s)"/>`);
      parts.push(
        `<polygon points="0,${top} ${mid},${top} ${mid},${bottom} ${W},${bottom} ${W},${H - stripH} 0,${H - stripH}" ` +
          `fill="${pal.surface}"/>`,
      );
    } else {
      parts.push(`<polygon points="0,0 ${W},0 ${W},${seamRight} 0,${seamLeft}" fill="url(#s)"/>`);
      // Body surface: a known background, so factual text sits on a known
      // contrast pair rather than on whatever the image model produced.
      parts.push(
        `<polygon points="0,${seamLeft} ${W},${seamRight} ${W},${H - stripH} 0,${H - stripH}" fill="${pal.surface}"/>`,
      );
    }

    // ---- Header (KDL §4.2) ----
    // Capped like the hero: on a tall directory poster a height-proportional
    // header becomes a large empty slab of ink.
    headH = Math.min(Math.round(L.headerHeight * H), Math.round(0.15 * W));
    parts.push(`<rect x="0" y="0" width="${W}" height="${headH}" fill="${pal.ink}"/>`);
    const baseY = headH - Math.round(headH * 0.34);
    const agencyLabel = agencyNameOf(facts);
    const agencySize = fit(agencyLabel, contentW * 0.66, px(T.H3), plan.floor, "SECTION");
    parts.push(
      `<text x="${margin}" y="${baseY}" font-family="${roleFamily("SECTION")}" font-size="${agencySize}" font-weight="700" fill="${pal.reversed}">${esc(agencyLabel)}</text>`,
    );
    if (facts.country) {
      parts.push(
        `<text x="${W - margin}" y="${baseY}" font-family="${roleFamily("FINE")}" font-size="${px(T.Caption)}" fill="${pal.accent}" text-anchor="end" letter-spacing="2">${esc(facts.country.toUpperCase())}</text>`,
      );
    }
    parts.push(`<rect x="${margin}" y="${headH - 5}" width="${px(0.12)}" height="5" fill="${pal.accent}"/>`);

    // ---- Ribbon banner ----
    // Marketing copy, not a fact — kept distinct from facts.header so the
    // ribbon never echoes what the headline already states, and never states
    // anything a candidate could act on.
    ribbonH = M.ribbon === "NONE" ? 0 : Math.round(px(T.Caption) * 2.1);
    ribbonY = headH + px(0.02);
    if (M.ribbon !== "NONE") {
      const ribbonText = M.ribbonText;
      if (ribbonText) {
        const ribbonS = fit(ribbonText, Math.round(contentW * 0.5), Math.round(ribbonH * 0.42), plan.floor, "SECTION");
        const ribbonW = Math.round(textWidth(ribbonText, ribbonS, "SECTION") + px(0.07));
        const ribbonOnRight = M.ribbon === "NOTCHED_RIGHT";
        const ribbonX = ribbonOnRight ? W - margin - ribbonW : margin;
        if (M.ribbon === "BAR") {
          parts.push(`<rect x="${margin}" y="${ribbonY}" width="${ribbonW}" height="${ribbonH}" fill="${pal.accent}"/>`);
        } else {
          parts.push(`<path d="${ribbonPath(ribbonX, ribbonY, ribbonW, ribbonH, !ribbonOnRight)}" fill="${pal.accent}"/>`);
        }
        const ribbonCentre = ribbonX + Math.round(ribbonW / 2);
        parts.push(
          `<text x="${ribbonCentre}" ` +
            `y="${ribbonY + Math.round(ribbonH * 0.68)}" font-family="${roleFamily("SECTION")}" font-size="${ribbonS}" ` +
            `font-weight="700" fill="${pal.accentText}" text-anchor="middle" letter-spacing="1">${esc(ribbonText)}</text>`,
        );
      }
    }

    // ---- Hero text (KDL §4.4 ranks 1–4) — reserves the right edge for the
    // hero numeral so the two never collide. ----
    numeral = M.numeral === "NONE" ? null : heroNumeral(facts);
    const centred = M.heroAlign === "CENTRE";
    // A centred hero cannot also reserve a right-hand column for the numeral:
    // the two would fight over the same axis. Centred DNAs therefore set the
    // numeral beneath the text, so the reserve is only taken when left-set.
    const heroTextW = numeral && !centred ? Math.round(contentW * 0.6) : contentW;
    const heroX = centred ? Math.round(W / 2) : margin;
    const anchor = centred ? ` text-anchor="middle"` : "";
    const heroRibbonGap = Math.max(px(0.045), Math.round(hero.headlineSize * 0.85));
    let y = ribbonY + ribbonH + (M.ribbon === "NONE" ? px(0.02) : heroRibbonGap);
    for (const l of hero.headlineLines) {
      const ls = Math.min(hero.headlineSize, fit(l, heroTextW, hero.headlineSize, plan.floor, "DISPLAY"));
      parts.push(
        `<text x="${heroX}" y="${y}" font-family="${roleFamily("DISPLAY")}" font-size="${ls}" font-weight="800" fill="${pal.reversed}"${anchor} letter-spacing="${M.headlineTracking}">${esc(l)}</text>`,
      );
      y += Math.round(hero.headlineSize * 1.14);
    }
    if (facts.employer && hero.employerSize) {
      y += px(0.01);
      const es = Math.min(hero.employerSize, fit(facts.employer, heroTextW, hero.employerSize, plan.floor, "DISPLAY"));
      parts.push(
        `<text x="${heroX}" y="${y}" font-family="${roleFamily("DISPLAY")}" font-size="${es}" font-weight="700" fill="${pal.accent}"${anchor}>${esc(facts.employer)}</text>`,
      );
      y += Math.round(hero.employerSize * 1.08);
    }
    if (hero.sub && hero.subSize) {
      y += px(0.006);
      parts.push(
        `<text x="${heroX}" y="${y}" font-family="${roleFamily("SECTION")}" font-size="${Math.min(hero.subSize, fit(hero.sub, heroTextW, hero.subSize, plan.floor))}" fill="${pal.reversed}"${anchor} opacity="0.9">${esc(hero.sub)}</text>`,
      );
      y += Math.round(hero.subSize * 1.15);
    }
    if (hero.meta && hero.metaSize) {
      parts.push(
        `<text x="${heroX}" y="${y}" font-family="${roleFamily("SECTION")}" font-size="${Math.min(hero.metaSize, fit(hero.meta, heroTextW, hero.metaSize, plan.floor))}" fill="${pal.reversed}"${anchor} opacity="0.75">${esc(hero.meta)}</text>`,
      );
      y += Math.round(hero.metaSize * 1.3);
    }

    // ---- Hero numeral — the verified count as a graphic rather than a
    // caption. The value is exactly what headlineCountLabel already computes;
    // the DNA only chooses how large it is set. ----
    if (numeral) {
      const display = M.numeral === "DISPLAY";
      if (centred) {
        // Inline, beneath the hero text, in the space planHero reserved.
        const numSize = hero.numeralSize;
        const capSize = hero.numeralCaptionSize;
        y += px(0.012) + Math.round(numSize * 0.82);
        parts.push(
          `<text x="${Math.round(W / 2)}" y="${y}" font-family="${roleFamily("NUMERIC")}" font-size="${numSize}" ` +
            `font-weight="800" fill="${pal.accent}" text-anchor="middle" letter-spacing="-2">${esc(numeral.num)}</text>`,
        );
        y += Math.round(capSize * 1.5);
        parts.push(
          `<text x="${Math.round(W / 2)}" y="${y}" font-family="${roleFamily("SECTION")}" font-size="${capSize}" ` +
            `font-weight="700" fill="${pal.reversed}" text-anchor="middle" letter-spacing="2">${esc(numeral.caption)}</text>`,
        );
      } else {
        const numX = W - margin;
        const numBaseline = Math.min(Math.round(heroPx * 0.86), heroPx - px(0.06));
        const numSize = display
          ? Math.min(Math.round(W * 0.24), Math.round(heroPx * 0.4))
          : Math.min(Math.round(W * 0.1), Math.round(heroPx * 0.18));
        const capSize = Math.max(plan.floor, Math.round(numSize * (display ? 0.2 : 0.32)));
        parts.push(
          `<text x="${numX}" y="${numBaseline}" font-family="${roleFamily("NUMERIC")}" font-size="${numSize}" ` +
            `font-weight="800" fill="${pal.accent}" text-anchor="end" letter-spacing="-2">${esc(numeral.num)}</text>`,
        );
        parts.push(
          `<text x="${numX}" y="${numBaseline + Math.round(capSize * 1.3)}" font-family="${roleFamily("SECTION")}" font-size="${capSize}" ` +
            `font-weight="700" fill="${pal.reversed}" text-anchor="end" letter-spacing="2">${esc(numeral.caption)}</text>`,
        );
      }
    }
  }

  const body = poster
    ? { svg: "", endY: posterBodyEndY }
    : renderBody(dna, facts, W, heroPx, plan, dense, 0, W, 1, pal);
  parts.push(body.svg);

  // ---- Trust callout — fills leftover depth above the branding strip
  // instead of leaving it a dead gap, and doubles as a signature/trust
  // element (verified chip + direct contact). DNAs that want the quietest
  // possible page switch it off. ----
  const calloutTop = body.endY + px(0.02);
  const calloutBottom = H - stripH - px(0.03);
  // The split panel already ends directly into the real trust strip
  // (branding-overlay.ts) with no gap — stacking this decorative callout
  // on top of it repeated the same phone number twice and read as two
  // competing trust badges. DOCUMENT still uses it to fill the dead
  // space its cream surface would otherwise leave above the strip.
  if (!poster && M.trustCallout && calloutBottom - calloutTop >= px(0.05)) {
    const boxY = calloutTop;
    const boxH = calloutBottom - calloutTop;
    const boxX = margin;
    const boxW = contentW;
    // A poster keeps this translucent-on-photo, matching every other mark
    // in the composition — an opaque white card here is exactly the
    // "document patched onto a photo" tell the rest of POSTER removes.
    // The callout now sits on the identity panel (solid ink), not on
    // photography — a translucent-ink fill would nearly vanish against
    // an ink background. A thin reversed hairline keeps it a distinct,
    // deliberate card without ever competing with the panel it's on.
    const calloutFill = poster ? pal.reversed : pal.paper;
    const calloutOpacity = poster ? ' fill-opacity="0.06"' : "";
    const calloutStroke = poster
      ? `stroke="${pal.reversed}" stroke-width="1" stroke-opacity="0.35"`
      : `stroke="${pal.ink}" stroke-width="2" stroke-dasharray="9 7"`;
    const calloutText = poster ? pal.reversed : pal.ink;
    const calloutMuted = poster ? pal.reversed : pal.muted;
    parts.push(
      `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="${px(L.cornerRadius * 2.25)}" ` +
        `fill="${calloutFill}"${calloutOpacity} ${calloutStroke}/>`,
    );
    const midY = boxY + Math.round(boxH / 2);
    const chipSize = Math.max(plan.floor, Math.round(px(T.Caption) * 0.95));
    const chipR = Math.round(chipSize * 0.6);
    const rowGapV = Math.round(boxH * 0.28);
    const chipY = Math.max(boxY + Math.round(boxH * 0.24), midY - rowGapV);
    parts.push(iconGlyph("check", boxX + px(0.04) + chipR, chipY, chipR, poster ? pal.accent : pal.ink));
    parts.push(
      `<text x="${boxX + px(0.04) + chipR * 2 + px(0.012)}" y="${chipY + Math.round(chipSize * 0.32)}" ` +
        `font-family="${roleFamily("SECTION")}" font-size="${chipSize}" font-weight="700" fill="${calloutText}" ` +
        `letter-spacing="1">VERIFIED ADVERTISEMENT</text>`,
    );
    const contactRowY = Math.min(boxY + boxH - Math.round(boxH * 0.24), midY + rowGapV);
    const cSize = Math.max(plan.floor, Math.round(px(T.BodyL)));
    let cx = boxX + px(0.04);
    if (facts.contact.phone) {
      const r = Math.round(cSize * 0.6);
      parts.push(iconGlyph("phone", cx + r, contactRowY, r, calloutText));
      cx += r * 2 + px(0.01);
      parts.push(
        `<text x="${cx}" y="${contactRowY + Math.round(cSize * 0.32)}" font-family="${roleFamily("FINE")}" font-size="${cSize}" font-weight="700" fill="${calloutText}">${esc(facts.contact.phone)}</text>`,
      );
      cx += Math.round(textWidth(facts.contact.phone, cSize, "FINE")) + px(0.035);
    }
    if (facts.contact.whatsapp) {
      const r = Math.round(cSize * 0.6);
      parts.push(iconGlyph("chat", cx + r, contactRowY, r, calloutMuted));
      cx += r * 2 + px(0.01);
      parts.push(
        `<text x="${cx}" y="${contactRowY + Math.round(cSize * 0.32)}" font-family="${roleFamily("FINE")}" font-size="${cSize}" fill="${calloutMuted}">${esc(facts.contact.whatsapp)}</text>`,
      );
    }
  }

  parts.push(`</svg>`);

  const markup = parts.join("");
  const png = await sharp(Buffer.from(markup)).png().toBuffer();
  // POSTER's artwork is the confined photo plane above the identity
  // panel — reported accurately so the watermark (confined to "the
  // artwork region") never tiles across the solid panel below it.
  const artworkHeightPx = poster ? panelTop : heroPx;
  return { png, heightPx: H, artworkHeightPx, themeSelection, svgMarkup: innerSvg(markup) };
}

/**
 * POSTER row rendering: every position is a bullet directly on the photo
 * scrim — no card, no fill, light/reversed text — matching the reference
 * social-recruitment-poster genre. Shares `plan`'s row heights and column
 * geometry with the DOCUMENT path (`renderBody`), so the same capacity
 * solve and the same "never truncates, never omits a fact, fails loud
 * past the legibility floor" guarantees hold here too — only the marks
 * drawn in each row differ.
 */
function renderPosterBody(
  facts: AdvertisementFacts,
  W: number,
  heroPx: number,
  plan: Plan,
  pal: Palette,
): { svg: string; endY: number } {
  const px = (f: number) => Math.round(f * W);
  const { colW, cols, gutter, titleSize, detailSize, showDetail, floor, margin } = plan;
  const parts: string[] = [];

  // The heading rule and label stay unclaimed on a poster — a candidate
  // scanning a feed does not need a section title to know a bullet list
  // is the list of roles — but the vertical space `plan` reserved for it
  // is still consumed, so the canvas-height solve (which budgeted for it)
  // and the drawing never disagree about where content actually starts.
  const startY = heroPx + plan.headingH + px(0.014);

  // A single position row — the bullet, the wrapped title (with its
  // verified vacancy count folded in) and, when the tier shows it, the
  // per-role detail line. Shared by both the flat and the grouped
  // layouts below so a role renders identically either way.
  const drawPositionRow = (
    p: AdvertisementFacts["positions"][number],
    colX: number,
    rowTop: number,
    tw: number,
    detailOverride?: string,
  ) => {
    const cy = rowTop + Math.round(titleSize * 0.92);
    const bs = Math.round(titleSize * 0.42);
    // A small triangular bullet — the trade convention this whole genre
    // uses instead of a numbered badge or a card.
    parts.push(
      `<path d="M ${colX} ${cy - bs} L ${colX + bs} ${cy - Math.round(bs * 0.42)} L ${colX} ${cy + Math.round(bs * 0.16)} Z" fill="${pal.accent}"/>`,
    );
    // Planner and renderer share one column geometry, always: plan.badgeW
    // IS this composition's bullet + gap (see planBody), and the measure
    // below is the exact width planBody wrapped against. Deriving a
    // second, slightly different measure here is what let a wrapped
    // second line escape the row box the planner had reserved.
    const tx = colX + plan.badgeW;
    let ly = cy;
    // The verified vacancy count per role — "(20 NOS)" — is the trade
    // convention this genre actually uses. Folded into the wrapped
    // title itself rather than a separate badge, so it can never be
    // silently dropped and is measured exactly like the rest of the line.
    const lines = wrap(posterRoleLine(p), tw, titleSize, plan.maxLines, "POSITION");
    for (const line of lines) {
      const ls = fit(line, tw, titleSize, floor, "POSITION");
      parts.push(
        `<text x="${tx}" y="${ly}" font-family="${roleFamily("POSITION")}" font-size="${ls}" font-weight="700" ` +
          `fill="${pal.reversed}" ${textStroke(pal.ink, ls)} letter-spacing="0.5">${esc(line)}</text>`,
      );
      ly += Math.round(titleSize * plan.lineFactor);
    }
    if (showDetail) {
      const d = detailOverride ?? roleDetail(p);
      if (d) {
        // Wrapped, not shrunk-and-clipped: a functional technical-duties
        // sentence can be several times longer than a "5-8 yrs · Diploma"
        // phrase, and fit() alone only shrinks a SINGLE line — past the
        // legibility floor it let the line run straight off the canvas
        // edge instead of wrapping. wrapLines here is the exact function
        // positionRowHeight measured with, so the row's reserved height
        // and what actually draws can never disagree (§9 geometry parity).
        for (const dLine of wrapLines(d, tw, detailSize, "FINE")) {
          parts.push(
            `<text x="${tx}" y="${ly}" font-family="${roleFamily("FINE")}" font-size="${detailSize}" fill="${pal.reversed}" fill-opacity="0.78" ${textStroke(pal.ink, detailSize)}>${esc(dLine)}</text>`,
          );
          ly += Math.round(detailSize * 1.3);
        }
      }
    }
  };

  if (plan.groupedEntries) {
    // Role-family grouping: one flowing column — a family header, its
    // roles (each still its own row with its own exact vacancy count),
    // then, only when genuinely shared, one "Common requirement" line
    // for that family. Every position from plan.groupedEntries is drawn
    // exactly once; grouping only ever reorders and labels, it never
    // drops or merges a verified fact.
    const colX = margin;
    const tw = colW - plan.badgeW - plan.salaryW;
    let rowTopCursor = startY;
    for (let i = 0; i < plan.groupedEntries.length; i++) {
      const entry = plan.groupedEntries[i];
      const h = plan.rowHeights[i];
      if (entry.kind === "familyHeader") {
        const fy = rowTopCursor + Math.round(detailSize * 1.1);
        parts.push(
          `<text x="${colX}" y="${fy}" font-family="${roleFamily("SECTION")}" font-size="${detailSize}" ` +
            `font-weight="700" letter-spacing="1" fill="${pal.accent}" ${textStroke(pal.ink, detailSize)}>${esc(entry.label)}</text>`,
        );
        // Anchored to the BOTTOM of this row's own reserved height, not
        // offset from the text baseline — a baseline-relative offset sat
        // close enough to overlap glyph descenders once stroke width was
        // added to the label text.
        const ruleY = rowTopCursor + h - 4;
        parts.push(
          `<rect x="${colX}" y="${ruleY}" width="${Math.round(tw * 0.14)}" height="2" fill="${pal.accent}" fill-opacity="0.6"/>`,
        );
      } else if (entry.kind === "position") {
        drawPositionRow(facts.positions[entry.idx], colX, rowTopCursor, tw, entry.detail);
      } else {
        // Common requirement — the one shared qualification this family's
        // members actually carry, verbatim, never a paraphrase.
        const cy = rowTopCursor + Math.round(detailSize * 1.05);
        const cs = Math.max(floor, Math.round(detailSize * 0.94));
        parts.push(
          `<text x="${colX}" y="${cy}" font-family="${roleFamily("FINE")}" font-size="${cs}" font-style="italic" ` +
            `fill="${pal.reversed}" fill-opacity="0.72" ${textStroke(pal.ink, cs)}>${esc(entry.text)}</text>`,
        );
      }
      rowTopCursor += h;
    }
  } else {
    for (let c = 0; c < cols; c++) {
      const colX = margin + c * (colW + gutter);
      let rowTopCursor = startY;
      // plan.columns balances each column by actual row HEIGHT, not a flat
      // item count — a title that wraps to a second line no longer makes
      // one column visibly taller than the other with empty space beneath
      // the shorter one. Still strict source order: a role is never moved
      // out of sequence, only the column boundary shifts.
      for (const rowIndex of plan.columns[c]) {
        const p = facts.positions[rowIndex];
        const rowTop = rowTopCursor;
        const tw = colW - plan.badgeW - plan.salaryW;
        drawPositionRow(p, colX, rowTop, tw);
        rowTopCursor += plan.rowHeights[rowIndex] ?? Math.max(titleSize, 1);
      }
    }
  }

  let sy = startY + plan.listH + px(0.02);

  // Benefits — a compact icon-chip row directly on the photo. Omitted
  // entirely when absent (KDL §4.5.1).
  if (facts.benefits.length) {
    const chipH = px(0.038);
    const iconR = Math.round(chipH * 0.3);
    let bx = margin;
    const rowMidY = sy + Math.round(chipH * 0.5);
    for (const b of facts.benefits) {
      const label = b.detail ? `${b.label}: ${b.detail}` : b.label;
      const s = Math.max(floor, Math.round(chipH * 0.42));
      const kind = benefitIconKind(b.label);
      parts.push(iconGlyph(kind, bx + iconR, rowMidY, iconR, pal.accent));
      const tx = bx + iconR * 2 + Math.round(px(0.008));
      parts.push(
        `<text x="${tx}" y="${rowMidY + Math.round(s * 0.32)}" font-family="${roleFamily("FINE")}" font-size="${s}" font-weight="600" fill="${pal.reversed}" ${textStroke(pal.ink, s)}>${esc(label)}</text>`,
      );
      bx = tx + Math.round(textWidth(label, s, "FINE")) + px(0.03);
      if (bx > margin + plan.contentW * 0.94) break; // never truncates a fact — overflow benefits still verified, just not iconised on this row
    }
    sy += chipH + px(0.022);
  }

  // Interview — a small translucent pill directly on the photo. Omitted
  // entirely when absent.
  const ev = facts.interview[0];
  if (ev) {
    const detail = [ev.date, ev.location].filter(Boolean).join(" · ");
    if (detail) {
      const s = Math.max(floor, px(0.0185));
      const label = `INTERVIEW   ${detail}`;
      const boxH = Math.round(s * 2.5);
      const boxW = Math.min(plan.contentW, Math.round(textWidth(label, s, "FINE") + px(0.06)));
      parts.push(
        `<rect x="${margin}" y="${sy}" width="${boxW}" height="${boxH}" rx="${Math.round(boxH * 0.2)}" fill="${pal.ink}" fill-opacity="0.55"/>`,
      );
      const iconR = Math.round(s * 0.55);
      parts.push(iconGlyph("calendar", margin + px(0.024) + iconR, sy + Math.round(boxH / 2), iconR, pal.accent));
      const labelX = margin + px(0.024) + iconR * 2 + px(0.01);
      parts.push(
        `<text x="${labelX}" y="${sy + Math.round(boxH * 0.63)}" font-family="${roleFamily("SECTION")}" font-size="${s}" font-weight="700" fill="${pal.accent}">INTERVIEW</text>`,
      );
      parts.push(
        `<text x="${labelX + Math.round(textWidth("INTERVIEW  ", s, "SECTION"))}" y="${sy + Math.round(boxH * 0.63)}" font-family="${roleFamily("FINE")}" font-size="${s}" fill="${pal.reversed}">${esc(detail)}</text>`,
      );
      sy += boxH + px(0.02);
    }
  }

  // Eligibility footer note — a verified recruiter-stated requirement
  // (e.g. minimum experience), never invented and never dropped silently
  // (Factual Integrity Law, docs/010 Amendment 1). Wraps rather than
  // truncates, the same rule the position list and benefits row follow.
  if (facts.footer) {
    const s = Math.max(floor, px(0.0135));
    for (const line of wrapLines(facts.footer, plan.contentW, s, "FINE")) {
      sy += Math.round(s * 1.1);
      parts.push(
        `<text x="${margin}" y="${sy}" font-family="${roleFamily("FINE")}" font-size="${s}" fill="${pal.reversed}" opacity="0.75">${esc(line)}</text>`,
      );
      sy += Math.round(s * 0.5);
    }
  }

  return { svg: parts.join(""), endY: sy };
}

function renderBody(
  dna: DesignDNA,
  facts: AdvertisementFacts,
  W: number,
  heroPx: number,
  plan: Plan,
  dense = false,
  edge = 0,
  innerW = W,
  chromeScale = 1,
  pal: Palette = dna.palette,
): { svg: string; endY: number } {
  const T = dna.type;
  const M = dna.motifs;
  const px = (f: number) => Math.round(f * W);
  const { colW, cols, gutter, titleSize, detailSize, showDetail, rowGap, badgeW, floor } = plan;
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
      `<text x="${Math.round(W / 2)}" y="${y + Math.round(secH * 0.68)}" font-family="${roleFamily("SECTION")}" ` +
        `font-size="${Math.round(secH * 0.44)}" font-weight="700" fill="${pal.reversed}" text-anchor="middle" ` +
        `letter-spacing="3">POSITIONS AVAILABLE</text>`,
    );
    y += secH + px(0.012) + titleSize;
  } else {
    y = heroPx + px(0.035) + px(T.H2);
    parts.push(
      `<text x="${margin}" y="${y}" font-family="${roleFamily("SECTION")}" font-size="${px(T.H2)}" font-weight="700" fill="${pal.ink}">POSITIONS</text>`,
    );
    parts.push(`<rect x="${margin}" y="${y + px(0.009)}" width="${px(0.075)}" height="3" fill="${pal.accent}"/>`);
    y += plan.headingH - px(T.H2) + px(0.012);
  }

  // High Density: a column header rules the table, so a candidate scanning
  // forty roles knows what the right-hand figure means without re-reading.
  if (dense && plan.hasSalary) {
    const hs = Math.max(floor, Math.round(px(T.Caption) * 0.85));
    parts.push(
      `<text x="${margin}" y="${y - px(0.004)}" font-family="${roleFamily("SECTION")}" font-size="${hs}" ` +
        `font-weight="700" fill="${pal.muted}" letter-spacing="1">POSITION</text>`,
    );
    parts.push(
      `<text x="${margin + plan.contentW}" y="${y - px(0.004)}" font-family="${roleFamily("SECTION")}" font-size="${hs}" ` +
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
    // plan.columns balances each column by actual row height rather than
    // a flat item count — see splitColumnsByHeight; still strict source
    // order within and across columns.
    for (const rowIndex of plan.columns[c]) {
      const p = facts.positions[rowIndex];
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
          `<text x="${colX + Math.round(px(0.042) / 2)}" y="${cy - Math.round(titleSize * 0.1)}" font-family="${roleFamily("NUMERIC")}" font-size="${bs}" font-weight="700" fill="${pal.ink}" text-anchor="middle">${esc(String(p.count))}</text>`,
        );
      }
      if (p.count != null && dense && badgeW > 0) {
        // A plain black numeral, no coloured cell behind it — neither real
        // reference indexes its rows with a filled badge.
        const rh = plan.rowHeights[rowIndex] ?? Math.round(titleSize * 1.6);
        rowParts.push(
          `<text x="${colX + Math.round(badgeW / 2)}" y="${rowTop + Math.round(rh / 2) + Math.round(titleSize * 0.32)}" ` +
            `font-family="${roleFamily("NUMERIC")}" font-size="${Math.round(titleSize * 0.82)}" font-weight="700" ` +
            `fill="${pal.ink}" text-anchor="middle">${esc(String(p.count))}</text>`,
        );
      }
      const tx = colX + badgeW + (dense ? Math.round(W * 0.008) : 0);
      const tw = colWHere - badgeW - plan.salaryW;
      // Titles wrap; they are never truncated and never shrunk below the floor.
      // Wrapped and measured on the true text — only the drawn glyphs are
      // uppercased in dense mode, matching how both real classifieds set
      // every trade name in the table.
      const lines = wrap(displayTitle(p.title), tw, titleSize, plan.maxLines, "POSITION");
      const firstBaseline = cy;
      for (const line of lines) {
        const drawn = M.uppercaseTitles ? line.toUpperCase() : line;
        const ls = fit(drawn, tw, titleSize, floor, "POSITION");
        rowParts.push(
          `<text x="${tx}" y="${cy}" font-family="${roleFamily("POSITION")}" font-size="${ls}" font-weight="600" fill="${pal.ink}">${esc(drawn)}</text>`,
        );
        cy += Math.round(titleSize * plan.lineFactor);
      }
      if (dense && p.salary && plan.hasSalary) {
        // Salary is the conversion driver: promoted to its own right-hand
        // column at title weight, on the row's first baseline.
        // Role reads first, salary second. Set at the same weight the two
        // competed and the eye had nowhere to land.
        const ss = fit(p.salary, plan.salaryW, Math.round(titleSize * 0.92), floor, "NUMERIC");
        rowParts.push(
          `<text x="${colX + colWHere}" y="${firstBaseline}" font-family="${roleFamily("NUMERIC")}" ` +
            `font-size="${ss}" font-weight="600" fill="${pal.muted}" text-anchor="end">${esc(p.salary)}</text>`,
        );
      }
      if (showDetail) {
        const d = roleDetail(p);
        if (d) {
          const ds = fit(d, tw, detailSize, floor, "FINE");
          rowParts.push(
            `<text x="${tx}" y="${cy}" font-family="${roleFamily("FINE")}" font-size="${ds}" fill="${pal.muted}">${esc(d)}</text>`,
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
      // How a row is dressed is a DNA motif, not a property of the
      // composition. A ruled table on a light surface and a carded list are
      // the same row, the same planned height and the same capacity solve —
      // only the furniture drawn beneath the text differs.
      if (M.rowStyle === "RULED") {
        // A hairline rule beneath each row, and a hairline dividing the
        // title from the salary figure. Both real Gulf classifieds studied
        // for this composition are built this way — ruled rows on white, no
        // card chrome, no alternating tint, no coloured vacancy badge.
        if (plan.hasSalary) {
          parts.push(
            `<rect x="${colX + colWHere - plan.salaryW}" y="${rowTop}" width="1" height="${cardH}" fill="${pal.ink}" opacity="0.4"/>`,
          );
        }
        parts.push(
          `<rect x="${colX}" y="${rowTop + cardH}" width="${colWHere}" height="1" fill="${pal.ink}" opacity="0.5"/>`,
        );
      } else if (M.rowStyle === "BANDED") {
        // Alternating bands are easier to track than hairlines across a wide
        // measure — the eye keeps its place on a forty-role table.
        if (rowIndex % 2 === 0) {
          parts.push(
            `<rect x="${colX - inset}" y="${rowTop}" width="${colW + inset * 2}" height="${cardH}" fill="${pal.tint}"/>`,
          );
        }
        if (plan.hasSalary) {
          parts.push(
            `<rect x="${colX + colWHere - plan.salaryW}" y="${rowTop}" width="1" height="${cardH}" fill="${pal.ink}" opacity="0.25"/>`,
          );
        }
      } else if (M.rowStyle === "CARD") {
        parts.push(
          `<rect x="${colX - inset}" y="${rowTop}" width="${colW + inset * 2}" height="${cardH}" rx="${px(dna.layout.cornerRadius)}" fill="${pal.paper}" stroke="${pal.rule}" stroke-width="1"/>`,
        );
      }
      // "PLAIN" draws no furniture at all — the type carries the row.
      parts.push(...rowParts);
      rowTopCursor += plan.rowHeights[rowIndex] ?? cardH + 1;
    }
  }

  let sy = startY + plan.listH + px(0.016);

  // Benefits — omitted entirely when absent (KDL §4.5.1). The style is a
  // DNA motif; the reserved height is computed from the same motif in
  // planBody, so the plan and the draw can never disagree.
  if (facts.benefits.length) {
    if (M.benefitStyle === "TEXT_STRIP") {
      const text = facts.benefits.map((b) => (b.detail ? `${b.label}: ${b.detail}` : b.label)).join("   ·   ");
      const s = fit(text, plan.contentW, px(T.Caption), floor, "FINE");
      const barH = Math.round(s * 2.4);
      parts.push(`<rect x="0" y="${sy - Math.round(s * 1.1)}" width="${W}" height="${barH}" fill="${pal.ink}"/>`);
      parts.push(
        `<text x="${margin}" y="${sy + Math.round(s * 0.42)}" font-family="${roleFamily("FINE")}" font-size="${s}" fill="${pal.accent}">${esc(text)}</text>`,
      );
      sy += Math.round(s * 2.7);
    } else {
      // An icon- or chip-led benefit row, not a bullet-joined caption. A
      // candidate scanning a feed reads shapes before they read words.
      const chipH = px(0.052);
      const iconR = Math.round(chipH * 0.28);
      const gap = px(0.018);
      const chips = M.benefitStyle === "CHIPS";
      parts.push(`<rect x="0" y="${sy - Math.round(chipH * 0.72)}" width="${W}" height="${chipH * 2}" fill="${pal.ink}"/>`);
      let bx = margin;
      const rowMidY = sy - Math.round(chipH * 0.72) + chipH;
      for (const b of facts.benefits) {
        const label = b.detail ? `${b.label}: ${b.detail}` : b.label;
        const s = Math.max(floor, Math.round(chipH * 0.34));
        if (chips) {
          // A filled pill carrying the benefit, set in accent-on-ink.
          const padX = Math.round(s * 0.7);
          const pillW = Math.round(textWidth(label, s, "FINE")) + padX * 2;
          const pillH = Math.round(s * 2);
          if (bx + pillW > margin + plan.contentW) break;
          parts.push(
            `<rect x="${bx}" y="${rowMidY - Math.round(pillH / 2)}" width="${pillW}" height="${pillH}" ` +
              `rx="${Math.round(pillH / 2)}" fill="${pal.accent}"/>`,
          );
          parts.push(
            `<text x="${bx + Math.round(pillW / 2)}" y="${rowMidY + Math.round(s * 0.34)}" font-family="${roleFamily("FINE")}" ` +
              `font-size="${s}" font-weight="700" fill="${pal.accentText}" text-anchor="middle">${esc(label)}</text>`,
          );
          bx += pillW + Math.round(gap);
          continue;
        }
        const kind = benefitIconKind(b.label);
        parts.push(iconGlyph(kind, bx + iconR, rowMidY, iconR, pal.accent));
        const tx = bx + iconR * 2 + Math.round(gap * 0.5);
        parts.push(
          `<text x="${tx}" y="${rowMidY + Math.round(s * 0.32)}" font-family="${roleFamily("FINE")}" font-size="${s}" font-weight="600" fill="${pal.reversed}">${esc(label)}</text>`,
        );
        bx = tx + Math.round(textWidth(label, s, "FINE")) + gap * 2.2;
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
      const s = fit(`INTERVIEW   ${detail}`, plan.contentW, px(T.Caption), floor, "FINE");
      const iconR = Math.round(s * 0.55);
      parts.push(iconGlyph("calendar", margin + iconR, sy + Math.round(s * 0.55), iconR, pal.ink));
      const tx = margin + iconR * 2 + Math.round(px(0.012));
      parts.push(
        `<text x="${tx}" y="${sy + Math.round(s * 1.1)}" font-family="${roleFamily("SECTION")}" font-size="${s}" font-weight="700" fill="${pal.ink}">INTERVIEW</text>`,
      );
      parts.push(
        `<text x="${tx + Math.round(textWidth("INTERVIEW   ", s, "SECTION"))}" y="${sy + Math.round(s * 1.1)}" font-family="${roleFamily("FINE")}" font-size="${s}" fill="${pal.muted}">${esc(detail)}</text>`,
      );
      sy += Math.round(s * 2.2);
    }
  }

  // Eligibility footer note — a verified recruiter-stated requirement
  // (e.g. minimum experience), never invented and never dropped silently
  // (Factual Integrity Law, docs/010 Amendment 1).
  if (facts.footer) {
    const s = Math.max(floor, px(0.012));
    for (const line of wrapLines(facts.footer, plan.contentW, s, "FINE")) {
      sy += Math.round(s * 1.1);
      parts.push(
        `<text x="${margin}" y="${sy}" font-family="${roleFamily("FINE")}" font-size="${s}" fill="${pal.muted}">${esc(line)}</text>`,
      );
      sy += Math.round(s * 0.5);
    }
  }

  return { svg: parts.join(""), endY: sy };
}
