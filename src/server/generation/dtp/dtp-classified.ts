/**
 * DTP CLASSIFIED ADVERTISEMENT — a single 6cm-wide newspaper booking.
 *
 * WHAT THE BOOKING SLIPS ESTABLISH
 *
 * Real Assignments Abroad Times release orders price an advertisement
 * as width x height x rate-per-square-centimetre:
 *
 *   6 x 5 cm  @ 1000/sq.cm = 30,000  (B/W)
 *   6 x 5 cm  @ 1300/sq.cm = 39,000  (colour)
 *   6 x 11 cm @  800/sq.cm = 52,800
 *
 * Three consequences, and they are the whole basis of this module:
 *
 *  1. Width is fixed at 6cm — the classified column. Never derived by
 *     dividing a canvas.
 *  2. HEIGHT is the purchased variable, from 5cm upward in whole
 *     centimetres. 6x5 is the smallest real booking; there is no 6x8
 *     minimum and no 6x56 size.
 *  3. Every square centimetre is paid for, which is why these
 *     advertisements are so dense: white space is money.
 *
 * WHY HEIGHT CANNOT SIMPLY STRETCH
 *
 * A 6x12 is not a 6x5 with more air. The taller booking buys a
 * different information architecture: it carries benefit and salary
 * panels, interview and venue bars, eligibility notes and a full
 * agency footer that a 6x5 has no room for. So the renderer selects
 * WHICH sections appear from the height purchased, then fits them —
 * rather than laying out one structure and scaling it.
 */
import { cmToPx, DTP_DEFAULT_DPI } from "@/lib/dtp-format-law";
import { resolveSlotImage } from "@/lib/brand-identity";
import { LayoutCapacityError } from "../pipeline/fact-layer";
import {
  DTP_TYPE,
  dtpFamily,
  dtpLineHeight,
  dtpSize,
  dtpText,
  dtpTextWidth,
  dtpWrap,
  type DtpToken,
} from "./dtp-typography";
import type { DtpAdvertisement } from "./dtp-ad-block";

/** The classified column: fixed, from the format law's smallest slot. */
export const DTP_CLASSIFIED_WIDTH_CM = 6.0;

/**
 * The bookable height family, in whole centimetres.
 *
 * 5 is the smallest booking evidenced by a release order; 12 is the
 * current upper target. Heights are whole centimetres because the rate
 * card charges by the square centimetre.
 */
