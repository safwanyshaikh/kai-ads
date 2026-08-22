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
 * A fourth slip is labelled "6x56cm" and prices 24,000 at 800/sq.cm.
 * That is 30 square centimetres — exactly 6x5 — so the label is a typo
 * the slip's own arithmetic disproves. There is no 6x56 booking.
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
import type { DtpAdvertisement, DtpCampaign, DtpPosition } from "./dtp-ad-block";

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

/**
 * The purchased height governs TREATMENT, not existence.
 *
 * These flags were once a per-tier list of which facts an
 * advertisement was allowed to carry, and that was the wrong shape for
 * the problem. A venue supplied for a 6x8 was dropped before capacity
 * was ever consulted — not because it did not fit, but because a table
 * said an 8cm booking does not have venues. That is a silent omission
 * of verified information with a tidier name.
 *
 * Content now renders whenever the data exists, and the fitting search
 * decides what the booking can hold, reporting anything it cannot so
 * the render fails rather than quietly shrinking the truth. What still
 * scales with the purchased height is the footer's richness, which is
 * a question of how much address a small booking prints, not of
 * whether the agency has one.
 */
export function dtpSectionPlan(tier: DtpDensityTier): DtpSectionPlan {
  const content = {
    subhead: true, urgency: true, roleDetails: true, benefits: true,
    salary: true, eligibility: true, interview: true, venue: true,
  };
  switch (tier) {
    case "COMPACT":
      return { ...content, footer: "MINIMAL" };
    case "STANDARD":
      return { ...content, footer: "COMPACT" };
    case "FULL":
      return { ...content, footer: "FULL" };
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
  /** The size the trade names settled at, in pixels. */
  roleScalePx: number;
  /**
   * True when the trades had to be set below their default size.
   *
   * Legal — still above the legibility floor — but it means the booking
   * carries more than it comfortably holds, which is a commercial fact
   * the tenant should see before buying that size.
   *
   * Deliberately NOT triggered by prose compression. The scale search
   * maximises display size first and gives way on prose to afford it,
   * so a reduced prose scale is the normal outcome of a well-set
   * advertisement, not a symptom of crowding: including it flagged
   * every height from 6x6 to 6x12 as compressed even where the trade
   * names were set at three times their default.
   */
  compressed: boolean;
}

const PAPER = "#FFFFFF";
const INK = "#111111";

/**
 * A supplied logo's real pixel dimensions, read from the PNG header.
 *
 * Needed because a brand asset is not ours to reshape. Drawing every
 * logo into a box of fixed proportion is safe only in the sense that
 * preserveAspectRatio stops it distorting — a tall mark still lands
 * shrunken inside a wide box with paper either side, which is the
 * agency's identity rendered badly rather than rendered small.
 *
 * Returns null when the buffer is not a PNG we can read. Callers treat
 * that as a corrupt asset and fail the render (spec §28); they never
 * fall back to a guessed shape.
 */
export function pngIntrinsicSize(png: Buffer): { widthPx: number; heightPx: number } | null {
  // 8-byte signature, then a 25-byte IHDR whose width and height are
  // big-endian uint32 at offsets 16 and 20.
  if (png.length < 24) return null;
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (png[i] !== SIGNATURE[i]) return null;
  }
  const widthPx = png.readUInt32BE(16);
  const heightPx = png.readUInt32BE(20);
  if (widthPx <= 0 || heightPx <= 0) return null;
  return { widthPx, heightPx };
}

/**
 * Raised when a supplied brand asset cannot be placed honestly.
 *
 * Distinct from LayoutCapacityError: that one means the facts do not
 * fit, this one means an asset is unreadable or would have to be
 * printed below the size at which a mark is still a mark.
 */
export class DtpAssetError extends Error {
  readonly code = "DTP_ASSET";
  constructor(readonly slot: string, readonly reason: string) {
    super(`${slot}: ${reason}`);
    this.name = "DtpAssetError";
  }
}

/** Smallest width at which a printed logo still reads, as a fraction of the measure. */
const LOGO_MIN_WIDTH_FRACTION = 0.08;

/**
 * Smallest the KAI verification QR may be printed, in centimetres.
 *
 * A QR is not decoration that can shrink to taste — below a certain
 * physical size a phone camera stops resolving its modules and the
 * trust mark becomes a grey square that fails when someone actually
 * tries it, which is worse than not printing one. 1.2cm at the payload
 * these URLs carry keeps modules around 0.4mm, which scans in hand.
 *
 * It is a PHYSICAL minimum, so it does not shrink with the booking:
 * the same 1.2cm on a 6x5 as on a 6x12. A small advertisement pays for
 * it out of its own column, which is the intended trade — the QR is
 * the reader's route to the licence check.
 */
