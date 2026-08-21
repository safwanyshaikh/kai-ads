import "../font-config";
import sharp from "sharp";
import type { FooterStyle } from "./footer-styles";
import type { AdvertisementFacts } from "./types";
import { roleFamily, roleTextWidth, type TypeRole } from "@/lib/kdl-typography";

export interface BrandingOverlayInput {
  /**
   * COMPLETE GEMINI ADVERTISEMENT.
   *
   * This image must remain visually intact.
   */
  imagePng: Buffer;

  widthPx: number;
  heightPx: number;

  /**
   * Retained for pipeline compatibility.
   *
   * IMPORTANT:
   * This file MUST NOT use facts to render recruitment content.
   */
  facts?: AdvertisementFacts | null;

  /**
   * VERIFIED AGENCY ASSETS ONLY.
   */
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;

  /**
   * VERIFIED AGENCY IDENTITY.
   */
  agencyName?: string | null;
  registrationNumber?: string | null;

  /**
   * VERIFIED AGENCY OFFICIAL CONTACT.
   *
   * SOURCE OF TRUTH: the verified Agency Profile only — never the
   * recruitment requirement, never a campaign/candidate contact. These
   * render whenever the profile has them, independent of whether the
   * source PDF mentions any contact detail at all. A candidate-facing
   * contact from the requirement (facts.contact) is a separate concern,
   * already rendered in its own callout by the fact layer — it must
   * never substitute for these here.
   */
  officialPhone?: string | null;
  officialEmail?: string | null;
  website?: string | null;

  /**
   * @deprecated No longer rendered in the trust footer — a campaign
   * contact number is not verified agency identity and must not be
   * presented as if it were (see officialPhone/officialEmail above).
   * Retained on the type only for source compatibility with existing
   * callers; passing it is a no-op.
   */
  contactLine?: string | null;

  /**
   * VERIFIED AGENCY REGISTERED ADDRESS.
   *
   * This is NOT the interview venue.
   */
  addressLine?: string | null;

  footerStyle?: FooterStyle | null;

  /**
   * Verified permanent agency credentials.
   *
   * Examples:
   * - ISO 9001:2015
   * - Since 1984
   *
   * These are NOT recruitment benefits.
   */
  brandBadges?: string[] | null;
}

const NAVY =
  "#0B1F33";

const GOLD =
  "#F3D98B";

const WHITE =
  "#FFFFFF";

/**
 * ============================================================================
 * KAI TRUST LAYER — FINAL ARCHITECTURE
 * ============================================================================
 *
 * GEMINI OWNS THE COMPLETE ADVERTISEMENT:
 *
 *   headline
 *   destination
 *   industry
 *   hero
 *   positions
 *   benefits
 *   interview
 *   CTA
 *   typography
 *   visual hierarchy
 *   composition
 *   footer design
 *
 * KAI OWNS EXACT TRUST VALUES:
 *
 *   approved agency logo
 *   exact agency name
 *   exact RC / registration
 *   approved permanent credentials
 *   registered address
 *   campaign contact where supplied
 *   verification QR
 *
 * THIS FILE MUST NEVER RENDER:
 *
 *   job titles
 *   vacancy counts
 *   salary
 *   benefits
 *   interview details
 *   campaign headline
 *   role grids
 *   recruitment tables
 *   recruitment cards
 *   CRM panels
 *
 * This is a deliberate one-way trust injection layer.
 *
 * Gemini creates the advertisement.
 * KAI protects identity.
 *
 * CLIENT / EMPLOYER LOGO PROTECTION:
 *
 * A verified client/employer logo, wherever a future creative-placement
 * decision puts it (header, hero, supporting area), is composited into
 * `input.imagePng` BEFORE it reaches this function — this file never
 * receives or places a client logo itself. The footer's protection is
 * therefore structural, not a check on the client logo's own placement:
 * `renderTrustFooter` is always composited LAST, at a FIXED height and
 * position derived only from widthPx/heightPx, fully opaque across its
 * entire band. Nothing composited into `imagePng` beforehand — a client
 * logo included — can show through, shift, or shrink this region, no
 * matter where in the rest of the canvas it was placed. See
 * tests/branding-overlay-client-logo-protection.test.ts for the
 * regression proof.
 * ============================================================================
 */

