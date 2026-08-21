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
      return {
        subhead: true, urgency: false, roleDetails: false, benefits: false,
        salary: true, eligibility: false, interview: false, venue: false,
        footer: "MINIMAL",
      };
    case "STANDARD":
      return {
        subhead: true, urgency: true, roleDetails: false, benefits: true,
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

  for (const l of dtpWrap(ad.tenant.name, "DTP_SUBHEAD", innerW, colW)) {
    lines.push({ token: "DTP_SUBHEAD", text: l });
  }
  if (input.established && richness !== "MINIMAL") {
    lines.push({ token: "DTP_LEGAL", text: input.established });
  }
  // Phone and email on their OWN lines. Joining them onto one line is
  // what pushed the email past the trim edge and clipped it.
  if (ad.contactPhone) {
    for (const l of dtpWrap(ad.contactPhone, "DTP_CONTACT", innerW, colW)) {
      lines.push({ token: "DTP_CONTACT", text: l });
    }
  }
  if (ad.contactEmail) {
    for (const l of dtpWrap(ad.contactEmail, "DTP_BODY", innerW, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }
  if (richness === "FULL") {
    for (const l of input.addressLines ?? []) {
      for (const w of dtpWrap(l, "DTP_LEGAL", innerW, colW)) {
        lines.push({ token: "DTP_LEGAL", text: w });
      }
    }
  }
  return lines;
}

interface FooterPlan {
  heightPx: number;
  licenceH: number;
  lines: FooterLine[];
  logoW: number;
  textLeft: number;
}

function planFooter(c: Ctx, input: DtpClassifiedInput, richness: DtpSectionPlan["footer"]): FooterPlan {
  const { ad } = input;
  const licenceH = ad.tenant.registrationText
    ? Math.round(dtpSize("DTP_LEGAL", c.colW) * 1.7)
    : 0;

  const hasLogo = Boolean(ad.tenant.logo) && richness !== "MINIMAL";
  const logoW = hasLogo ? Math.round(c.W * 0.28) : 0;
  const textLeft = c.pad + (logoW > 0 ? logoW + Math.round(c.pad * 0.7) : 0);
  const innerW = c.W - textLeft - c.pad;

  const lines = footerLines(input, richness, innerW, c.colW);
  const textH = lines.reduce((sum, l) => sum + dtpLineHeight(l.token, c.colW), 0);
  const logoH = hasLogo ? Math.round(logoW * 0.6) : 0;

  const heightPx = Math.round(c.pad * 0.8) + Math.max(textH, logoH) + Math.round(c.pad * 0.6) + licenceH;
  return { heightPx, licenceH, lines, logoW, textLeft };
}

function renderFooter(c: Ctx, input: DtpClassifiedInput, top: number, fp: FooterPlan): void {
  const { ad } = input;
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

  let y = top + Math.round(c.pad * 0.8);

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

/**
 * Lays out the body between the header and the footer.
 *
 * Called twice: once against a throwaway canvas to learn the natural
 * height, then again with `leadOut` — the surplus shared between
 * sections — so the copy fills the area the advertiser paid for.
 *
 * This is the newspaper compositor's "leading out", and it is why the
 * body is measured before it is drawn: a classified charged by the
 * square centimetre must not leave a band of white above its footer,
 * and stretching one section to absorb the surplus would break the
 * hierarchy instead of preserving it.
 */
interface BodyLayout {
  /** y of the last baseline drawn. */
  bottom: number;
  /** How many section boundaries this plan actually produced. */
  gaps: number;
}

function layoutBody(
  c: Ctx, input: DtpClassifiedInput, plan: DtpSectionPlan, footerTop: number, leadOut: number,
): BodyLayout {
  const { ad } = input;
  const accent = c.accent;
  const W = c.W;
  let y = 0;
  // Each boundary between two rendered sections is one place the
  // surplus may be led out. Only boundaries that actually occur are
  // counted, so a MINIMAL plan does not divide its slack eight ways.
  let gaps = 0;
  const gapAfterSection = () => {
    gaps += 1;
    y += leadOut;
  };

  // ---- Header: the destination, reversed and full-bleed ----
  const hlSize = dtpSize("DTP_HEADLINE", c.colW);
  const headerH = Math.round(hlSize * 1.5);
  c.parts.push(`<rect x="0" y="0" width="${W}" height="${headerH}" fill="${accent}"/>`);
  text(c, ad.headline, "DTP_HEADLINE", c.pad, headerH - Math.round(hlSize * 0.38), { fill: PAPER });
  y = headerH;

  if (plan.urgency && ad.urgency) {
    y = bar(c, y, ad.urgency, "DTP_LABEL", INK);
  }

  gapAfterSection();
  y += Math.round(c.pad * 0.6);

  if (plan.subhead && ad.subhead) {
    const s = dtpSize("DTP_SUBHEAD", c.colW);
    for (const line of dtpWrap(ad.subhead, "DTP_SUBHEAD", W - c.pad * 2, c.colW)) {
      y += Math.round(s * 1.05);
      text(c, line, "DTP_SUBHEAD", c.pad, y, { fill: accent });
    }
    y += Math.round(c.pad * 0.4);
    gapAfterSection();
  }

  if (ad.client?.name) {
    // The hiring company, named as itself — never merged with the
    // advertising agency's identity.
    const s = dtpSize("DTP_BODY", c.colW);
    for (const line of dtpWrap(`Client: ${ad.client.name}`, "DTP_BODY", W - c.pad * 2, c.colW)) {
      y += Math.round(s * 1.15);
      text(c, line, "DTP_BODY", c.pad, y);
    }
    gapAfterSection();
  }

  // ---- Roles: the reason the advertisement exists ----
  if (ad.positions.length > 0) gapAfterSection();
  const roleSize = dtpSize("DTP_NUMBER", c.colW);
  const roleLead = Math.round(roleSize * 1.22);
  const bulletR = Math.max(1, Math.round(roleSize * 0.13));

  for (const [index, p] of ad.positions.entries()) {
    if (y + roleLead > footerTop - Math.round(c.pad * 0.5)) break;
    if (index > 0) gapAfterSection();
    y += roleLead;
    const countText = typeof p.count === "number" ? String(p.count) : "";
    const countW = countText ? dtpTextWidth(countText, "DTP_NUMBER", c.colW) + 6 : 0;
    const titleX = c.pad + bulletR * 3;

    c.parts.push(
      `<circle cx="${c.pad + bulletR}" cy="${Math.round(y - roleSize * 0.3)}" r="${bulletR}" fill="${accent}"/>`,
    );
    const titleLines = dtpWrap(p.title, "DTP_NUMBER", W - titleX - c.pad - countW, c.colW);
    text(c, titleLines[0] ?? p.title, "DTP_NUMBER", titleX, y);
    if (countText) {
      text(c, countText, "DTP_NUMBER", W - c.pad, y, { anchor: "end", fill: accent });
    }
    for (const extra of titleLines.slice(1)) {
      if (y + roleLead > footerTop) break;
      y += roleLead;
      text(c, extra, "DTP_NUMBER", titleX, y);
    }
    if (plan.roleDetails && p.detail) {
      const ds = dtpSize("DTP_BODY", c.colW);
      for (const dl of dtpWrap(p.detail, "DTP_BODY", W - titleX - c.pad, c.colW)) {
        if (y + ds * 1.2 > footerTop) break;
        y += Math.round(ds * 1.2);
        text(c, dl, "DTP_BODY", titleX, y);
      }
    }
  }

  // ---- Salary: the strongest single attractor, panelled ----
  if (plan.salary && ad.salary && y + dtpLineHeight("DTP_PRICE", c.colW) * 1.6 < footerTop) {
    const s = dtpSize("DTP_PRICE", c.colW);
    const boxH = Math.round(s * 1.7);
    y += Math.round(c.pad * 0.6);
    c.parts.push(
      `<rect x="${c.pad}" y="${Math.round(y)}" width="${W - c.pad * 2}" height="${boxH}" ` +
        `fill="${c.variant === "BW" ? "#EEEEEE" : "#FFE9A8"}" stroke="${INK}" stroke-width="1"/>`,
    );
    text(c, ad.salary, "DTP_PRICE", W / 2, y + boxH - Math.round(s * 0.45), { anchor: "middle" });
    y += boxH;
    gapAfterSection();
  }

  // ---- Benefits, run inline as the small bookings do ----
  if (plan.benefits && (ad.benefits ?? []).length > 0) {
    const s = dtpSize("DTP_BODY", c.colW);
    for (const line of dtpWrap((ad.benefits ?? []).join(" • "), "DTP_BODY", W - c.pad * 2, c.colW)) {
      if (y + s * 1.2 > footerTop) break;
      y += Math.round(s * 1.2);
      text(c, line, "DTP_BODY", c.pad, y);
    }
    gapAfterSection();
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
    gapAfterSection();
  }

  // ---- Interview and venue bars ----
  if (plan.interview && ad.interview) {
    const s = dtpSize("DTP_LABEL", c.colW);
    if (y + s * 1.7 < footerTop) {
      y += Math.round(c.pad * 0.4);
      y = bar(c, y, ad.interview, "DTP_LABEL", INK);
      gapAfterSection();
    }
  }
  if (plan.venue && input.interviewVenue) {
    const s = dtpSize("DTP_LABEL", c.colW);
    if (y + s * 1.7 < footerTop) y = bar(c, y, input.interviewVenue, "DTP_LABEL", accent);
  }

  return { bottom: y, gaps };
}

/**
 * Composes one classified advertisement at its purchased size.
 *
 * Sections are emitted top-down against a cursor that knows where the
 * footer begins, so the advertisement fills its paid area without ever
 * writing into the footer or past the trim.
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

  // Measure the body's natural height on a throwaway canvas, then draw
  // it again led out to fill the paid area.
  const probe: Ctx = { ...c, parts: [] };
  const natural = layoutBody(probe, input, plan, footerTop, 0);
  const surplus = Math.max(0, footerTop - natural.bottom - Math.round(c.pad * 0.5));
  // Led out across the boundaries this plan actually has. The cap keeps
  // a sparse booking from drifting into unrelated white bands; whatever
  // the cap refuses stays as one deliberate rest above the footer.
  const leadOut = natural.gaps > 0
    ? Math.min(Math.round(c.W * 0.09), Math.floor(surplus / natural.gaps))
    : 0;
  const inkBottom = layoutBody(c, input, plan, footerTop, leadOut).bottom;
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
  };
}