export const DTP_QR_MIN_CM = 1.2;

interface LogoBox { x: number; y: number; width: number; height: number; }

/**
 * Fits a logo inside a box at its own aspect ratio.
 *
 * The asset is never cropped, never stretched and never upscaled past
 * its own resolution beyond what 300dpi print tolerates — it is placed
 * at the largest size the box and its intrinsic dimensions both allow.
 */
function fitLogo(
  slot: string, png: Buffer, maxWidth: number, maxHeight: number,
): { drawn: LogoBox; aspect: number } {
  const size = pngIntrinsicSize(png);
  if (!size) throw new DtpAssetError(slot, "asset is not a readable PNG");

  const aspect = size.widthPx / size.heightPx;
  let width = maxWidth;
  let height = Math.round(width / aspect);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspect);
  }
  return { drawn: { x: 0, y: 0, width, height }, aspect };
}

function drawLogo(c: Ctx, png: Buffer, box: LogoBox): void {
  c.parts.push(
    `<image href="data:image/png;base64,${png.toString("base64")}" ` +
      `x="${Math.round(box.x)}" y="${Math.round(box.y)}" ` +
      `width="${Math.round(box.width)}" height="${Math.round(box.height)}" ` +
      `preserveAspectRatio="xMidYMid meet"/>`,
  );
}

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
  /** Needed so physical minimums (the QR) convert at the real output DPI. */
  dpi: number;
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

/**
 * A reversed (white-on-dark) bar that hugs its own text — and always
 * contains it.
 *
 * The label is fitted to the measure and wrapped if fitting alone is
 * not enough. Setting bars at a fixed size instead ran a long master
 * headline and a long venue line straight off the right edge: "JOBS IN
 * SAUDI ARABIA - 100% CL" and "...GAMI INDUSTRIAL PAR". A bar carries
 * the destination, the interview date and the venue — facts, all of
 * them — so it may shrink or take a second line, but it may not clip.
 */