export async function applyBrandingOverlay(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  /**
   * The advertisement body is already complete.
   *
   * We do not inspect facts here for layout decisions.
   * We do not rebuild the creative.
   *
   * This includes any client/employer logo a creative-placement decision
   * has already composited into input.imagePng elsewhere in the canvas —
   * this function only ever adds the trust footer on top, last, and never
   * inspects or moves anything already there.
   */
  const footer =
    await renderTrustFooter(
      input,
    );

  const footerTop =
    input.heightPx -
    footerHeight(
      input.widthPx,
      input.heightPx,
      input,
    );

  return sharp(
    input.imagePng,
  )
    .composite([
      {
        input: footer,
        left: 0,
        top: footerTop,
      },
    ])
    .png()
    .toBuffer();
}

/* -------------------------------------------------------------------------- */
/* FOOTER CONTENT MODEL — measured once, used by both the reserver and the     */
/* drawer                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One line of footer type, with everything needed to both MEASURE and
 * DRAW it. Measurement and drawing must never diverge: the fact layer
 * reserves the strip from the same numbers the overlay later fills it
 * with, so a line that measures at one size and draws at another would
 * reintroduce exactly the dead space this model exists to remove.
 */
interface FooterLine {
  text: string;
  size: number;
  minSize: number;
  weight: string;
  /** KDL semantic type role — drives both the drawn family and the width estimate. */
  role: TypeRole;
  opacity: number;
  gapMultiplier: number;
  letterSpacing?: string;
}

/** The verified footer strings, already cleaned. */
interface FooterFields {
  agencyName: string;
  registration: string;
  website: string;
  address: string;
  officialEmail: string;
  officialPhone: string;
}

const AGENCY_NAME_SIZE = 36;
const REGISTRATION_LABEL_SIZE = 12;
const WIDE_REGISTRATION_SIZE = 17;
const WIDE_CONTACT_SIZE = 17;
const WIDE_ADDRESS_SIZE = 14;
const WIDE_WEBSITE_SIZE = 15;
const COMPACT_REGISTRATION_SIZE = 15;
const COMPACT_CONTACT_SIZE = 13;
const COMPACT_ADDRESS_SIZE = 11;
const COMPACT_WEBSITE_SIZE = 12;
const FOOTER_MIN_READABLE = 11;
const FOOTER_ADDRESS_MAX_LINES = 2;
const IDENTITY_MIN_WIDTH = 260;
const CONTACT_MIN_WIDTH = 220;
const AGENCY_NAME_FLOOR = 18;

/**
 * Stand-ins used only when measuring from a FooterContent, where the
 * caller reports asset PRESENCE and holds no bytes. planFooter reads
 * these for truthiness alone; they are never decoded or drawn.
 */
const EMPTY_BUFFER = Buffer.alloc(0);
const PRESENCE_MARKER = Buffer.alloc(1);

/** Logo bounding box inside the footer. */
const LOGO_BOX_W = 190;
const LOGO_BOX_H = 140;
/** QR square. */
const QR_SIZE = 128;

function footerFields(input: BrandingOverlayInput): FooterFields {
  return {
    agencyName: cleanText(input.agencyName),
    registration: cleanText(input.registrationNumber),
    website: cleanText(input.website),
    address: cleanText(input.addressLine),
    officialEmail: cleanText(input.officialEmail),
    officialPhone: cleanText(input.officialPhone),
  };
}

/**
 * Splits a mandatory field across at most `maxLines` lines so it can be
 * set at a readable size instead of being shrunk toward the floor.
 *
 * The registered address is the field that forces this: it is the
 * longest verified string in the footer and it may never be
 * abbreviated, truncated or replaced by the website (Final Footer
 * Identity Pass). Wrapping spends footer height, which the footer now
 * grows to provide; shrinking spends legibility, which it does not.
 */
