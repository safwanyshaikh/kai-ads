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
   * CAMPAIGN CONTACT.
   *
   * This is allowed to appear in the trust/action area,
   * but must never be confused with the registered office.
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

  const contact =
    cleanText(
      input.contactLine,
    );

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

  let textY =
    Math.round(
      heightPx *
        0.36,
    );

  if (
    agencyName
  ) {
    const agencyFont =
      fitFont(
        agencyName,
        textWidth,
        Math.round(
          heightPx *
            0.22,
        ),
        16,
      );

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
          1.05,
      );
  }

  /* ---------------------------------------------------------------------- */
  /* REGISTRATION                                                            */
  /* ---------------------------------------------------------------------- */

  if (
    registration
  ) {
    const registrationText =
      /^reg\.?/i.test(
        registration,
      )
        ? registration
        : `REG. ${registration}`;

    const registrationFont =
      fitFont(
        registrationText,
        textWidth,
        Math.round(
          heightPx *
            0.095,
        ),
        11,
      );

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
          1.15,
      );
  }

  /* ---------------------------------------------------------------------- */
  /* REGISTERED ADDRESS                                                      */
  /* ---------------------------------------------------------------------- */

  if (
    address
  ) {
    const addressFont =
      fitFont(
        address,
        textWidth,
        Math.round(
          heightPx *
            0.075,
        ),
        10,
      );

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
          1.1,
      );
  }

  /* ---------------------------------------------------------------------- */
  /* CAMPAIGN CONTACT                                                        */
  /* ---------------------------------------------------------------------- */

  if (
    contact
  ) {
    const contactFont =
      fitFont(
        contact,
        textWidth,
        Math.round(
          heightPx *
            0.075,
        ),
        10,
      );

    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(
          heightPx -
            5,
          textY,
        )}"
        font-family="KaiSans, sans-serif"
        font-size="${contactFont}"
        font-weight="700"
        fill="${GOLD}"
      >${esc(contact)}</text>
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