function bar(
  c: Ctx, y: number, label: string, token: DtpToken, fill: string, setSize?: number,
): number {
  const avail = c.W - c.pad * 2;
  const base = dtpSize(token, c.colW);
  const floor = Math.max(dtpSize("DTP_LEGAL", c.colW), Math.round(base * 0.62));

  // `setSize` is a size to SET AT, not a ceiling to fit under.
  //
  // Treating it as a ceiling made the hero search do nothing: fitting
  // shrinks a long headline until it occupies one line, which for
  // "Saudi Arabia - Aramco Projects" lands well below every ceiling
  // offered, so every step produced an identical band and the hero was
  // the same height on a 6x5 and a 6x12. Set at the size and wrapped,
  // a larger allowance genuinely buys a stronger destination.
  const size = setSize ?? fitToMeasure(label, token, avail, c.colW, base, floor);

  // Wrapped at the measure the smaller size will actually occupy.
  const lines = dtpWrap(
    label, token, Math.round((avail * dtpSize(token, c.colW)) / size), c.colW,
  );
  // One line occupies exactly what it did before wrapping existed, so
  // adding the guarantee costs nothing to the overwhelming majority of
  // bars that never needed it.
  const lead = Math.round(size * 1.14);
  const h = lines.length * lead + Math.round(size * 0.28);

  c.parts.push(`<rect x="0" y="${Math.round(y)}" width="${c.W}" height="${h}" fill="${fill}"/>`);
  let ty = y;
  for (const line of lines) {
    ty += lead;
    text(c, line, token, c.pad, ty - Math.round(size * 0.28), { fill: PAPER, size });
  }
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
  /** Height the tenant mark needs at its own aspect ratio. */
  logoH: number;
  /** Reserved square for the KAI verification QR, 0 when none supplied. */
  qrPx: number;
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
  const logoMaxW = Math.round(c.W * (richness === "MINIMAL" ? 0.24 : 0.28));
  // Bounded on BOTH axes. Honouring the aspect ratio alone let a
  // portrait mark claim a third of a 6x8 booking — 199px wide became
  // 318px tall — and squeezed the benefits and eligibility out of the
  // body entirely. A logo is an identifier, not a panel.
  const logoMaxH = Math.round(c.W * 0.16);
  const logoFit = hasLogo
    ? fitLogo(
        "The DTP classified's tenant logo slot",
        resolveSlotImage(
          "The DTP classified's tenant logo slot", ["TENANT_PRIMARY_LOGO"], ad.tenant.logo,
        ) as Buffer,
        logoMaxW, logoMaxH,
      ).drawn
    : null;
  const logoW = logoFit ? logoFit.width : 0;
  const textLeft = c.pad + (logoW > 0 ? logoW + Math.round(c.pad * 0.7) : 0);
  const innerW = c.W - textLeft - c.pad;

  // The telephone is RESERVED, not fitted last. Drawing it only when
  // the body happened to leave room lost it entirely from the 6x5 —
  // an advertisement with no response mechanism, which is a failure of
  // the thing itself rather than of its layout.
  const contactH = ad.contactPhone
    ? Math.round(dtpSize("DTP_CONTACT", c.colW) * 1.55)
    : 0;

  // The QR is measured INTO the footer, not laid over it. It sits at
  // the trailing edge of the identity block and the text column ends
  // where it begins, so nothing is ever printed underneath it.
  const qrPx = ad.verificationQr ? cmToPx(DTP_QR_MIN_CM, c.dpi) : 0;
  const qrGutter = qrPx > 0 ? Math.round(c.pad * 0.6) : 0;

  const lines = footerLines(input, richness, innerW - qrPx - qrGutter, c.colW);
  const textH = lines.reduce((sum, l) => sum + dtpLineHeight(l.token, c.colW), 0);
  const logoH = logoFit ? logoFit.height : 0;

  const gutter = richness === "MINIMAL" ? 0.45 : 0.8;
  const heightPx =
    contactH + Math.round(c.pad * gutter) + Math.max(textH, logoH, qrPx) +
    Math.round(c.pad * gutter) + licenceH;
  return { heightPx, licenceH, contactH, lines, logoW, logoH, qrPx, textLeft };
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
      if (fp.logoW < c.W * LOGO_MIN_WIDTH_FRACTION) {
        throw new DtpAssetError(
          "The DTP classified's tenant logo slot",
          "cannot be placed above the minimum size at which a mark still reads",
        );
      }
      drawLogo(c, logoPng, { x: c.pad, y, width: fp.logoW, height: fp.logoH });
    }
  }

  for (const l of fp.lines) {
    y += dtpLineHeight(l.token, c.colW);
    text(c, l.text, l.token, fp.textLeft, y);
  }

  // ---- KAI verification QR ----
  //
  // KAI's own trust mark, not the tenant's and not the client's. The
  // slot accepts only the KAI role, so an agency logo or a client's
  // marketing QR cannot be printed here as if KAI had verified it.
  if (fp.qrPx > 0) {
    const qrPng = resolveSlotImage(
      "The DTP classified's KAI verification QR slot",
      ["KAI_VERIFICATION_QR"],
      ad.verificationQr,
    );
    if (qrPng) {
      const qrTop = top + Math.round(c.pad * 0.5);
      c.parts.push(
        `<image href="data:image/png;base64,${qrPng.toString("base64")}" ` +
          `x="${c.W - c.pad - fp.qrPx}" y="${qrTop}" ` +
          `width="${fp.qrPx}" height="${fp.qrPx}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    }
  }
}

/**
 * Body prose at a chosen scale, with its own legibility floor.
 *
 * Spec §6 requires the compositor to compress before it refuses:
 * benefit and eligibility text set at one fixed size could only ever
 * overflow, so adding the client band turned a 6x8 that used to render
 * into a hard capacity failure. Prose now steps down ahead of that,
 * and never below DTP_LEGAL — the floor at which small print is still
 * print.
 */
function proseSize(c: Ctx, scale: number): number {
  const floor = dtpSize("DTP_LEGAL", c.colW);
  return Math.max(floor, Math.round(dtpSize("DTP_BODY", c.colW) * scale));
}

/** Wraps prose to the measure it will actually be set at. */
function wrapProse(c: Ctx, s: string, width: number, scale: number): string[] {
  const size = proseSize(c, scale);
  const base = dtpSize("DTP_BODY", c.colW);
  // Wrapping is measured at the base size, so ask for a proportionally
  // wider measure to get the line breaks the smaller size will produce.
  return dtpWrap(s, "DTP_BODY", Math.round((width * base) / size), c.colW);
}

/**
 * The booking's campaigns, however the caller expressed them.
 *
 * A classified may advertise several hiring campaigns at once — the
 * 6x11 reference carries four, each with its own project heading,
 * interview dates, trades, conditions and contact number. Callers with
 * a single campaign keep using the flat fields, and one is synthesised
 * for them, so both shapes go down exactly one layout path.
 */
function campaignsOf(ad: DtpAdvertisement): DtpCampaign[] {
  if (ad.campaigns && ad.campaigns.length > 0) return ad.campaigns;
  return [{
    heading: null,
    interview: ad.interview ?? ad.urgency ?? null,
    positions: ad.positions ?? [],
    note: null,
    // The single-campaign footer already carries the telephone as a
    // reversed bar; repeating it here would print it twice.
    contactPhone: null,
    client: ad.client ?? null,
  }];
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
  /** Per-role pay, set beneath the title. */
  detail: string | null;
  /** Trade qualification, continuing the title on the same line. */
  qualifier: string | null;
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
  c: Ctx, positions: DtpPosition[], plan: DtpSectionPlan, titleMax: number,
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
  // A single compensation structure shared by every trade is stated
  // once, as a panel, rather than repeated identically down the column.
  const details = positions.map((p) => p.detail ?? null);
  const uniform =
    details.length > 1 && details.every((d) => d !== null && d === details[0]);

  const fitted = positions.map((p) => {
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
    return {
      title: p.title, count, titleSize,
      detail: plan.roleDetails && !uniform ? (p.detail ?? null) : null,
      qualifier: p.qualifier ?? null,
    };
  });

  const shared = fitted.length > 0 ? Math.min(...fitted.map((f) => f.titleSize)) : titleMin;
  const detailAvail = c.W - c.pad * 2;

  return fitted.map((f) => ({
    title: f.title,
    detail: f.detail,
    qualifier: f.qualifier,
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
/**
 * Sets a trade's qualification, inline where it fits and beneath where
 * it does not.
 *
 * The "beneath" branch used to move the text down and draw it at the
 * inline size without wrapping, which simply moved the overrun rather
 * than resolving it: "Civil / Electrical / Mechanical" measured 756px
 * across a 709px column. Below the line it is refitted to the full
 * measure and wrapped, so the fallback is a real fallback.
 */
function drawQualifier(
  c: Ctx, qualifier: string, titleX: number, titleAdvance: number,
  titleSize: number, countW: number, y: number,
): number {
  const inlineSize = Math.max(
    dtpSize("DTP_LEGAL", c.colW), Math.round(titleSize * 0.66),
  );
  // The advance is a measurement, and measurements of this face run
  // slightly short: "PROCUREMENT MANAGER" placed its qualifier hard
  // against its own final R with no space at all. Inflate by 2% and
  // keep a real word space, so a near-miss becomes a wrap rather than
  // two words printed as one.
  const afterTitle =
    titleX + Math.ceil(titleAdvance * 1.02) + Math.round(inlineSize * 0.95);
  const room = c.W - c.pad - countW - afterTitle;
  const need = dtpTextWidth(qualifier, "DTP_BODY", c.colW) * inlineSize
    / dtpSize("DTP_BODY", c.colW);

  if (need <= room && room > 0) {
    text(c, qualifier, "DTP_BODY", afterTitle, y, { size: inlineSize });
    return y;
  }

  const avail = c.W - titleX - c.pad;
  const size = fitToMeasure(
    qualifier, "DTP_BODY", avail, c.colW, inlineSize,
    Math.max(8, dtpSize("DTP_LEGAL", c.colW)),
  );
  let ty = y;
  for (const line of dtpWrap(
    qualifier, "DTP_BODY", Math.round((avail * dtpSize("DTP_BODY", c.colW)) / size), c.colW,
  )) {
    ty += Math.round(size * 1.2);
    text(c, line, "DTP_BODY", titleX, ty, { size });
  }
  return ty;
}

function layoutBody(
  c: Ctx, input: DtpClassifiedInput, plan: DtpSectionPlan, footerTop: number,
  titleMax: number, blockLead = 0, proseScale = 1, heroMax?: number,
): BodyLayout {
  const { ad } = input;
  const accent = c.accent;
  const W = c.W;
  let y = 0;
  /** Every verified fact this pass could not place, of any class. */
  const unplaced: string[] = [];

  // ---- Destination: reversed, full-bleed, the strongest mark ----
  //
  // Fitted, never clipped — a long master headline shrinks to the
  // column and wraps if it must — and SIZED BY THE SOLVE rather than by
  // the token.
  //
  // A hero fixed at the token's size is the same reserved-box mistake
  // the footer used to make, just at the other end of the page: it took
  // 14% of a 6x5 and 6% of a 6x12, so the hero grew weaker exactly as
  // the advertisement got bigger. It now competes for the paid column
  // like everything else — see the hero search in the caller.
  y = bar(c, 0, ad.headline, "DTP_HEADLINE", accent, heroMax);

  // ---- Industry / client line, set tight under the bars ----
  if (plan.subhead && ad.subhead) {
    const s = dtpSize("DTP_SUBHEAD", c.colW);
    for (const line of dtpWrap(ad.subhead, "DTP_SUBHEAD", W - c.pad * 2, c.colW)) {
      y += Math.round(s * 1.12);
      text(c, line, "DTP_SUBHEAD", c.pad, y, { fill: accent });
    }
    // Clear of the descenders. At 0.2 of the padding the subhead's tail
    // sat on top of the campaign heading bar that follows it.
    y += Math.round(s * 0.32);
  }
  // ---- Client band: the hiring company, as itself ----
  //
  // A supplied client logo is rendered HERE, beside the client's own
  // name, not in the agency footer. Two reasons, and the references
  // agree on both: the client mark belongs with the client's
  // information rather than with the advertiser's, and a logo dropped
  // into the footer reads as the agency's own — exactly the identity
  // merge the brand-role guard exists to prevent.
  //
  // Until now this branch printed only the name. A client logo passed
  // in was accepted by the type and then silently discarded, which is
  // the same class of defect as a dropped trade.
  if (ad.client?.name || ad.client?.logo) {
    const bodySize = dtpSize("DTP_BODY", c.colW);
    let bandBottom = y;

    const clientPng = ad.client.logo
      ? resolveSlotImage(
          "The DTP classified's client logo slot", ["CLIENT_LOGO"], ad.client.logo,
        )
      : null;

    let logoBox: LogoBox | null = null;
    if (clientPng) {
      // The height allowance is derived from what the mark needs to stay
      // readable, not set as a flat fraction.
      //
      // A flat 0.18 of the measure gave a square client mark a 128px
      // band carrying one 33px line of client name — paid column spent
      // on white. Tightening it to 0.13 then refused a portrait mark
      // outright, because at that height it could not reach the minimum
      // readable width. So a tall mark is granted exactly the extra
      // height it needs to clear that minimum and no more, and a wide
      // one never takes the extra.
      const clientMaxW = Math.round(W * 0.30);
      const clientSize = pngIntrinsicSize(clientPng);
      if (!clientSize) {
        throw new DtpAssetError(
          "The DTP classified's client logo slot", "asset is not a readable PNG",
        );
      }
      const clientAspect = clientSize.widthPx / clientSize.heightPx;
      const needForLegibility = Math.ceil((W * LOGO_MIN_WIDTH_FRACTION) / clientAspect);
      const clientMaxH = Math.min(
        Math.round(W * 0.22),
        Math.max(Math.round(W * 0.13), needForLegibility),
      );
      const { drawn } = fitLogo(
        "The DTP classified's client logo slot", clientPng, clientMaxW, clientMaxH,
      );
      if (drawn.width < W * LOGO_MIN_WIDTH_FRACTION) {
        throw new DtpAssetError(
          "The DTP classified's client logo slot",
          "cannot be placed above the minimum size at which a mark still reads",
        );
      }
      logoBox = { ...drawn, x: W - c.pad - drawn.width, y: 0 };
    }

    const nameWidth = W - c.pad * 2 - (logoBox ? logoBox.width + c.pad : 0);
    const nameLines = ad.client.name
      ? dtpWrap(`Client: ${ad.client.name}`, "DTP_BODY", nameWidth, c.colW)
      : [];
    const textH = nameLines.length * Math.round(bodySize * 1.15);

    // The band is as tall as the taller of the two, and the name is
    // centred against the mark. Setting the name from the top instead
    // left a square client logo standing beside a single short line
    // with a slab of paper under it — the logo placed correctly and the
    // band composed carelessly around it.
    const bandTop = y + Math.round(c.pad * 0.3);
    const bandH = Math.max(textH, logoBox ? logoBox.height : 0);
    if (logoBox) logoBox.y = bandTop + Math.round((bandH - logoBox.height) / 2);

    let ty = bandTop + Math.round((bandH - textH) / 2);
    for (const line of nameLines) {
      ty += Math.round(bodySize * 1.15);
      text(c, line, "DTP_BODY", c.pad, ty);
    }
    if (logoBox && clientPng) drawLogo(c, clientPng, logoBox);

    // Separation below the band. Without it the mark's lower edge sat
    // exactly on the interview bar's upper edge and read as a collision.
    bandBottom = bandTop + bandH + Math.round(c.pad * 0.35);
    y = Math.max(y, bandBottom);
  }

  // ---- Campaigns ----
  //
  // Each campaign is a self-contained hiring block: its own project
  // heading, its own interview dates, its own trades and conditions,
  // its own number to ring. They stack down the column and share the
  // agency footer at the foot of the booking.
  const campaigns = campaignsOf(ad);
  const multi = campaigns.length > 1;
  const allBlocks: RoleBlock[] = [];

  for (const [ci, campaign] of campaigns.entries()) {
    if (ci > 0) y += Math.round(c.pad * 0.5);

    // Project / client heading, reversed across the measure.
    if (campaign.heading) {
      if (y + dtpSize("DTP_LABEL", c.colW) * 1.6 > footerTop) {
        unplaced.push(`campaign heading: ${campaign.heading}`);
      } else {
        y = bar(c, y, campaign.heading, "DTP_LABEL", INK);
      }
    }

    // Interview dates, hard against the heading — the deadline the
    // reader is scanning for, never buried among the benefits.
    if (plan.interview && campaign.interview) {
      if (y + dtpSize("DTP_LABEL", c.colW) * 1.6 > footerTop) {
        unplaced.push(`interview: ${campaign.interview}`);
      } else {
        y = bar(c, y, campaign.interview, "DTP_LABEL", multi ? accent : INK);
      }
    }

    const blocks = buildRoleBlocks(c, campaign.positions, plan, titleMax);
    allBlocks.push(...blocks);

    // TWO ROLE GRAMMARS, both taken from the references, chosen by what
    // the trade actually carries.
    //
    // A trade with its own PAY gets the ruled block: name, then the
    // figure beneath, then a rule — the 6x5 booking, where three trades
    // fill the column and each one is a headline.
    //
    // A trade carrying only a qualification gets the compact bulleted
    // line — the 6x11 booking, where four campaigns and twenty trades
    // share the same column and a rule between every one of them would
    // eat the space the trades need. Ruling every trade in a dense
    // booking is what made a 6x11 that the reference prints
    // comfortably fail as over-capacity here.
    const ruled = blocks.some((b) => b.detail);

    for (const [index, b] of blocks.entries()) {
      if (!ruled) {
        const lead = index === 0 ? 0 : blockLead;
        const rowH = Math.round(b.titleSize * 1.32);
        if (y + rowH + lead > footerTop) {
          unplaced.push(b.title);
          continue;
        }
        y += rowH + lead;
        const bulletR = Math.max(1, Math.round(b.titleSize * 0.11));
        c.parts.push(
          `<circle cx="${c.pad + bulletR}" cy="${Math.round(y - b.titleSize * 0.3)}" ` +
            `r="${bulletR}" fill="${accent}"/>`,
        );
        const titleX = c.pad + bulletR * 4;
        const countW = b.count ? dtpTextWidth(b.count, "DTP_NUMBER", c.colW) + c.pad : 0;
        // The count belongs to the TRADE's baseline, not to wherever
        // the cursor ended up. Drawing it after the qualifier had
        // wrapped beneath the trade left "45" sitting alongside
        // "Diploma / Polytechnic, 5 years" instead of alongside "HVAC
        // TECHNICIAN" — a vacancy figure attached, to the eye, to the
        // wrong line.
        const titleBaseline = y;
        text(c, b.title, "DTP_NUMBER", titleX, titleBaseline, { size: b.titleSize });
        if (b.qualifier) {
          const advance = Math.round((dtpTextWidth(b.title, "DTP_NUMBER", c.colW) * b.titleSize)
            / dtpSize("DTP_NUMBER", c.colW));
          y = drawQualifier(c, b.qualifier, titleX, advance, b.titleSize, countW, titleBaseline);
        }
        if (b.count) {
          text(c, b.count, "DTP_NUMBER", W - c.pad, titleBaseline, {
            anchor: "end", fill: accent, size: b.titleSize,
          });
        }
        continue;
      }

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

      // The qualification continues the trade name on the same line, in
      // reading weight — "FOREMAN- Civil/ Electrical/Mechanical". Set
      // beneath as a second display line it would read as pay.
      if (b.qualifier) {
        const advance = Math.round((dtpTextWidth(b.title, "DTP_NUMBER", c.colW) * b.titleSize)
          / dtpSize("DTP_NUMBER", c.colW));
        y = drawQualifier(c, b.qualifier, c.pad, advance, b.titleSize, countW, y);
      }

      if (b.count) {
        text(c, b.count, "DTP_NUMBER", W - c.pad, y, {
          anchor: "end", fill: accent, size: b.titleSize,
        });
      }

      if (b.detail) {
        // Bold, not the body weight: in every reference the pay line is
        // the second-strongest mark in the block, under the trade name.
        const ds = roleDetailSize(b.detail, b.titleSize, c.W - c.pad * 2, c.colW);
        y += Math.round(ds * 1.24);
        text(c, b.detail, "DTP_PRICE", c.pad, y, { size: ds });
      }
      y += Math.round(c.pad * 0.3);
    }

    // Conditions that apply to this campaign's trades, banded so they
    // read as belonging to the block above rather than to the booking.
    if (campaign.note) {
      const ns = proseSize(c, proseScale);
      for (const line of wrapProse(c, campaign.note, W - c.pad * 2, proseScale)) {
        if (y + ns * 1.25 > footerTop) {
          unplaced.push(`note: ${campaign.note}`);
          continue;
        }
        y += Math.round(ns * 1.25);
        text(c, line, "DTP_BODY", c.pad, y, { size: ns });
      }
    }

    // The campaign's own number. Each reference campaign has one, and
    // it is how a reader knows which project they are ringing about.
    if (campaign.contactPhone) {
      // Set at label scale, not the footer's contact scale. A campaign
      // number is a line inside the booking, and giving each one the
      // weight of the agency's own telephone bar spent roughly a
      // centimetre of a 6x11 on three restatements of the same idea —
      // space the references give to a fourth campaign instead.
      const cs = dtpSize("DTP_LABEL", c.colW);
      if (y + cs * 1.6 > footerTop) {
        unplaced.push(`campaign contact: ${campaign.contactPhone}`);
      } else {
        y += Math.round(c.pad * 0.25);
        y = bar(c, y, `Contact: ${campaign.contactPhone}`, "DTP_LABEL", INK);
      }
    }
  }

  // ---- Salary panel: chosen by the shape of the pay data ----
  //
  // Not one presentation forced on every advertisement. Where trades
  // are paid differently the figure stays welded to its trade, because
  // separating them is how a reader ends up applying for the wrong
  // rate. Where every trade shares one structure, repeating it down the
  // column is noise, and the references set it once as a panel.
  const perRolePay = allBlocks.some((b) => b.detail);
  const wantsPanel = plan.salary && Boolean(ad.salary) && !perRolePay;
  if (wantsPanel && y + dtpLineHeight("DTP_PRICE", c.colW) * 1.6 >= footerTop) {
    unplaced.push(`salary: ${ad.salary ?? ""}`);
  }
  if (
    wantsPanel &&
    y + dtpLineHeight("DTP_PRICE", c.colW) * 1.6 < footerTop
  ) {
    const s = dtpSize("DTP_PRICE", c.colW);
    const boxH = Math.round(s * 1.7);
    y += Math.round(c.pad * 0.4);
    c.parts.push(
      `<rect x="${c.pad}" y="${Math.round(y)}" width="${W - c.pad * 2}" height="${boxH}" ` +
        `fill="${c.variant === "BW" ? "#EEEEEE" : "#FFE9A8"}" stroke="${INK}" stroke-width="1"/>`,
    );
    text(c, ad.salary ?? "", "DTP_PRICE", W / 2, y + boxH - Math.round(s * 0.45), { anchor: "middle" });
    y += boxH;
  }

  // ---- Benefits, run inline as the small bookings do ----
  //
  // These `break`s used to be silent. Adding the client band pushed the
  // eligibility lines off a 6x12 and nothing said so: the render
  // succeeded, the fill metric stayed healthy, and two verified
  // conditions of employment simply were not printed. Roles were made
  // to fail closed earlier; every other fact class was still free to
  // vanish. They all report now, and the scale search either finds a
  // size that holds them or the render fails.
  if (plan.benefits && (ad.benefits ?? []).length > 0) {
    const s = proseSize(c, proseScale);
    y += Math.round(c.pad * 0.3);
    for (const line of wrapProse(c, (ad.benefits ?? []).join(" • "), W - c.pad * 2, proseScale)) {
      if (y + s * 1.2 > footerTop) {
        unplaced.push(`benefit line: ${line}`);
        continue;
      }
      y += Math.round(s * 1.2);
      text(c, line, "DTP_BODY", c.pad, y, { size: s });
    }
  }

  if (plan.eligibility && (ad.eligibility ?? []).length > 0) {
    const s = proseSize(c, proseScale);
    for (const item of ad.eligibility ?? []) {
      for (const line of wrapProse(c, item, W - c.pad * 2, proseScale)) {
        if (y + s * 1.2 > footerTop) {
          unplaced.push(`eligibility: ${item}`);
          continue;
        }
        y += Math.round(s * 1.2);
        text(c, line, "DTP_BODY", c.pad, y, { size: s });
      }
    }
  }

  // ---- Venue bar ----
  if (plan.venue && input.interviewVenue) {
    const s = dtpSize("DTP_LABEL", c.colW);
    if (y + s * 1.7 < footerTop) {
      y += Math.round(c.pad * 0.3);
      y = bar(c, y, input.interviewVenue, "DTP_LABEL", accent);
    } else {
      unplaced.push(`interview venue: ${input.interviewVenue}`);
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
    W, H, colW: W, accent, variant, dpi,
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
  // Two dimensions. The TRADE NAME is searched outermost and prose
  // inside it, so the largest display size that can be made to work
  // wins and the reading sizes give way around it.
  //
  // Searching prose outermost is the obvious reading of "compress
  // before you fail", and it produced an advertisement whose benefit
  // prose was set larger than its job titles — every fact present,
  // hierarchy inverted. A classified is scanned by trade name; that is
  // the last thing that may shrink, not the first.
  const PROSE_STEPS = [1, 0.94, 0.88, 0.82, 0.76];

  // The hero competes for the column too, and is settled OUTSIDE the
  // body search: a strong destination band is preferred, and gives way
  // to a compact one only when the content needs the room. Which means
  // a sparse 6x5 gets a bold hero and a dense 6x11 gets a modest one —
  // the behaviour the references show — without either being written
  // down as a rule about height.
  // The hero's allowance is PROPORTIONAL TO THE PURCHASED AREA, then
  // searched downward from there.
  //
  // Without the proportional bound the largest step always won: a
  // bigger hero can always be made to "fit" by squeezing the trades
  // underneath it, so the search handed a 6x5 the same 73px band as a
  // 6x12 and took the space out of the vacancies. A destination is a
  // heading, not the advertisement.
  const heroBase = dtpSize("DTP_HEADLINE", c.colW);
  const heroCeiling = Math.max(
    Math.round(heroBase * 0.55),
    Math.min(Math.round(heroBase * 1.45), Math.round(H * 0.058)),
  );
  const HERO_STEPS = [1, 0.88, 0.78, 0.68, 0.6].map(
    (f) => Math.max(
      Math.round(heroBase * 0.5), Math.round(heroCeiling * f),
    ),
  );

  let chosen: number | null = null;
  let chosenProse = 1;
  let chosenHero = HERO_STEPS[HERO_STEPS.length - 1];
  outer: for (const hero of HERO_STEPS) {
    for (let size = ceiling; size >= floor; size -= 1) {
      for (const prose of PROSE_STEPS) {
        const probe: Ctx = { ...c, parts: [] };
        const trial = layoutBody(probe, input, plan, footerTop, size, 0, prose, hero);
        if (trial.unplaced.length === 0 && trial.bottom <= room) {
          chosen = size;
          chosenProse = prose;
          chosenHero = hero;
          break outer;
        }
      }
    }
  }

  if (chosen === null) {
    // Fail closed, in the project's existing terms. A booking too small
    // for its own content is a commercial decision for the agency to
    // make — buy more depth or advertise fewer trades — not something
    // the renderer may resolve by dropping vacancies.
    const last = layoutBody(
      { ...c, parts: [] }, input, plan, footerTop, floor, 0,
      PROSE_STEPS[PROSE_STEPS.length - 1], HERO_STEPS[HERO_STEPS.length - 1],
    );
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
  const saturated = layoutBody(
    { ...c, parts: [] }, input, plan, footerTop, chosen, 0, chosenProse, chosenHero,
  );
  const blocks = campaignsOf(ad).reduce((n, k) => n + k.positions.length, 0);
  const residual = Math.max(0, room - saturated.bottom);
  // Capped. Removing the cap did drive the fill metric to 99%, but the
  // render showed why that number was worthless: three trades in a
  // 6x12 became three near-empty ruled boxes with an entirely blank one
  // at the top. Air inside a block is rhythm; a block that is mostly
  // air is the dead space this is meant to prevent.
  const blockLead = blocks > 0
    ? Math.min(Math.round(c.W * 0.22), Math.floor(residual / blocks))
    : 0;

  const final = layoutBody(c, input, plan, footerTop, chosen, blockLead, chosenProse, chosenHero);
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
    roleScalePx: chosen,
    compressed: chosen < base,
  };
}