function wrapFooterText(
  text: string,
  size: number,
  role: TypeRole,
  maxWidth: number,
  maxLines: number,
): string[] {
  if (estimateTextWidth(text, size, role) <= maxWidth) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estimateTextWidth(candidate, size, role) > maxWidth) {
      out.push(current);
      current = word;
      if (out.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  // Whatever remains goes on the final line — never dropped. If it is
  // still too wide, fitFont shrinks that one line, as before.
  const consumed = out.join(" ");
  const rest = consumed ? text.slice(consumed.length).trim() : text;
  if (rest) out.push(rest);
  return out;
}

// ONE responsive system, not two unrelated footer designs (Final
// Commercial Layout Lock §6): both wide and compact render the exact
// same labelled fields, in the exact same priority order — "MEA / RA
// REGISTRATION:" label + the full number, then Official Email / Phone
// per WhatsApp / Registered Address / Website, each its own line. The
// only difference is whether they sit in one stacked column or split
// across two, and at what size.
function buildIdentityLines(f: FooterFields, registrationSize: number): FooterLine[] {
  const lines: FooterLine[] = [];
  if (f.agencyName) {
    lines.push({
      text: f.agencyName,
      size: AGENCY_NAME_SIZE,
      minSize: AGENCY_NAME_FLOOR,
      weight: "700",
      role: "DISPLAY",
      opacity: 1,
      gapMultiplier: 1.25,
      letterSpacing: "0.2",
    });
  }
  if (f.registration) {
    lines.push({
      text: "MEA / RA REGISTRATION:",
      size: REGISTRATION_LABEL_SIZE,
      minSize: 9,
      weight: "600",
      role: "SECTION",
      opacity: 0.7,
      gapMultiplier: 1.15,
    });
    lines.push({
      text: f.registration,
      size: registrationSize,
      minSize: 10,
      weight: "600",
      role: "FINE",
      opacity: 0.92,
      gapMultiplier: 1,
    });
  }
  return lines;
}

function buildContactLines(
  f: FooterFields,
  contactSize: number,
  addressSize: number,
  websiteSize: number,
  colWidth: number,
): FooterLine[] {
  const lines: FooterLine[] = [];
  if (f.officialEmail) {
    lines.push({
      role: "FINE",
      text: `Official Email: ${f.officialEmail}`,
      size: contactSize,
      minSize: 9,
      weight: "500",
      opacity: 0.92,
      gapMultiplier: 1.35,
    });
  }
  if (f.officialPhone) {
    lines.push({
      role: "FINE",
      text: `Phone / WhatsApp: ${f.officialPhone}`,
      size: contactSize,
      minSize: 9,
      weight: "500",
      opacity: 0.92,
      gapMultiplier: 1.35,
    });
  }
  if (f.address) {
    const addressLines = wrapFooterText(
      `Registered Address: ${f.address}`,
      addressSize,
      "FINE",
      colWidth,
      FOOTER_ADDRESS_MAX_LINES,
    );
    addressLines.forEach((text, i) => {
      lines.push({
        role: "FINE",
        text,
        size: addressSize,
        minSize: FOOTER_MIN_READABLE,
        weight: "500",
        opacity: 0.75,
        // Continuation lines of one field sit tighter than the gap
        // between two different fields.
        gapMultiplier: i === addressLines.length - 1 ? 1.35 : 1.15,
      });
    });
  }
  if (f.website) {
    lines.push({
      role: "FINE",
      text: `Website: ${f.website}`,
      size: websiteSize,
      minSize: FOOTER_MIN_READABLE,
      weight: "500",
      opacity: 0.75,
      gapMultiplier: 1,
    });
  }
  return lines;
}

/**
 * Fits a column of lines to its own measured width and returns both the
 * fitted lines and the exact height the block occupies. This is the
 * single height calculation in the footer — `drawColumn` draws from it,
 * and `footerHeight` sizes the whole strip from it.
 */
function fitFooterColumn(
  lines: FooterLine[],
  maxWidth: number,
): { fitted: (FooterLine & { font: number })[]; blockHeight: number; advance: (i: number) => number } {
  // The column is fitted as ONE block, not line by line. Sizing each
  // line independently lets a short line keep its full size while a
  // long one shrinks, which inverts the intended hierarchy (the
  // address printing larger than the email above it) and splits a
  // single wrapped field across two different sizes. Scaling the whole
  // column by the single worst-case factor keeps every relative size
  // relationship exactly as specified, then the per-line floor and
  // fitFont catch anything that still overruns.
  const scale = lines.reduce((s, l) => {
    const w = estimateTextWidth(l.text, l.size, l.role);
    return w > maxWidth ? Math.min(s, maxWidth / w) : s;
  }, 1);
  const fitted = lines.map((l) => {
    const scaled = Math.max(l.minSize, Math.round(l.size * scale));
    return { ...l, font: fitFont(l.text, maxWidth, scaled, l.minSize, l.role) };
  });

  // Baseline-to-baseline advance. A line's own size sets its natural
  // leading, but the clearance actually required is governed by the
  // font of the line BELOW it — a long address that shrank to its
  // minimum must still advance far enough that the larger website line
  // under it does not print through its descenders.
  const advance = (i: number): number =>
    Math.max(
      Math.round(fitted[i].font * fitted[i].gapMultiplier),
      Math.round(fitted[i + 1].font * 1.15),
    );

  const blockHeight = fitted.reduce(
    (sum, l, i) => sum + (i === fitted.length - 1 ? l.font : advance(i)),
    0,
  );

  return { fitted, blockHeight, advance };
}

interface FooterPlan {
  /** Total strip height the footer needs. */
  heightPx: number;
  /** Deliberate breathing space above the first line and below the last. */
  verticalPadding: number;
  isWide: boolean;
  fields: FooterFields;
  textLeft: number;
  textWidth: number;
  identityColWidth: number;
  contactColWidth: number;
  columnGap: number;
  logoBoxW: number;
  logoLeft: number;
  qrSize: number;
  qrLeft: number;
  outerPadding: number;
  badges: string[];
}

/**
 * Plans the footer from its ACTUAL content.
 *
 * Why this exists (Final Production UI Correction §4/§6): the footer
 * used to be a fixed slab — `clamp(250, width * 0.25, 300)` — sized for
 * the maximum-content case and then had its measured content block
 * vertically CENTRED inside it. For any agency whose profile was shorter
 * than that worst case, the leftover height became symmetric dead space:
 * a large empty band above the agency name and another below the last
 * line. Centring does not remove that space, it only splits it in two.
 *
 * The strip is now sized to what it holds:
 *
 *   height = content block + breathing space, bounded
 *
 * Content determines footer height. Footer height no longer determines
 * content placement.
 */
function planFooter(input: BrandingOverlayInput): FooterPlan {
  const { widthPx } = input;
  const fields = footerFields(input);

  // 48px at the reference 1080px width (0.0444 * 1080 = 48).
  const outerPadding = Math.max(32, Math.round(widthPx * 0.0444));
  const logoBoxW = input.agencyLogoPng ? LOGO_BOX_W : 0;
  const qrSize = input.qrPng ? QR_SIZE : 0;
  const qrLeft = widthPx - outerPadding - qrSize;
  const logoLeft = outerPadding;
  const identityToLogoGap = Math.round(widthPx * 0.02);

  const textLeft = logoBoxW > 0 ? logoLeft + logoBoxW + identityToLogoGap : outerPadding;
  const textRight = qrSize > 0 ? qrLeft - outerPadding : widthPx - outerPadding;
  const textWidth = Math.max(150, textRight - textLeft);

  const columnGap = Math.max(20, Math.round(widthPx * 0.025));

  // Responsive Rule (Final Commercial Layout Lock §7): measure the ACTUAL
  // available space, not an arbitrary percentage. A long agency name at
  // its readable floor can need more than IDENTITY_MIN_WIDTH's generic
  // minimum — sizing the identity column off ONLY a fixed fraction of
  // textWidth let a long name overflow into the contact column, which
  // fitFont's shrink-to-floor couldn't rescue once the floor itself no
  // longer fit. The column is now sized to whichever is larger — the
  // generic minimum, or what this specific agency name needs — and WIDE
  // is only chosen when the contact column still has genuine room left
  // over, not merely when the raw total width crosses a threshold.
  const agencyNameFloorWidth = fields.agencyName
    ? Math.ceil(estimateTextWidth(fields.agencyName, AGENCY_NAME_FLOOR, "DISPLAY"))
    : 0;
  const identityColWidth = Math.max(
    IDENTITY_MIN_WIDTH,
    agencyNameFloorWidth + Math.round(AGENCY_NAME_FLOOR * 0.7) * 2,
    Math.round(textWidth * 0.52),
  );
  const contactColWidth = textWidth - identityColWidth - columnGap;
  const hasContactFields = Boolean(
    fields.officialEmail || fields.officialPhone || fields.website || fields.address,
  );
  const isWide = hasContactFields && contactColWidth >= CONTACT_MIN_WIDTH;

  const badges = (input.brandBadges ?? []).map((item) => cleanText(item)).filter(Boolean);

  // The tallest text block the footer must hold. In wide mode the two
  // columns sit side by side, so the strip only needs the taller of them.
  let contentH: number;
  if (isWide) {
    const identity = fitFooterColumn(
      buildIdentityLines(fields, WIDE_REGISTRATION_SIZE),
      identityColWidth,
    );
    const contact = fitFooterColumn(
      buildContactLines(fields, WIDE_CONTACT_SIZE, WIDE_ADDRESS_SIZE, WIDE_WEBSITE_SIZE, contactColWidth),
      contactColWidth,
    );
    contentH = Math.max(identity.blockHeight, contact.blockHeight);
  } else {
    const stacked = fitFooterColumn(
      [
        ...buildIdentityLines(fields, COMPACT_REGISTRATION_SIZE),
        ...buildContactLines(
          fields,
          COMPACT_CONTACT_SIZE,
          COMPACT_ADDRESS_SIZE,
          COMPACT_WEBSITE_SIZE,
          textWidth,
        ),
      ],
      textWidth,
    );
    contentH = stacked.blockHeight;
  }

  // The badge strip is drawn beneath the identity block and needs its own
  // room; without accounting for it the strip would size to the text and
  // then print the badges into the padding.
  const badgeH = badges.length > 0 ? Math.round(widthPx * 0.022) : 0;

  // Trust assets set their own floor: the strip can never be shorter than
  // the logo or QR it must contain, whatever the text happens to need.
  const assetH = Math.max(
    logoBoxW > 0 ? LOGO_BOX_H : 0,
    qrSize > 0 ? Math.round(qrSize * 1.22) : 0,
  );

  // Breathing space (§5): deliberate separation from the preceding
  // advertisement content and below the last footer line — enough that the
  // agency name never visually merges with the body above it, and no more.
  // Proportional to width so it holds at 1080/1200/1600.
  const verticalPadding = Math.max(22, Math.round(widthPx * 0.028));

  const natural = Math.max(contentH + badgeH, assetH) + verticalPadding * 2;

  // Bounded, so a pathological profile can neither collapse the trust
  // strip nor let it eat the advertisement. The floor is deliberately
  // well below the old fixed 250 — a two-line footer legitimately needs
  // far less — while the cap preserves the previous worst case.
  const FLOOR = Math.round(widthPx * 0.115);
  const CAP = Math.min(300, Math.max(250, Math.round(widthPx * 0.25)));

  return {
    heightPx: Math.max(FLOOR, Math.min(CAP, natural)),
    verticalPadding,
    isWide,
    fields,
    textLeft,
    textWidth,
    identityColWidth,
    contactColWidth,
    columnGap,
    logoBoxW,
    logoLeft,
    qrSize,
    qrLeft,
    outerPadding,
    badges,
  };
}

/**
 * The trust footer's actual height for a given overlay input.
 *
 * Exported because the band is no longer a constant any caller can
 * recompute by hand: it is measured from the footer's content. Anything
 * that needs to know where the band starts — the compositor, a visual
 * regression test — must ask, rather than assume a fixed slab.
 */
export function trustFooterHeight(input: BrandingOverlayInput): number {
  return planFooter(input).heightPx;
}

/**
 * Keep the footer compact and predictable.
 *
 * This is NOT a recruitment content area.
 *
 * With `input`, the height is measured from the footer's real content
 * (see planFooter). Without it — legacy callers that only know the
 * canvas — it falls back to the previous fixed slab, which is the safe
 * upper bound rather than a guess that could under-reserve.
 */
function footerHeight(
  widthPx: number,
  _heightPx: number,
  input?: BrandingOverlayInput | null,
): number {
  if (input) return planFooter(input).heightPx;
  // The footer is a protected identity/trust composition, sized like the
  // genre's own compact professional footers — a fraction of canvas
  // WIDTH, not of however tall a dense role list happens to make the
  // canvas. 0.25 * 1080 lands exactly on the spec's own preferred target
  // (270px); clamped to the given 250-300px range for other canvas
  // widths in use (1200, 1600).
  return Math.min(
    300,
    Math.max(
      250,
      Math.round(widthPx * 0.25),
    ),
  );
}

/**
 * Compatibility exports.
 *
 * These values are retained for existing callers,
 * but the Fact Layer no longer owns advertisement composition.
 */
export function brandingBandHeight(
  widthPx: number,
  heightPx: number,
): number {
  return footerHeight(
    widthPx,
    heightPx,
  );
}

export function brandingContactRowHeight(
  _widthPx: number,
  _heightPx: number,
  _hasContactLine: boolean,
): number {
  return 0;
}

/**
 * The height the fact layer must reserve at the bottom of the canvas.
 *
 * `footerContent` carries the same verified agency identity the overlay
 * will later draw, so the reservation is measured from the real content
 * rather than from a worst-case slab. Omitting it keeps the previous
 * fixed-slab behaviour (a safe over-reservation, never an under-one).
 */
export function brandingStripHeight(
  widthPx: number,
  heightPx: number,
  _hasContactLine: boolean,
  footerContent?: FooterContent | null,
): number {
  if (!footerContent) return footerHeight(widthPx, heightPx, null);
  return planFooter({
    ...footerContent,
    widthPx,
    heightPx,
    imagePng: EMPTY_BUFFER,
    // Presence only — planFooter reads truthiness, never the bytes.
    agencyLogoPng: footerContent.hasLogo ? PRESENCE_MARKER : null,
    qrPng: footerContent.hasQr ? PRESENCE_MARKER : null,
  }).heightPx;
}

/**
 * The subset of BrandingOverlayInput that determines footer height.
 *
 * The fact layer knows all of this from the verified Agency Profile, so
 * it can reserve exactly what the overlay will need — without importing
 * the overlay's rendering concerns or holding image buffers it has no
 * use for.
 */
export interface FooterContent {
  agencyName?: string | null;
  registrationNumber?: string | null;
  officialEmail?: string | null;
  officialPhone?: string | null;
  website?: string | null;
  addressLine?: string | null;
  brandBadges?: string[] | null;
  /**
   * Whether the profile HAS these assets — not the assets themselves.
   * The fact layer never loads image buffers, but their presence sets the
   * strip's floor, so presence is what it reports.
   */
  hasLogo?: boolean;
  hasQr?: boolean;
}

/**
 * Stale since footerHeight() became width-proportional (25% of width,
 * clamped 250-300px) rather than height-proportional: the footer's share
 * of canvas HEIGHT now varies by aspect ratio instead of being a fixed
 * percentage, and is largest (worst case, for any caller that wants a
 * safe upper bound) exactly when width == height, where it is precisely
 * 25% — the value below. Not consumed anywhere in the pipeline itself
 * (`brandingStripHeight` is the real, current source of truth); retained
 * as a documented compatibility constant for existing callers/tests.
 */
export const BRANDING_RESERVED_HEIGHT_PCT =
  25;

/* -------------------------------------------------------------------------- */
/* TRUST FOOTER                                                                */
/* -------------------------------------------------------------------------- */

async function renderTrustFooter(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    widthPx,
  } = input;

  // ONE plan: the same measurement that sized the reserved strip also
  // places everything drawn into it, so the reservation and the drawing
  // can never disagree.
  const plan = planFooter(input);
  const heightPx = plan.heightPx;
  const {
    outerPadding,
    logoBoxW,
    logoLeft,
    qrSize,
    qrLeft,
    textLeft,
    textWidth,
    identityColWidth,
    contactColWidth,
    isWide,
    badges,
    fields,
  } = plan;
  const agencyName = fields.agencyName;
  void outerPadding;

  // Logo bounding box: contain, aspect preserved — computed against the
  // ACTUAL source asset below (normaliseLogoToBox), never a synthetic
  // placeholder shape.

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">`,

    `
      <defs>
        <linearGradient
          id="kaiTrustFooter"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop
            offset="0%"
            stop-color="${NAVY}"
          />

          <stop
            offset="100%"
            stop-color="#102A44"
          />
        </linearGradient>
      </defs>
    `,

    `
      <rect
        width="${widthPx}"
        height="${heightPx}"
        fill="url(#kaiTrustFooter)"
      />
    `,

    `
      <rect
        x="0"
        y="0"
        width="${widthPx}"
        height="3"
        fill="${GOLD}"
      />
    `,
  ];

  /* ---------------------------------------------------------------------- */
  /* VERIFIED AGENCY LOGO                                                    */
  /* ---------------------------------------------------------------------- */
  //
  // The actual approved/uploaded Agency Profile asset — never a
  // placeholder shape. Fit inside the 150x82 box (object-fit: contain),
  // aspect preserved, never distorted. Whatever transparency the source
  // asset already has is preserved as-is (no background is added or
  // removed here) — a logo uploaded with a dominant white background is
  // an asset-pipeline concern to fix at upload time, not something this
  // render step can safely repaint without risking a legitimate white
  // logo element.

  if (
    input.agencyLogoPng &&
    logoBoxW > 0
  ) {
    const logo =
      await normaliseLogoToBox(
        input.agencyLogoPng,
        LOGO_BOX_W,
        LOGO_BOX_H,
      );

    svg.push(`
      <image
        href="${toDataUri(
          logo.buffer,
        )}"
        x="${logoLeft +
          Math.round(
            (LOGO_BOX_W -
              logo.width) /
              2,
          )}"
        y="${Math.round(
          (heightPx -
            logo.height) /
            2,
        )}"
        width="${logo.width}"
        height="${logo.height}"
        preserveAspectRatio="xMidYMid meet"
      />
    `);
  }

  /* ---------------------------------------------------------------------- */
  /* AGENCY IDENTITY — responsive: compact stack, or wide two-column         */
  /* ---------------------------------------------------------------------- */
  //
  // Final Footer Identity Pass (2026-08): a fixed stacked column wastes a
  // wide footer's right-hand space — the renderer must measure what it
  // actually has (identityColumnWidth / contactColumnWidth below) and
  // choose compact-stack vs wide-two-column from that measurement, never
  // from a hard-coded percentage. Registration is NEVER shortened — only
  // fitFont's shrink-only sizing (never substring truncation) is applied,
  // in both modes.
  /**
   * Draws a column of lines against its OWN measured width, using the
   * SAME fit/advance calculation that sized the strip (fitFooterColumn).
   *
   * The block is TOP-ALIGNED inside the padded band, not centred in a
   * fixed slab. Centring was what turned every unused pixel of a
   * fixed-height footer into symmetric dead space above and below the
   * agency name; now the band is only as tall as the content plus its
   * deliberate breathing space, so the two columns simply start together
   * at the top padding and end where their content ends.
   */
  function drawColumn(x: number, maxWidth: number, lines: FooterLine[], top: number): void {
    if (lines.length === 0) return;
    const { fitted, advance } = fitFooterColumn(lines, maxWidth);

    let y = top + Math.round(fitted[0].font * 0.78);
    for (let i = 0; i < fitted.length; i++) {
      const l = fitted[i];
      svg.push(`
        <text
          x="${x}"
          y="${Math.min(heightPx - 6, Math.max(l.font, y))}"
          font-family="${roleFamily(l.role)}"
          font-size="${l.font}"
          font-weight="${l.weight}"
          ${l.letterSpacing ? `letter-spacing="${l.letterSpacing}"` : ""}
          fill="${WHITE}"
          opacity="${l.opacity}"
        >${esc(l.text)}</text>
      `);
      if (i < fitted.length - 1) y += advance(i);
    }
  }

  // Top padding: the deliberate separation between the advertisement
  // content above and the agency identity (§5) - present, but no longer
  // whatever height happened to be left over.
  const textTop = Math.max(18, Math.round(widthPx * 0.024));

  if (isWide) {
    // LEFT: primary Agency Identity block. RIGHT: contact/verification
    // information zone, each field its own labelled line, using the
    // space instead of stacking underneath the agency name. Column
    // widths were already measured by planFooter (they're what decided
    // isWide, and what sized this strip).
    const contactColX = textLeft + identityColWidth + plan.columnGap;

    drawColumn(
      textLeft,
      identityColWidth,
      buildIdentityLines(fields, WIDE_REGISTRATION_SIZE),
      textTop,
    );
    drawColumn(
      contactColX,
      contactColWidth,
      buildContactLines(fields, WIDE_CONTACT_SIZE, WIDE_ADDRESS_SIZE, WIDE_WEBSITE_SIZE, contactColWidth),
      textTop,
    );
  } else {
    // COMPACT: the SAME labelled fields as wide mode, in one stacked
    // column — every mandatory field still renders, and spacing/secondary
    // font sizes shrink before anything is dropped.
    const lines = [
      ...buildIdentityLines(fields, COMPACT_REGISTRATION_SIZE),
      ...buildContactLines(
        fields,
        COMPACT_CONTACT_SIZE,
        COMPACT_ADDRESS_SIZE,
        COMPACT_WEBSITE_SIZE,
        textWidth,
      ),
    ];
    drawColumn(textLeft, textWidth, lines, textTop);
  }

  /* ---------------------------------------------------------------------- */
  /* PERMANENT BRAND BADGES                                                  */
  /* ---------------------------------------------------------------------- */

  if (
    badges.length >
      0
  ) {
    const badgeText =
      badges.join(
        "  •  ",
      );

    const badgeFont =
      fitFont(
        badgeText,
        textWidth,
        Math.max(11, Math.round(widthPx * 0.0145)),
        9,
        "SECTION",
      );

    svg.push(`
      <text
        x="${textLeft}"
        y="${heightPx - plan.verticalPadding + Math.round(badgeFont * 0.35)}"
        font-family="${roleFamily("SECTION")}"
        font-size="${badgeFont}"
        font-weight="650"
        fill="${WHITE}"
        opacity="0.72"
      >${esc(
        badgeText,
      )}</text>
    `);
  }

  /* ---------------------------------------------------------------------- */
  /* QR                                                                       */
  /* ---------------------------------------------------------------------- */

  if (
    input.qrPng &&
    qrSize > 0
  ) {
    const qr =
      await normaliseImage(
        input.qrPng,
        qrSize,
      );

    // 10-11px label, weight 600 — the QR + its label are one vertically-
    // centred unit within the footer, not the QR centred independently
    // with the label pinned to the bottom edge (which visually detaches
    // the two and can crowd the last few px of the footer).
    const qrFont = 11;
    const qrLabelGap = Math.round(qrSize * 0.09);
    const qrBlockH = qrSize + qrLabelGap + Math.round(qrFont * 1.3);
    const qrTop = Math.round((heightPx - qrBlockH) / 2);

    svg.push(`
      <image
        href="${toDataUri(
          qr,
        )}"
        x="${qrLeft}"
        y="${qrTop}"
        width="${qrSize}"
        height="${qrSize}"
        preserveAspectRatio="xMidYMid meet"
      />
    `);

    svg.push(`
      <text
        x="${Math.round(
          qrLeft +
            qrSize /
              2,
        )}"
        y="${qrTop + qrSize + qrLabelGap + Math.round(qrFont * 0.9)}"
        text-anchor="middle"
        font-family="${roleFamily("SECTION")}"
        font-size="${qrFont}"
        font-weight="600"
        letter-spacing="0.6"
        fill="${WHITE}"
        opacity="0.85"
      >SCAN TO VERIFY</text>
    `);
  }

  svg.push(
    "</svg>",
  );

  return sharp(
    Buffer.from(
      svg.join(""),
    ),
  )
    .png()
    .toBuffer();
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* -------------------------------------------------------------------------- */

