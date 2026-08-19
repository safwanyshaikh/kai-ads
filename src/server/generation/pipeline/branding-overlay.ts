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

/**
 * Keep the footer compact and predictable.
 *
 * This is NOT a recruitment content area.
 */
function footerHeight(
  widthPx: number,
  _heightPx: number,
): number {
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

export function brandingStripHeight(
  widthPx: number,
  heightPx: number,
  _hasContactLine: boolean,
): number {
  return footerHeight(
    widthPx,
    heightPx,
  );
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

  const heightPx =
    footerHeight(
      input.widthPx,
      input.heightPx,
    );

  // 48px at the reference 1080px width (0.0444 * 1080 = 48).
  const outerPadding =
    Math.max(
      32,
      Math.round(
        widthPx *
          0.0444,
      ),
    );

  // Logo bounding box: contain, aspect preserved — computed against the
  // ACTUAL source asset below (normaliseLogoToBox), never a synthetic
  // placeholder shape. Sized to genuinely read as prominent inside a
  // ~270px footer (roughly 60% of the band height), not a small chip
  // competing for attention with the QR.
  const LOGO_BOX_W = 190;
  const LOGO_BOX_H = 140;
  const logoBoxW = input.agencyLogoPng ? LOGO_BOX_W : 0;

  // 124-132px square, right side.
  const qrSize =
    input.qrPng
      ? 128
      : 0;

  const qrLeft =
    widthPx -
    outerPadding -
    qrSize;

  const logoLeft =
    outerPadding;

  const IDENTITY_TO_LOGO_GAP =
    Math.round(
      widthPx *
        0.02,
    );

  const textLeft =
    logoBoxW > 0
      ? logoLeft +
        logoBoxW +
        IDENTITY_TO_LOGO_GAP
      : outerPadding;

  const textRight =
    qrSize > 0
      ? qrLeft -
        outerPadding
      : widthPx -
        outerPadding;

  const textWidth =
    Math.max(
      150,
      textRight -
        textLeft,
    );

  const agencyName =
    cleanText(
      input.agencyName,
    );

  const registration =
    cleanText(
      input.registrationNumber,
    );

  const website = cleanText(input.website);

  const address =
    cleanText(
      input.addressLine,
    );

  const badges =
    (
      input.brandBadges ??
      []
    )
      .map(
        (item) =>
          cleanText(item),
      )
      .filter(Boolean);

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
  const AGENCY_NAME_SIZE = 36;
  const REGISTRATION_LABEL_SIZE = 12;

  // Wide mode's contact column has real room to spare (that's the whole
  // point of the two-column composition) — sized larger than the compact
  // stack's fixed sizes so the space is actively used rather than small
  // text floating in a wide box, while staying well under the agency
  // name so it never competes for dominance.
  const WIDE_REGISTRATION_SIZE = 17;
  const WIDE_CONTACT_SIZE = 17;
  const WIDE_ADDRESS_SIZE = 14;
  const WIDE_WEBSITE_SIZE = 15;

  // Compact mode's own, smaller sizes — "compact footer = use the height":
  // still a real, comfortable size (not the narrow-box minimums the old
  // single-line layout used), just not the wide column's larger scale.
  const COMPACT_REGISTRATION_SIZE = 15;
  const COMPACT_CONTACT_SIZE = 13;
  const COMPACT_ADDRESS_SIZE = 11;
  const COMPACT_WEBSITE_SIZE = 12;

  const IDENTITY_MIN_WIDTH = 260;
  const CONTACT_MIN_WIDTH = 220;
  const COLUMN_GAP = Math.max(20, Math.round(widthPx * 0.025));
  // The identity column's own floor size (matches buildIdentityLines'
  // agency-name minSize below) — used to measure how much width the
  // agency name genuinely needs before ever deciding a two-column split
  // can hold it without running into the contact column.
  const AGENCY_NAME_FLOOR = 18;

  const officialEmailValue = cleanText(input.officialEmail);
  const officialPhoneValue = cleanText(input.officialPhone);
  const hasContactFields = Boolean(officialEmailValue || officialPhoneValue || website || address);

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
  const agencyNameFloorWidth = agencyName
    ? Math.ceil(estimateTextWidth(agencyName, AGENCY_NAME_FLOOR, "DISPLAY"))
    : 0;
  const identityColWidth = Math.max(
    IDENTITY_MIN_WIDTH,
    agencyNameFloorWidth + Math.round(AGENCY_NAME_FLOOR * 0.7) * 2,
    Math.round(textWidth * 0.52),
  );
  const contactColWidth = textWidth - identityColWidth - COLUMN_GAP;
  const isWide = hasContactFields && contactColWidth >= CONTACT_MIN_WIDTH;

  // ONE responsive system, not two unrelated footer designs (Final
  // Commercial Layout Lock §6): both wide and compact render the exact
  // same labelled fields, in the exact same priority order — "MEA / RA
  // REGISTRATION:" label + the full number, then Official Email / Phone
  // per WhatsApp / Registered Address / Website, each its own line. The
  // only difference is whether they sit in one stacked column or split
  // across two, and at what size.
  function buildIdentityLines(registrationSize: number): FooterLine[] {
    const lines: FooterLine[] = [];
    if (agencyName) {
      lines.push({
        text: agencyName,
        size: AGENCY_NAME_SIZE,
        minSize: 18,
        weight: "700",
        role: "DISPLAY",
        opacity: 1,
        gapMultiplier: 1.25,
        letterSpacing: "0.2",
      });
    }
    if (registration) {
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
        text: registration,
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

  function buildContactLines(contactSize: number, addressSize: number, websiteSize: number): FooterLine[] {
    const lines: FooterLine[] = [];
    if (officialEmailValue) {
      lines.push({
        role: "FINE",
        text: `Official Email: ${officialEmailValue}`,
        size: contactSize,
        minSize: 9,
        weight: "500",
        opacity: 0.92,
        gapMultiplier: 1.35,
      });
    }
    if (officialPhoneValue) {
      lines.push({
        role: "FINE",
        text: `Phone / WhatsApp: ${officialPhoneValue}`,
        size: contactSize,
        minSize: 9,
        weight: "500",
        opacity: 0.92,
        gapMultiplier: 1.35,
      });
    }
    if (address) {
      lines.push({
        role: "FINE",
        text: `Registered Address: ${address}`,
        size: addressSize,
        minSize: 8,
        weight: "500",
        opacity: 0.75,
        gapMultiplier: 1.35,
      });
    }
    if (website) {
      lines.push({
        role: "FINE",
        text: `Website: ${website}`,
        size: websiteSize,
        minSize: 8,
        weight: "500",
        opacity: 0.75,
        gapMultiplier: 1,
      });
    }
    return lines;
  }

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

  /**
   * Fits, vertically centres and draws a column of lines against its OWN
   * measured width — the mechanism that lets identity and contact sit
   * side-by-side in wide mode without either one over- or under-sizing
   * its type for the space it actually has.
   */
  function drawColumn(x: number, maxWidth: number, lines: FooterLine[]): void {
    if (lines.length === 0) return;
    const fitted = lines.map((l) => ({ ...l, font: fitFont(l.text, maxWidth, l.size, l.minSize, l.role) }));
    const blockHeight = fitted.reduce(
      (sum, l, i) => sum + (i === fitted.length - 1 ? l.font : Math.round(l.font * l.gapMultiplier)),
      0,
    );
    let y = Math.round((heightPx - blockHeight) / 2 + fitted[0].font * 0.78);
    for (const l of fitted) {
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
      y += Math.round(l.font * l.gapMultiplier);
    }
  }

  if (isWide) {
    // LEFT: primary Agency Identity block. RIGHT: contact/verification
    // information zone, each field its own labelled line, using the
    // space instead of stacking underneath the agency name. Column
    // widths were already measured above (they're what decided isWide).
    const contactColX = textLeft + identityColWidth + COLUMN_GAP;

    drawColumn(textLeft, identityColWidth, buildIdentityLines(WIDE_REGISTRATION_SIZE));
    drawColumn(
      contactColX,
      contactColWidth,
      buildContactLines(WIDE_CONTACT_SIZE, WIDE_ADDRESS_SIZE, WIDE_WEBSITE_SIZE),
    );
  } else {
    // COMPACT: the SAME labelled fields as wide mode, in one stacked
    // column — every mandatory field still renders, spacing/secondary
    // font sizes shrink before anything is dropped, and the whole block
    // stays vertically centred so a sparse profile never leaves a dead
    // band under it.
    const lines = [
      ...buildIdentityLines(COMPACT_REGISTRATION_SIZE),
      ...buildContactLines(COMPACT_CONTACT_SIZE, COMPACT_ADDRESS_SIZE, COMPACT_WEBSITE_SIZE),
    ];
    drawColumn(textLeft, textWidth, lines);
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
        Math.round(
          heightPx *
            0.07,
        ),
        9,
        "SECTION",
      );

    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.max(
          Math.round(
            heightPx *
              0.82,
          ),
          heightPx - 12,
        )}"
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
