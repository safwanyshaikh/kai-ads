import "../font-config";
import sharp from "sharp";
import type { FooterStyle } from "./footer-styles";
import type { AdvertisementFacts } from "./types";

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

export const BRANDING_RESERVED_HEIGHT_PCT =
  10.5;

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

  // Verified Agency Profile only — see the interface doc comment.
  // Joined onto one line the same way the (now-removed) campaign contact
  // line combined multiple pieces, so an agency with both still reads as
  // one tidy line rather than two.
  const officialContact = [
    cleanText(input.officialPhone),
    cleanText(input.officialEmail),
  ]
    .filter(Boolean)
    .join("   ·   ");

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
  /* AGENCY IDENTITY — fixed sizes, block vertically centred in the footer   */
  /* ---------------------------------------------------------------------- */
  //
  // Spec sizes are absolute px (not proportional to footer height, which
  // itself now barely varies — 250-300px) so the footer reads the same
  // regardless of platform format. fitFont is still applied as a
  // shrink-only safety net: the PREFERRED size is the spec value, never
  // exceeded, only reduced far enough to avoid clipping an unusually long
  // agency name/registration/address string.
  // Agency name is the DOMINANT footer text — sized closer to the
  // registration/contact lines' bigger sibling than a same-weight label,
  // so identity reads before any other line does.
  const AGENCY_NAME_SIZE = 36;
  const REGISTRATION_SIZE = 14;
  const CONTACT_SIZE = 13;
  const WEBSITE_SIZE = 12;
  const ADDRESS_SIZE = 11;

  const agencyFont = agencyName ? fitFont(agencyName, textWidth, AGENCY_NAME_SIZE, 20) : 0;
  const registrationText = registration
    ? /^reg\.?/i.test(registration)
      ? registration
      : `REG. ${registration}`
    : "";
  const registrationFont = registrationText ? fitFont(registrationText, textWidth, REGISTRATION_SIZE, 10) : 0;
  const officialContactFont = officialContact ? fitFont(officialContact, textWidth, CONTACT_SIZE, 9) : 0;
  const websiteFont = website ? fitFont(website, textWidth, WEBSITE_SIZE, 8) : 0;
  const addressFont = address ? fitFont(address, textWidth, ADDRESS_SIZE, 8) : 0;

  // Sequential flow, but the BLOCK is vertically centred in the footer
  // rather than pinned to a fixed top offset. Top-anchoring left a
  // visibly dead band beneath a sparse profile (agency name + registration
  // only, say) — nothing filled the rest of a 250-300px footer. Centring
  // the block as a whole (using only the lines that actually render) uses
  // the space intentionally regardless of how many fields the verified
  // profile has, without inventing decorative filler. Priority order per
  // spec: Agency Name -> Registration -> Phone+Email -> Website ->
  // Address, each omitted cleanly (no placeholder, no gap left behind)
  // when the field is absent.
  const lineGap = (font: number, mult: number) => Math.round(font * mult);
  const presentLines: Array<{ font: number; gap: number }> = [];
  if (agencyName) presentLines.push({ font: agencyFont, gap: lineGap(agencyFont, 1.2) });
  if (registrationText) presentLines.push({ font: registrationFont, gap: lineGap(registrationFont, 1.29) });
  if (officialContact) presentLines.push({ font: officialContactFont, gap: lineGap(officialContactFont, 1.38) });
  if (website) presentLines.push({ font: websiteFont, gap: lineGap(websiteFont, 1.33) });
  if (address) presentLines.push({ font: addressFont, gap: 0 });

  const blockHeight = presentLines.reduce((sum, l, i) => sum + (i === presentLines.length - 1 ? l.font : l.gap), 0);
  let textY = presentLines.length
    ? Math.round((heightPx - blockHeight) / 2 + presentLines[0].font * 0.78)
    : Math.round(heightPx * 0.155) + agencyFont;

  if (
    agencyName
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${textY}"
        font-family="KaiSans, sans-serif"
        font-size="${agencyFont}"
        font-weight="700"
        letter-spacing="0.2"
        fill="${WHITE}"
      >${esc(agencyName)}</text>
    `);

    textY += Math.round(agencyFont * 1.2);
  }

  /* ---------------------------------------------------------------------- */
  /* REGISTRATION                                                            */
  /* ---------------------------------------------------------------------- */

  if (
    registrationText
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(heightPx - 8, textY)}"
        font-family="KaiSans, sans-serif"
        font-size="${registrationFont}"
        font-weight="600"
        fill="${WHITE}"
        opacity="0.88"
      >${esc(
        registrationText,
      )}</text>
    `);

    textY += Math.round(registrationFont * 1.29);
  }

  /* ---------------------------------------------------------------------- */
  /* OFFICIAL AGENCY CONTACT — phone + email, verified profile only (LOCK 1) */
  /* ---------------------------------------------------------------------- */

  if (
    officialContact
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(heightPx - 8, textY)}"
        font-family="KaiSans, sans-serif"
        font-size="${officialContactFont}"
        font-weight="500"
        fill="${WHITE}"
        opacity="0.92"
      >${esc(officialContact)}</text>
    `);

    textY += Math.round(officialContactFont * 1.38);
  }

  /* ---------------------------------------------------------------------- */
  /* WEBSITE                                                                  */
  /* ---------------------------------------------------------------------- */

  if (
    website
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(heightPx - 8, textY)}"
        font-family="KaiSans, sans-serif"
        font-size="${websiteFont}"
        font-weight="500"
        fill="${WHITE}"
        opacity="0.75"
      >${esc(website)}</text>
    `);

    textY += Math.round(websiteFont * 1.33);
  }

  /* ---------------------------------------------------------------------- */
  /* REGISTERED ADDRESS — lowest priority, only when there's real room left */
  /* ---------------------------------------------------------------------- */

  if (
    address &&
    textY + addressFont <= heightPx - 10
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(heightPx - 5, textY)}"
        font-family="KaiSans, sans-serif"
        font-size="${addressFont}"
        font-weight="500"
        fill="${WHITE}"
        opacity="0.65"
      >${esc(address)}</text>
    `);
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
        font-family="KaiSans, sans-serif"
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
        font-family="KaiSans, sans-serif"
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

function estimateTextWidth(
  text: string,
  fontSize: number,
): number {
  return (
    text.length *
    fontSize *
    0.54
  );
}

function fitFont(
  text: string,
  maxWidth: number,
  preferred: number,
  minimum: number,
): number {
  if (!text) {
    return minimum;
  }

  let size =
    preferred;

  while (
    size > minimum &&
    estimateTextWidth(
      text,
      size,
    ) > maxWidth
  ) {
    size -= 1;
  }

  return Math.max(
    minimum,
    size,
  );
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