function cleanText(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value?.trim() ??
    ""
  );
}

/**
 * Advance width comes from the ONE shared KDL registry
 * (src/lib/kdl-typography.ts), keyed on the semantic ROLE that will
 * actually draw the string — the same registry and the same measured
 * factors the fact layer uses. A local per-weight table here was a
 * second source for the same constant and could drift from the face
 * really being rendered.
 */
function estimateTextWidth(text: string, fontSize: number, role: TypeRole = "BASE"): number {
  return roleTextWidth(text, fontSize, role);
}

function fitFont(
  text: string,
  maxWidth: number,
  preferred: number,
  minimum: number,
  role: TypeRole = "BASE",
): number {
  if (!text) return minimum;
  let size = preferred;
  while (size > minimum && estimateTextWidth(text, size, role) > maxWidth) size -= 1;
  return Math.max(minimum, size);
}

async function normaliseImage(
  image: Buffer,
  size: number,
): Promise<Buffer> {
  return sharp(
    image,
  )
    .resize(
      size,
      size,
      {
        fit: "inside",
        withoutEnlargement:
          false,
      },
    )
    .png()
    .toBuffer();
}

/**
 * Fits an image inside a maxW x maxH box (object-fit: contain), aspect
 * preserved, and returns its ACTUAL rendered dimensions so the caller can
 * centre it — a logo box is rarely the source asset's own aspect ratio,
 * so resizing alone (without reporting back the real output size) would
 * either stretch it or leave the caller positioning against the wrong
 * dimensions.
 */
async function normaliseLogoToBox(
  image: Buffer,
  maxW: number,
  maxH: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const buffer =
    await sharp(image)
      .resize(maxW, maxH, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();
  const metadata = await sharp(buffer).metadata();
  return {
    buffer,
    width: metadata.width ?? maxW,
    height: metadata.height ?? maxH,
  };
}

function toDataUri(
  image: Buffer,
): string {
  return `data:image/png;base64,${image.toString(
    "base64",
  )}`;
}

function esc(
  value: string,
): string {
  return value
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&apos;",
    );
}