export const DTP_AD_HEIGHTS_CM = [5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Legibility floor for a trade name, as a fraction of the default.
 *
 * Shared by the block builder and the scale search deliberately. They
 * were separate constants once — 0.8 and 0.62 — so the search probed
 * sizes the builder would not produce, and a 6x5 that fits three
 * trades at the true floor was reported as impossible to render.
 */
const DTP_ROLE_TITLE_FLOOR = 0.62;
export type DtpAdHeightCm = (typeof DTP_AD_HEIGHTS_CM)[number];

export function isBookableDtpHeight(heightCm: number): heightCm is DtpAdHeightCm {
  return (DTP_AD_HEIGHTS_CM as readonly number[]).includes(heightCm);
}

/** Rate-card variants. The AAT framework doc records exactly two. */
export type DtpVariant = "BW" | "COLOUR";

/**
 * How much information architecture the purchased height affords.
 *
 * The bands are not arbitrary: they are where a section stops fitting
 * at the legibility floor. A 5-6cm booking has room for the header, the
 * roles and a contact line; 7-9cm additionally affords the benefit and
 * salary panels the mid-size references carry; 10-12cm affords the
 * interview and venue bars and the full agency footer.
 */
export type DtpDensityTier = "COMPACT" | "STANDARD" | "FULL";

export function dtpDensityTier(heightCm: number): DtpDensityTier {
  if (heightCm <= 6) return "COMPACT";
  if (heightCm <= 9) return "STANDARD";
  return "FULL";
}

/** Which sections a tier admits. Absent sections cost no geometry. */
export interface DtpSectionPlan {
  subhead: boolean;
  urgency: boolean;
  roleDetails: boolean;
  benefits: boolean;
  salary: boolean;
  eligibility: boolean;
  interview: boolean;
  venue: boolean;
  /** Footer richness — see renderFooter. */
  footer: "MINIMAL" | "COMPACT" | "FULL";
}

export function dtpSectionPlan(tier: DtpDensityTier): DtpSectionPlan {
  switch (tier) {
    case "COMPACT":
      // roleDetails and interview are NOT luxuries of a tall booking.
      // The reference 6x5 carries a per-role pay line under every trade
      // and an interview-date bar under the header — they are the two
      // facts a candidate acts on, so they survive at the smallest
      // size. What a 6x5 gives up is the address block and the benefit
      // and eligibility prose, not the pay.
      return {
        subhead: false, urgency: true, roleDetails: true, benefits: false,
        salary: true, eligibility: false, interview: true, venue: false,
        footer: "MINIMAL",
      };
    case "STANDARD":
      return {
        subhead: true, urgency: true, roleDetails: true, benefits: true,
        salary: true, eligibility: true, interview: true, venue: false,
        footer: "COMPACT",
      };
    case "FULL":
      return {
        subhead: true, urgency: true, roleDetails: true, benefits: true,
        salary: true, eligibility: true, interview: true, venue: true,
        footer: "FULL",
      };
  }
}

export interface DtpClassifiedInput {
  ad: DtpAdvertisement;
  heightCm: DtpAdHeightCm;
  dpi?: number;
  variant?: DtpVariant;
  /** Agency address block, rendered in the FULL footer. */
  addressLines?: string[];
  /** "Estd. 1984"-style permanent claim. */
  established?: string | null;
  interviewVenue?: string | null;
}

export interface DtpClassifiedResult {
  svg: string;
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  dpi: number;
  tier: DtpDensityTier;
  plan: DtpSectionPlan;
  /** Fraction of the paid area carrying ink-bearing content. */
  fillRatio: number;
  /**
   * The largest uninterrupted run of blank paper, as a fraction of the
   * height.
   *
   * fillRatio alone cannot be trusted: it measures where the last
   * baseline fell, so an advertisement of three near-empty ruled boxes
   * scored 0.99 while looking like nothing at all. This is the number
   * that catches that, and it is what the acceptance test asserts on.
   */
  largestGapRatio: number;
}

const PAPER = "#FFFFFF";
const INK = "#111111";

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

interface Ctx {
  W: number;
  H: number;
  pad: number;
  colW: number;
  accent: string;
  variant: DtpVariant;
  parts: string[];
}

function text(
  c: Ctx, s: string, token: DtpToken, x: number, baseline: number,
  opts: { fill?: string; anchor?: "start" | "middle" | "end"; size?: number } = {},
): void {
  const spec = DTP_TYPE[token];
  const size = opts.size ?? dtpSize(token, c.colW);
  c.parts.push(
    `<text x="${Math.round(x)}" y="${Math.round(baseline)}" font-family="${dtpFamily(token)}" ` +
      `font-size="${size}" font-weight="${spec.weight}" letter-spacing="${spec.tracking}" ` +
      `${opts.anchor && opts.anchor !== "start" ? `text-anchor="${opts.anchor}" ` : ""}` +
      `fill="${opts.fill ?? INK}">${esc(dtpText(s, token))}</text>`,
  );
}

/** A reversed (white-on-dark) bar that hugs its own text. */
function bar(c: Ctx, y: number, label: string, token: DtpToken, fill: string): number {
  const size = dtpSize(token, c.colW);
  const h = Math.round(size * 1.55);
  c.parts.push(`<rect x="0" y="${Math.round(y)}" width="${c.W}" height="${h}" fill="${fill}"/>`);
  text(c, label, token, c.pad, y + h - Math.round(size * 0.42), { fill: PAPER });
  return y + h;
}

/**
 * The agency footer, measured from its own content.
 *
 * Sizing it as a fraction of the advertisement height was wrong in both
 * directions: on a tall booking it reserved far more than the identity
 * needed, opening a band of dead paper above it, and it made the
 * footer's size depend on something other than what it contains.
 *
 * Richness still follows the purchased height — a 6x5 cannot spend 2cm
 * on an address block — but within that choice the footer occupies
 * exactly the lines it draws. Nothing a reader needs to respond, and
 * nothing the licence requires, is ever dropped: the fields compress in
 * a fixed priority order (name, contact, licence first).
 */
interface FooterLine { token: DtpToken; text: string; }

function footerLines(input: DtpClassifiedInput, richness: DtpSectionPlan["footer"], innerW: number, colW: number): FooterLine[] {
  const { ad } = input;
  const lines: FooterLine[] = [];

  // A 6x5 sets its own name smaller than a 6x12 does. The hierarchy is
  // unchanged — the agency is still the strongest mark in the footer —
  // but it stops competing with the trades for the paid column.
  const nameToken: DtpToken = richness === "MINIMAL" ? "DTP_LABEL" : "DTP_SUBHEAD";
  for (const l of dtpWrap(ad.tenant.name, nameToken, innerW, colW)) {
    lines.push({ token: nameToken, text: l });
  }
  if (input.established) {
    lines.push({ token: "DTP_LEGAL", text: input.established });
  }
  // The telephone is NOT repeated here: it is set as a reversed bar
  // directly above the footer, as the references set it. The email
  // stays on its own line — joining it to anything is what pushed it
  // past the trim edge and clipped it.
  if (ad.contactEmail) {
    const emailToken: DtpToken = richness === "MINIMAL" ? "DTP_LEGAL" : "DTP_BODY";
    for (const l of dtpWrap(ad.contactEmail, emailToken, innerW, colW)) {
      lines.push({ token: emailToken, text: l });
    }
  }
  // An address is printed whole or not at all. Budgeting it by line
  // cut "...Pawne MIDC," off mid-sentence in the 6x5 render — a
  // verified fact silently clipped, which the Factual Integrity Law
  // forbids outright. The caller decides how much address a small
  // booking carries; the renderer's job is to set what it is given.
  for (const l of input.addressLines ?? []) {
    for (const w of dtpWrap(l, "DTP_LEGAL", innerW, colW)) {
      lines.push({ token: "DTP_LEGAL", text: w });
    }
  }
  return lines;
}

interface FooterPlan {
  heightPx: number;
  licenceH: number;
  /** Reversed telephone bar, reserved rather than left to spare room. */
  contactH: number;
  lines: FooterLine[];
  logoW: number;
  textLeft: number;
}

function planFooter(c: Ctx, input: DtpClassifiedInput, richness: DtpSectionPlan["footer"]): FooterPlan {
  const { ad } = input;
  const licenceH = ad.tenant.registrationText
    ? Math.round(dtpSize("DTP_LEGAL", c.colW) * 1.7)
    : 0;

  // The logo appears at every size. The reference 6x5 carries the
  // agency mark, its venue address and its email in a footer barely
  // 1cm deep — identity is what makes a classified answerable, so it
  // is the last thing a small booking gives up, not the first.
  const hasLogo = Boolean(ad.tenant.logo);
  const logoW = hasLogo ? Math.round(c.W * (richness === "MINIMAL" ? 0.24 : 0.28)) : 0;
  const textLeft = c.pad + (logoW > 0 ? logoW + Math.round(c.pad * 0.7) : 0);
  const innerW = c.W - textLeft - c.pad;

  // The telephone is RESERVED, not fitted last. Drawing it only when
  // the body happened to leave room lost it entirely from the 6x5 —
  // an advertisement with no response mechanism, which is a failure of
  // the thing itself rather than of its layout.
  const contactH = ad.contactPhone
    ? Math.round(dtpSize("DTP_CONTACT", c.colW) * 1.55)
    : 0;

  const lines = footerLines(input, richness, innerW, c.colW);
  const textH = lines.reduce((sum, l) => sum + dtpLineHeight(l.token, c.colW), 0);
  const logoH = hasLogo ? Math.round(logoW * 0.6) : 0;

  const gutter = richness === "MINIMAL" ? 0.45 : 0.8;
  const heightPx =
    contactH + Math.round(c.pad * gutter) + Math.max(textH, logoH) +
    Math.round(c.pad * gutter) + licenceH;
  return { heightPx, licenceH, contactH, lines, logoW, textLeft };
}

function renderFooter(c: Ctx, input: DtpClassifiedInput, top: number, fp: FooterPlan): void {
  const { ad } = input;

  if (fp.contactH > 0 && ad.contactPhone) {
    const cs = dtpSize("DTP_CONTACT", c.colW);
    c.parts.push(`<rect x="0" y="${Math.round(top)}" width="${c.W}" height="${fp.contactH}" fill="${INK}"/>`);
    text(c, `M: ${ad.contactPhone}`, "DTP_CONTACT", c.pad, top + fp.contactH - Math.round(cs * 0.42), {
      fill: PAPER,
    });
  }
  top += fp.contactH;
  c.parts.push(`<rect x="0" y="${Math.round(top)}" width="${c.W}" height="2" fill="${INK}"/>`);

  if (fp.licenceH > 0 && ad.tenant.registrationText) {
    const ls = dtpSize("DTP_LEGAL", c.colW);
    c.parts.push(
      `<rect x="0" y="${c.H - fp.licenceH}" width="${c.W}" height="${fp.licenceH}" fill="${INK}"/>`,
    );
    text(c, ad.tenant.registrationText, "DTP_LEGAL", c.W / 2, c.H - Math.round(fp.licenceH * 0.3), {
      fill: PAPER, anchor: "middle", size: ls,
    });
  }

  let y = top + Math.round(c.pad * 0.5);

  if (fp.logoW > 0) {
    // Tenant slot only — the identity guard is not relaxed for print.
    const logoPng = resolveSlotImage(
      "The DTP classified's tenant logo slot", ["TENANT_PRIMARY_LOGO"], ad.tenant.logo,
    );
    if (logoPng) {
      c.parts.push(
        `<image href="data:image/png;base64,${logoPng.toString("base64")}" x="${c.pad}" y="${Math.round(y)}" ` +
          `width="${fp.logoW}" height="${Math.round(fp.logoW * 0.6)}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    }
  }

  for (const l of fp.lines) {
    y += dtpLineHeight(l.token, c.colW);
    text(c, l.text, l.token, fp.textLeft, y);
  }
}

interface BodyLayout {
  /** y of the last baseline drawn. */
  bottom: number;
  /**
   * Verified facts this pass could not place.
   *
   * Never a silent outcome: the caller either finds a scale that
   * empties this list or fails the render. An advertisement that
   * quietly prints two of three booked trades is worse than one that
   * does not print — the agency has paid for a vacancy nobody sees.
   */
  unplaced: string[];
}

/**
 * One role, set as the references set it.
 *
 * The role block — not the line of text — is the compositional unit of
 * an AAT classified. Comparing a real 6x5 against an early render made
 * this plain: the reference gives "PIPE FABRICATORS" the full 6cm
 * measure in heavy condensed caps with its own salary line beneath it
 * and a rule above it, while the render set the same role as a small
 * bulleted list item with the salary pooled into a single panel far
 * below. The role is what the reader is scanning for, so it is the
 * advertisement's headline, repeated once per vacancy.
 */
interface RoleBlock {
  title: string;
  /** Per-role pay or experience, set beneath the title. */
  detail: string | null;
  count: string;
  titleSize: number;
  heightPx: number;
}

/**
 * Fits a role title to the measure.
 *
 * Newspaper practice, not a fallback: the compositor sets the trade
 * name as large as the column takes, so a short title like "PLUMBER"
 * prints larger than "MAINTENANCE SUPERVISOR" in the same booking.
 * Shrinking stops at the legibility floor rather than clipping.
 */
function fitToMeasure(
  s: string, token: DtpToken, avail: number, colW: number, max: number, min: number,
): number {
  const base = dtpSize(token, colW);
  const natural = dtpTextWidth(s, token, colW);
  if (natural <= 0) return base;
  // 0.98, not 1.0: measured advance widths are close but not exact, and
  // a title set to precisely the measure printed a character past the
  // trim edge. The margin costs nothing visible and cannot clip.
  const ideal = Math.floor((base * avail * 0.98) / natural);
  return Math.max(min, Math.min(max, ideal));
}

/**
 * The pay line is sized FROM its trade name, then fitted to the measure.
 *
 * In every reference the two are locked in proportion — the pay reads
 * as the second line of one block, roughly two-thirds the trade name.
 * Pinning it to the body size instead made the block floor so tall
 * that a 6x5 could not hold three trades at any title scale.
 *
 * The proportion is an intent, never a licence to overrun: a long pay
 * line under a large trade name ran clean off the column until it was
 * fitted here as well.
 */
function roleDetailSize(detail: string, titleSize: number, avail: number, colW: number): number {
  const floor = Math.max(8, Math.round(dtpSize("DTP_LEGAL", colW) * 0.92));
  const wanted = Math.max(floor, Math.round(titleSize * 0.64));
  return fitToMeasure(detail, "DTP_PRICE", avail, colW, wanted, floor);
}

function buildRoleBlocks(
  c: Ctx, ad: DtpAdvertisement, plan: DtpSectionPlan, titleMax: number,
): RoleBlock[] {
  // Never above the ceiling the search is currently probing, or the
  // clamp would silently raise the size the search asked for.
  const titleMin = Math.min(
    titleMax, Math.round(dtpSize("DTP_NUMBER", c.colW) * DTP_ROLE_TITLE_FLOOR),
  );

  // ONE size for every trade in an advertisement, set by the longest.
  //
  // Fitting each title independently is what a naive reading of
  // "fit to the measure" produces, and it looked wrong immediately:
  // "STORE HELPER" towered over "OPERATOR - MOBILE CRANE 55T" in the
  // same list, implying an importance the vacancy data never claimed.
  // The references set the whole list at a single size — the trades are
  // peers, and the reader scans a column, not a ranking.
  const fitted = ad.positions.map((p) => {
    const count = typeof p.count === "number" ? String(p.count) : "";
    const base = dtpSize("DTP_NUMBER", c.colW);
    const countBaseW = count ? dtpTextWidth(count, "DTP_NUMBER", c.colW) + c.pad : 0;

    // The count is set at the SAME size as its trade name, so the
    // gutter it needs depends on the size we are still choosing. Solved
    // by iterating to a fixed point rather than reserving the gutter at
    // the default size — that shortcut let "CARPENTER / MASON" run
    // straight into its own vacancy count once titles could grow large.
    let titleSize = titleMin;
    for (let pass = 0; pass < 4; pass += 1) {
      const countW = count ? Math.round((countBaseW * titleSize) / base) : 0;
      const next = fitToMeasure(
        p.title, "DTP_NUMBER", c.W - c.pad * 2 - countW, c.colW, titleMax, titleMin,
      );
      if (next === titleSize) break;
      titleSize = next;
    }
    return { title: p.title, count, detail: plan.roleDetails ? (p.detail ?? null) : null, titleSize };
  });

  const shared = fitted.length > 0 ? Math.min(...fitted.map((f) => f.titleSize)) : titleMin;
  const detailAvail = c.W - c.pad * 2;

  return fitted.map((f) => ({
    title: f.title,
    detail: f.detail,
    count: f.count,
    titleSize: shared,
    heightPx:
      Math.round(shared * 1.16) +
      (f.detail ? Math.round(roleDetailSize(f.detail, shared, detailAvail, c.colW) * 1.24) : 0) +
      Math.round(c.pad * 0.5),
  }));
}

/**
 * Lays out the body between the header and the footer.
 *
 * Called twice: once against a throwaway canvas to learn the natural
 * height, then again with the role scale that consumes the surplus.
 *
 * Surplus goes INTO the role blocks rather than into gaps between
 * sections. Distributing it as leading did close the numeric gap above
 * the footer, but it bought that number with bands of white between
 * every section — the opposite of what the references do, and what a
 * classified charged by the square centimetre cannot afford. A
 * newspaper compositor with room to spare sets the trade names larger;
 * body, benefit and legal text stay at their reading sizes.
 */
function layoutBody(
  c: Ctx, input: DtpClassifiedInput, plan: DtpSectionPlan, footerTop: number,
  titleMax: number, blockLead = 0,
): BodyLayout {
  const { ad } = input;
  const accent = c.accent;
  const W = c.W;
  let y = 0;

  // ---- Destination: reversed, full-bleed, the strongest mark ----
  const hlSize = dtpSize("DTP_HEADLINE", c.colW);
  const headerH = Math.round(hlSize * 1.42);
  c.parts.push(`<rect x="0" y="0" width="${W}" height="${headerH}" fill="${accent}"/>`);
  text(c, ad.headline, "DTP_HEADLINE", c.pad, headerH - Math.round(hlSize * 0.34), { fill: PAPER });
  y = headerH;

  // ---- Interview bar, immediately beneath the destination ----
  // Every reference booking that has an interview date carries it here,
  // hard against the header, not down among the benefits: it is the
  // deadline the reader is scanning for. A 6x5 shows it too, which is
  // why it is no longer gated behind the taller tiers.
  if (plan.interview && ad.interview) {
    y = bar(c, y, ad.interview, "DTP_LABEL", INK);
  } else if (plan.urgency && ad.urgency) {
    y = bar(c, y, ad.urgency, "DTP_LABEL", INK);
  }

  // ---- Industry / client line, set tight under the bars ----
  if (plan.subhead && ad.subhead) {
    const s = dtpSize("DTP_SUBHEAD", c.colW);
    for (const line of dtpWrap(ad.subhead, "DTP_SUBHEAD", W - c.pad * 2, c.colW)) {
      y += Math.round(s * 1.12);
      text(c, line, "DTP_SUBHEAD", c.pad, y, { fill: accent });
    }
    y += Math.round(c.pad * 0.2);
  }
  if (ad.client?.name) {
    // The hiring company, named as itself — never merged with the
    // advertising agency's identity.
    const s = dtpSize("DTP_BODY", c.colW);
    for (const line of dtpWrap(`Client: ${ad.client.name}`, "DTP_BODY", W - c.pad * 2, c.colW)) {
      y += Math.round(s * 1.15);
      text(c, line, "DTP_BODY", c.pad, y);
    }
  }

  // ---- Roles, each block ruled off from the next ----
  const blocks = buildRoleBlocks(c, ad, plan, titleMax);
  const unplaced: string[] = [];
  for (const [index, b] of blocks.entries()) {
    // Lead BETWEEN blocks, never before the first. Applying it to the
    // first block opened a ruled box with nothing in it directly under
    // the header — the rule is a separator, and there is nothing above
    // the first trade to separate it from.
    const lead = index === 0 ? 0 : blockLead;
    if (y + b.heightPx + lead > footerTop) {
      unplaced.push(b.title);
      continue;
    }
    y += Math.round(c.pad * 0.4) + lead;
    c.parts.push(`<rect x="0" y="${Math.round(y)}" width="${W}" height="2" fill="${INK}"/>`);
    y += Math.round(b.titleSize * 1.02);

    const countW = b.count ? dtpTextWidth(b.count, "DTP_NUMBER", c.colW) + c.pad : 0;
    text(c, b.title, "DTP_NUMBER", c.pad, y, { size: b.titleSize });
    if (b.count) {
      text(c, b.count, "DTP_NUMBER", W - c.pad, y, {
        anchor: "end", fill: accent, size: b.titleSize,
      });
    }
    void countW;

    if (b.detail) {
      // Bold, not the body weight: in every reference the pay line is
      // the second-strongest mark in the block, under the trade name.
      const ds = roleDetailSize(b.detail, b.titleSize, c.W - c.pad * 2, c.colW);
      y += Math.round(ds * 1.24);
      text(c, b.detail, "DTP_PRICE", c.pad, y, { size: ds });
    }
    y += Math.round(c.pad * 0.3);
  }

  // ---- Salary panel: only when pay is not already on each role ----
  const perRolePay = blocks.some((b) => b.detail);
  if (
    plan.salary && ad.salary && !perRolePay &&
    y + dtpLineHeight("DTP_PRICE", c.colW) * 1.6 < footerTop
  ) {
    const s = dtpSize("DTP_PRICE", c.colW);
    const boxH = Math.round(s * 1.7);
    y += Math.round(c.pad * 0.4);
    c.parts.push(
      `<rect x="${c.pad}" y="${Math.round(y)}" width="${W - c.pad * 2}" height="${boxH}" ` +
        `fill="${c.variant === "BW" ? "#EEEEEE" : "#FFE9A8"}" stroke="${INK}" stroke-width="1"/>`,
    );
    text(c, ad.salary, "DTP_PRICE", W / 2, y + boxH - Math.round(s * 0.45), { anchor: "middle" });
    y += boxH;
  }

  // ---- Benefits, run inline as the small bookings do ----
  if (plan.benefits && (ad.benefits ?? []).length > 0) {
    const s = dtpSize("DTP_BODY", c.colW);
    y += Math.round(c.pad * 0.3);
    for (const line of dtpWrap((ad.benefits ?? []).join(" • "), "DTP_BODY", W - c.pad * 2, c.colW)) {
      if (y + s * 1.2 > footerTop) break;
      y += Math.round(s * 1.2);
      text(c, line, "DTP_BODY", c.pad, y);
    }
  }

  if (plan.eligibility && (ad.eligibility ?? []).length > 0) {
    const s = dtpSize("DTP_BODY", c.colW);
    for (const item of ad.eligibility ?? []) {
      for (const line of dtpWrap(item, "DTP_BODY", W - c.pad * 2, c.colW)) {
        if (y + s * 1.2 > footerTop) break;
        y += Math.round(s * 1.2);
        text(c, line, "DTP_BODY", c.pad, y);
      }
    }
  }

  // ---- Venue bar ----
  if (plan.venue && input.interviewVenue) {
    const s = dtpSize("DTP_LABEL", c.colW);
    if (y + s * 1.7 < footerTop) {
      y += Math.round(c.pad * 0.3);
      y = bar(c, y, input.interviewVenue, "DTP_LABEL", accent);
    }
  }

  return { bottom: y, unplaced };
}

/**
 * Composes one classified advertisement at its purchased size.
 *
 * The footer is measured first because it is the fixed foot of the
 * booking; the body then fills everything above it. Height is the
 * purchased dimension and is never negotiated — content is fitted to
 * the space bought, not the other way round.
 */
export function renderDtpClassifiedSvg(input: DtpClassifiedInput): DtpClassifiedResult {
  const dpi = input.dpi ?? DTP_DEFAULT_DPI;
  const variant = input.variant ?? "COLOUR";
  const W = cmToPx(DTP_CLASSIFIED_WIDTH_CM, dpi);
  const H = cmToPx(input.heightCm, dpi);
  const tier = dtpDensityTier(input.heightCm);
  const plan = dtpSectionPlan(tier);
  const { ad } = input;

  // Colour belongs to the advertisement, never to the page. A B/W
  // booking is set in ink, whatever accent the tenant supplied.
  const accent = variant === "BW" ? INK : (ad.accent ?? INK);

  const c: Ctx = {
    W, H, colW: W, accent, variant,
    pad: Math.max(3, Math.round(W * 0.035)),
    parts: [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`,
      `<rect width="${W}" height="${H}" fill="${PAPER}"/>`,
    ],
  };

  // Footer first, measured from its own content — everything above must
  // respect where it actually starts.
  const fp = planFooter(c, input, plan.footer);
  const footerTop = H - fp.heightPx;

  // The role scale is SEARCHED, not computed: role titles fit to the
  // measure individually, so the body's height is not a closed-form
  // function of one size. The largest scale whose body still clears the
  // footer wins — measured on throwaway canvases, drawn once at the end.
  //
  // This is how the surplus is spent. Setting the trade names larger is
  // what the reference compositors do with spare column; opening gaps
  // between sections is what they never do.
  const base = dtpSize("DTP_NUMBER", c.colW);
  // High enough that a short trade name can genuinely fill the measure.
  // Held at the headline scale, a 6x12 booked for three trades could
  // not grow into its column and the surplus had nowhere to go but
  // white space. fitRoleTitle still clamps each title to what the 6cm
  // measure actually takes, so this is a ceiling, not a size.
  const ceiling = Math.round(dtpSize("DTP_HEADLINE", c.colW) * 2.4);
  const floor = Math.round(base * DTP_ROLE_TITLE_FLOOR);
  const room = footerTop - Math.round(c.pad * 0.5);

  // Search DOWN to the legibility floor as well as up. Searching only
  // upward from the default silently dropped the third booked trade
  // from a 6x5 when the default was already too large — the render
  // must first find a scale that places every fact, and only then
  // spend what is left over on setting them bigger.
  let chosen: number | null = null;
  for (let size = ceiling; size >= floor; size -= 1) {
    const probe: Ctx = { ...c, parts: [] };
    const trial = layoutBody(probe, input, plan, footerTop, size);
    if (trial.unplaced.length === 0 && trial.bottom <= room) {
      chosen = size;
      break;
    }
  }

  if (chosen === null) {
    // Fail closed, in the project's existing terms. A booking too small
    // for its own content is a commercial decision for the agency to
    // make — buy more depth or advertise fewer trades — not something
    // the renderer may resolve by dropping vacancies.
    const last = layoutBody({ ...c, parts: [] }, input, plan, footerTop, floor);
    throw new LayoutCapacityError(
      last.unplaced.length > 0 ? last.unplaced : [`${input.heightCm}cm booking body`],
      undefined,
    );
  }

  // Type scale saturates before the space does: a long trade name like
  // "ELECTRICAL TECHNICIAN" stops growing at the measure, so a booking
  // with few long roles still finished ~1.2cm short of its footer. The
  // residual is opened up INSIDE the role blocks, between the rules,
  // which is where the references carry their air — never as one band
  // above the footer, and never between unrelated sections.
  const saturated = layoutBody({ ...c, parts: [] }, input, plan, footerTop, chosen);
  const blocks = ad.positions.length;
  const residual = Math.max(0, room - saturated.bottom);
  // Capped. Removing the cap did drive the fill metric to 99%, but the
  // render showed why that number was worthless: three trades in a
  // 6x12 became three near-empty ruled boxes with an entirely blank one
  // at the top. Air inside a block is rhythm; a block that is mostly
  // air is the dead space this is meant to prevent.
  const blockLead = blocks > 0
    ? Math.min(Math.round(c.W * 0.22), Math.floor(residual / blocks))
    : 0;

  const final = layoutBody(c, input, plan, footerTop, chosen, blockLead);
  const inkBottom = final.bottom;
  const largestGap = Math.max(
    footerTop - inkBottom,
    blockLead + Math.round(c.pad * 0.4),
  );
  renderFooter(c, input, footerTop, fp);

  // Outer rule — the box every classified sits in.
  c.parts.push(
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${INK}" stroke-width="2"/>`,
  );
  c.parts.push("</svg>");

  return {
    svg: c.parts.join(""),
    widthPx: W, heightPx: H,
    widthCm: DTP_CLASSIFIED_WIDTH_CM, heightCm: input.heightCm,
    dpi, tier, plan,
    fillRatio: Math.min(1, (inkBottom + (H - footerTop)) / H),
    largestGapRatio: Math.max(0, largestGap) / H,
  };
}
