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

const FOOTER_HEIGHT_PCT =
  0.105;

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
  heightPx: number,
): number {
  return Math.max(
    110,
    Math.round(
      Math.min(
        heightPx *
          FOOTER_HEIGHT_PCT,
        widthPx *
          0.15,
      ),
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

  const outerPadding =
    Math.max(
      18,
      Math.round(
        widthPx *
          0.028,
      ),
    );

  const logoSize =
    input.agencyLogoPng
      ? Math.min(
          Math.round(
            heightPx *
              0.56,
          ),
          Math.round(
            widthPx *
              0.10,
          ),
        )
      : 0;

  const qrSize =
    input.qrPng
      ? Math.min(
          Math.round(
            heightPx *
              0.72,
          ),
          Math.round(
            widthPx *
              0.105,
          ),
        )
      : 0;

  const qrLeft =
    widthPx -
    outerPadding -
    qrSize;

  const logoLeft =
    outerPadding;

  const textLeft =
    logoSize > 0
      ? logoLeft +
        logoSize +
        Math.round(
          widthPx *
            0.018,
        )
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

  if (
    input.agencyLogoPng &&
    logoSize > 0
  ) {
    const logo =
      await normaliseImage(
        input.agencyLogoPng,
        logoSize,
      );

    svg.push(`
      <image
        href="${toDataUri(
          logo,
        )}"
        x="${logoLeft}"
        y="${Math.round(
          (heightPx -
            logoSize) /
            2,
        )}"
        width="${logoSize}"
        height="${logoSize}"
        preserveAspectRatio="xMidYMid meet"
      />
    `);
  }

  /* ---------------------------------------------------------------------- */
  /* AGENCY IDENTITY                                                         */
  /* ---------------------------------------------------------------------- */

  // Font sizes are computed up front — independent of Y — so the text
  // block's total height is known BEFORE any line is placed, and the
  // whole block can be vertically centred in the footer rather than
  // anchored at a fixed offset regardless of how many fields the Agency
  // Profile actually has. A profile with only a name (no registration,
  // address, phone/email or website — all optional per LOCK 1) previously
  // left a single line stranded near the top with a large dead gap below
  // it, reading as an incomplete/empty footer rather than a deliberately
  // compact one.
  const agencyFont = agencyName ? fitFont(agencyName, textWidth, Math.round(heightPx * 0.22), 16) : 0;
  const registrationText = registration
    ? /^reg\.?/i.test(registration)
      ? registration
      : `REG. ${registration}`
    : "";
  const registrationFont = registrationText
    ? fitFont(registrationText, textWidth, Math.round(heightPx * 0.095), 11)
    : 0;
  const addressFont = address ? fitFont(address, textWidth, Math.round(heightPx * 0.075), 10) : 0;
  const officialContactFont = officialContact
    ? fitFont(officialContact, textWidth, Math.round(heightPx * 0.08), 10)
    : 0;
  const websiteFont = website ? fitFont(website, textWidth, Math.round(heightPx * 0.07), 9) : 0;

  // Same line-advance multipliers the draw calls below apply, kept in one
  // place so centering can never drift from what's actually drawn.
  const AGENCY_ADVANCE = 1.05;
  const REGISTRATION_ADVANCE = 1.15;
  const ADDRESS_ADVANCE = 1.1;
  const OFFICIAL_CONTACT_ADVANCE = 1.1;
  const WEBSITE_ADVANCE = 1.1;

  let blockHeight = 0;
  if (agencyFont) blockHeight += Math.round(agencyFont * AGENCY_ADVANCE);
  if (registrationFont) blockHeight += Math.round(registrationFont * REGISTRATION_ADVANCE);
  if (addressFont) blockHeight += Math.round(addressFont * ADDRESS_ADVANCE);
  if (officialContactFont) blockHeight += Math.round(officialContactFont * OFFICIAL_CONTACT_ADVANCE);
  if (websiteFont) blockHeight += Math.round(websiteFont * WEBSITE_ADVANCE);

  // The space above the first baseline (a font's ascent) isn't part of
  // the increments above, so it's added once here to get the block's
  // true visual extent for centering.
  const leading = agencyFont
    ? Math.round(agencyFont * 0.8)
    : registrationFont
      ? Math.round(registrationFont * 0.8)
      : Math.round(heightPx * 0.12);

  let textY = Math.max(leading, Math.round((heightPx - (leading + blockHeight)) / 2) + leading);

  if (
    agencyName
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${textY}"
        font-family="KaiSans, sans-serif"
        font-size="${agencyFont}"
        font-weight="900"
        fill="${WHITE}"
      >${esc(agencyName)}</text>
    `);

    textY +=
      Math.round(
        agencyFont *
          AGENCY_ADVANCE,
      );
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
        y="${textY}"
        font-family="KaiSans, sans-serif"
        font-size="${registrationFont}"
        font-weight="650"
        fill="${WHITE}"
        opacity="0.82"
      >${esc(
        registrationText,
      )}</text>
    `);

    textY +=
      Math.round(
        registrationFont *
          REGISTRATION_ADVANCE,
      );
  }

  /* ---------------------------------------------------------------------- */
  /* REGISTERED ADDRESS                                                      */
  /* ---------------------------------------------------------------------- */

  if (
    address
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(
          heightPx -
            8,
          textY,
        )}"
        font-family="KaiSans, sans-serif"
        font-size="${addressFont}"
        font-weight="500"
        fill="${WHITE}"
        opacity="0.70"
      >${esc(address)}</text>
    `);

    textY +=
      Math.round(
        addressFont *
          ADDRESS_ADVANCE,
      );
  }

  /* ---------------------------------------------------------------------- */
  /* OFFICIAL AGENCY CONTACT — verified profile only (LOCK 1)                */
  /* ---------------------------------------------------------------------- */

  if (
    officialContact
  ) {
    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(
          heightPx -
            8,
          textY,
        )}"
        font-family="KaiSans, sans-serif"
        font-size="${officialContactFont}"
        font-weight="700"
        fill="${GOLD}"
      >${esc(officialContact)}</text>
    `);

    textY +=
      Math.round(
        officialContactFont *
          OFFICIAL_CONTACT_ADVANCE,
      );
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
        y="${Math.min(
          heightPx -
            5,
          textY,
        )}"
        font-family="KaiSans, sans-serif"
        font-size="${websiteFont}"
        font-weight="500"
        fill="${WHITE}"
        opacity="0.70"
      >${esc(website)}</text>
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

    svg.push(`
      <image
        href="${toDataUri(
          qr,
        )}"
        x="${qrLeft}"
        y="${Math.round(
          (heightPx -
            qrSize) /
            2,
        )}"
        width="${qrSize}"
        height="${qrSize}"
        preserveAspectRatio="xMidYMid meet"
      />
    `);

    const qrFont =
      Math.max(
        9,
        Math.round(
          heightPx *
            0.065,
        ),
      );

    svg.push(`
      <text
        x="${Math.round(
          qrLeft +
            qrSize /
              2,
        )}"
        y="${heightPx - 5}"
        text-anchor="middle"
        font-family="KaiSans, sans-serif"
        font-size="${qrFont}"
        font-weight="800"
        fill="${WHITE}"
        opacity="0.80"
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
