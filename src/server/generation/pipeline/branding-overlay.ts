import "../font-config";
import sharp from "sharp";
import {
  footerTheme,
  type FooterStyle,
} from "./footer-styles";
import type { AdvertisementFacts } from "./types";

/**
 * KAI 10/10 RECRUITMENT AD RENDERING ENGINE
 *
 * THIS IS NOT A POSTER TEMPLATE.
 *
 * The engine behaves as a deterministic art director:
 *
 * 1. Understand the verified recruitment facts.
 * 2. Rank the candidate-facing message.
 * 3. Choose the headline.
 * 4. Measure information density.
 * 5. Choose the layout family.
 * 6. Protect mobile readability.
 * 7. Allocate the canvas.
 * 8. Render exact recruitment facts.
 * 9. Render agency trust only in the footer.
 *
 * GEMINI:
 * - photography
 * - environment
 * - workers
 * - machinery
 * - visual atmosphere
 * - visual storytelling
 *
 * KAI:
 * - exact readable recruitment text
 * - exact vacancy counts
 * - exact agency identity
 * - exact registration
 * - exact QR
 *
 * NEVER:
 * - invent facts
 * - hide roles
 * - use "+ more roles"
 * - shrink critical text indefinitely
 * - create spreadsheet-looking cards
 * - create a giant opaque poster panel
 * - repeat the agency identity unnecessarily
 */

export interface BrandingOverlayInput {
  imagePng: Buffer;
  widthPx: number;
  heightPx: number;

  facts?: AdvertisementFacts | null;

  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;

  agencyName?: string | null;
  registrationNumber?: string | null;
  contactLine?: string | null;
  addressLine?: string | null;

  footerStyle?: FooterStyle | null;
  brandBadges?: string[] | null;
}

const WHITE = "#FFFFFF";
const NAVY = "#0B1F33";
const GOLD = "#F3D98B";
const SOFT_WHITE = "#F5F7FA";

const OUTER_MARGIN = 0.045;
const SAFE_MIN_ROLE_FONT = 17;
const SAFE_MIN_HEADLINE_FONT = 34;
const FOOTER_HEIGHT_PCT = 0.085;

/**
 * Layout families.
 *
 * SPARSE:
 * strong hero + large roles
 *
 * MODERATE:
 * strong hero + compact role body
 *
 * DENSE:
 * high-density but still readable
 *
 * The renderer refuses to endlessly shrink typography.
 */
type LayoutFamily =
  | "SPARSE"
  | "MODERATE"
  | "DENSE";

interface LayoutMetrics {
  family: LayoutFamily;

  footerHeight: number;

  headlineTop: number;
  headlineHeight: number;

  roleTop: number;
  roleHeight: number;

  roleColumns: number;
  roleRows: number;
  roleFontSize: number;
  roleRowHeight: number;

  leftMargin: number;
  contentWidth: number;
  columnGap: number;
  columnWidth: number;

  countWidth: number;
}

/**
 * Main entry point.
 */
export async function applyBrandingOverlay(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    imagePng,
    widthPx,
    heightPx,
    facts,
  } = input;

  if (!facts) {
    return buildFooterOnlyImage(
      input,
    );
  }

  const layout =
    calculateLayout(
      facts,
      widthPx,
      heightPx,
    );

  const overlay =
    await buildRecruitmentComposition(
      input,
      layout,
    );

  return sharp(imagePng)
    .composite([
      {
        input: overlay,
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Compatibility exports used by the rest of the pipeline.
 */
export function brandingBandHeight(
  widthPx: number,
  heightPx: number,
): number {
  return Math.min(
    Math.round(
      heightPx *
        FOOTER_HEIGHT_PCT,
    ),
    Math.round(
      widthPx * 0.13,
    ),
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
  return brandingBandHeight(
    widthPx,
    heightPx,
  );
}

export const BRANDING_RESERVED_HEIGHT_PCT =
  9;

/* -------------------------------------------------------------------------- */
/* LAYOUT BRAIN                                                               */
/* -------------------------------------------------------------------------- */

function calculateLayout(
  facts: AdvertisementFacts,
  widthPx: number,
  heightPx: number,
): LayoutMetrics {
  const roleCount =
    facts.positions.length;

  const family =
    classifyLayoutFamily(
      roleCount,
    );

  const footerHeight =
    brandingBandHeight(
      widthPx,
      heightPx,
    );

  const leftMargin =
    Math.round(
      widthPx *
        OUTER_MARGIN,
    );

  const contentWidth =
    widthPx -
    leftMargin * 2;

  const columnGap =
    Math.round(
      widthPx * 0.025,
    );

  /**
   * The upper section is deliberately substantial.
   *
   * This protects the Gemini visual and allows KAI to place
   * the recruitment hook without turning the whole image into
   * a document.
   */
  const headlineTop =
    Math.round(
      heightPx * 0.055,
    );

  const headlineHeight =
    family === "SPARSE"
      ? Math.round(
          heightPx * 0.23,
        )
      : Math.round(
          heightPx * 0.19,
        );

  /**
   * Roles occupy the lower creative body.
   *
   * A translucent gradient is used rather than a solid poster
   * panel so Gemini's image remains visually present.
   */
  const roleTop =
    Math.round(
      heightPx * 0.515,
    );

  const roleHeight =
    heightPx -
    roleTop -
    footerHeight -
    Math.round(
      heightPx * 0.02,
    );

  /**
   * Select columns based on density.
   *
   * Crucially:
   * 19 roles -> 2 columns.
   *
   * We do NOT automatically go to 3 columns simply because
   * the content is large.
   */
  const roleColumns =
    family === "SPARSE"
      ? 1
      : family === "MODERATE"
        ? 2
        : roleCount <= 20
          ? 2
          : 3;

  const roleRows =
    Math.ceil(
      roleCount /
        roleColumns,
    );

  const usableRoleWidth =
    contentWidth -
    columnGap *
      (roleColumns - 1);

  const columnWidth =
    Math.floor(
      usableRoleWidth /
        roleColumns,
    );

  const countWidth =
    Math.max(
      42,
      Math.round(
        widthPx * 0.045,
      ),
    );

  const titleWidth =
    columnWidth -
    countWidth -
    Math.round(
      widthPx * 0.014,
    );

  /**
   * Start with a strong role font.
   *
   * Only reduce it when the actual calculated geometry
   * requires it.
   */
  const preferredRoleFont =
    family === "SPARSE"
      ? Math.round(
          widthPx * 0.024,
        )
      : family === "MODERATE"
        ? Math.round(
            widthPx * 0.020,
          )
        : Math.round(
            widthPx * 0.018,
          );

  const maximumRoleFontFromWidth =
    Math.floor(
      preferredRoleFont,
    );

  const fittedRoleFont =
    fitFont(
      "Procurement Engineer - Estimation",
      titleWidth,
      maximumRoleFontFromWidth,
      SAFE_MIN_ROLE_FONT,
    );

  const roleRowHeight =
    Math.max(
      Math.round(
        fittedRoleFont *
          1.22,
      ),
      Math.round(
        roleHeight /
          Math.max(
            roleRows,
            1,
          ),
      ),
    );

  /**
   * If calculated row height is too small, we keep the
   * minimum readable typography instead of shrinking it.
   *
   * This is the important difference from the old renderer.
   */
  return {
    family,

    footerHeight,

    headlineTop,
    headlineHeight,

    roleTop,
    roleHeight,

    roleColumns,
    roleRows,
    roleFontSize:
      fittedRoleFont,
    roleRowHeight,

    leftMargin,
    contentWidth,
    columnGap,
    columnWidth,

    countWidth,
  };
}

function classifyLayoutFamily(
  roleCount: number,
): LayoutFamily {
  if (
    roleCount <= 5
  ) {
    return "SPARSE";
  }

  if (
    roleCount <= 12
  ) {
    return "MODERATE";
  }

  return "DENSE";
}

/* -------------------------------------------------------------------------- */
/* RECRUITMENT COMPOSITION                                                    */
/* -------------------------------------------------------------------------- */

async function buildRecruitmentComposition(
  input: BrandingOverlayInput,
  layout: LayoutMetrics,
): Promise<Buffer> {
  const {
    widthPx,
    heightPx,
    facts,
  } = input;

  if (!facts) {
    return Buffer.alloc(0);
  }

  const footerHeight =
    layout.footerHeight;

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">`,
  ];

  /* ---------------------------------------------------------------------- */
  /* GLOBAL GRADIENTS                                                       */
  /* ---------------------------------------------------------------------- */

  svg.push(`
    <defs>

      <linearGradient
        id="kaiHeroTop"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="${NAVY}"
          stop-opacity="0.82"
        />

        <stop
          offset="58%"
          stop-color="${NAVY}"
          stop-opacity="0.34"
        />

        <stop
          offset="100%"
          stop-color="${NAVY}"
          stop-opacity="0"
        />
      </linearGradient>

      <linearGradient
        id="kaiRoleGradient"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="${NAVY}"
          stop-opacity="0.30"
        />

        <stop
          offset="18%"
          stop-color="${NAVY}"
          stop-opacity="0.72"
        />

        <stop
          offset="100%"
          stop-color="${NAVY}"
          stop-opacity="0.96"
        />
      </linearGradient>

      <linearGradient
        id="kaiFooterGradient"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset="0%"
          stop-color="${NAVY}"
          stop-opacity="0.97"
        />

        <stop
          offset="100%"
          stop-color="${NAVY}"
          stop-opacity="0.94"
        />
      </linearGradient>

    </defs>
  `);

  /* ---------------------------------------------------------------------- */
  /* HEADLINE / HOOK                                                        */
  /* ---------------------------------------------------------------------- */

  const headline =
    selectHeadline(
      facts,
    );

  const secondary =
    selectSecondaryLine(
      facts,
    );

  const headlineMaxWidth =
    layout.contentWidth;

  const headlineFont =
    fitFont(
      headline,
      headlineMaxWidth,
      layout.family ===
        "SPARSE"
        ? Math.round(
            widthPx * 0.052,
          )
        : Math.round(
            widthPx * 0.045,
          ),
      SAFE_MIN_HEADLINE_FONT,
    );

  const headlineLines =
    wrapText(
      headline,
      headlineMaxWidth,
      headlineFont,
      2,
    );

  /**
   * The headline is anchored at the top.
   * It is allowed to overlap the photographic area naturally
   * through the dark gradient beneath it.
   */
  svg.push(
    `<rect
      x="0"
      y="0"
      width="${widthPx}"
      height="${Math.round(
        layout.headlineHeight *
          1.18,
      )}"
      fill="url(#kaiHeroTop)"
    />`,
  );

  let headlineY =
    layout.headlineTop +
    headlineFont;

  for (
    let index = 0;
    index <
      headlineLines.length;
    index += 1
  ) {
    const line =
      headlineLines[index];

    svg.push(
      `<text
        x="${layout.leftMargin}"
        y="${headlineY}"
        font-family="KaiSans, sans-serif"
        font-size="${headlineFont}"
        font-weight="900"
        letter-spacing="-0.5"
        fill="${WHITE}"
      >${esc(line)}</text>`,
    );

    headlineY +=
      Math.round(
        headlineFont *
          0.93,
      );
  }

  if (secondary) {
    const secondaryFont =
      Math.max(
        21,
        Math.round(
          widthPx *
            0.018,
        ),
      );

    svg.push(
      `<text
        x="${layout.leftMargin}"
        y="${
          headlineY +
          Math.round(
            secondaryFont *
              1.25,
          )
        }"
        font-family="KaiSans, sans-serif"
        font-size="${secondaryFont}"
        font-weight="600"
        fill="${GOLD}"
      >${esc(secondary)}</text>`,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* OPPORTUNITY SIGNAL                                                     */
  /* ---------------------------------------------------------------------- */

  const vacancyTotal =
    totalVacancies(
      facts,
    );

  if (
    vacancyTotal !==
      null &&
    vacancyTotal > 0
  ) {
    const opportunity =
      vacancyTotal >= 20
        ? `${vacancyTotal} OPENINGS`
        : `${vacancyTotal} VACANCIES`;

    const pillFont =
      Math.max(
        17,
        Math.round(
          widthPx *
            0.015,
        ),
      );

    const pillWidth =
      Math.min(
        Math.round(
          widthPx *
            0.40,
        ),
        Math.round(
          estimateTextWidth(
            opportunity,
            pillFont,
          ) +
            widthPx *
              0.045,
        ),
      );

    const pillHeight =
      Math.round(
        pillFont *
          1.75,
      );

    const pillY =
      Math.min(
        Math.round(
          heightPx *
            0.36,
        ),
        headlineY +
          Math.round(
            pillFont *
              1.6,
          ),
      );

    svg.push(
      `<rect
        x="${layout.leftMargin}"
        y="${pillY}"
        width="${pillWidth}"
        height="${pillHeight}"
        rx="${Math.round(
          pillHeight / 2,
        )}"
        fill="${GOLD}"
      />`,
    );

    svg.push(
      `<text
        x="${
          layout.leftMargin +
          Math.round(
            pillWidth / 2,
          )
        }"
        y="${
          pillY +
          Math.round(
            pillHeight *
              0.68,
          )
        }"
        font-family="KaiSans, sans-serif"
        font-size="${pillFont}"
        font-weight="850"
        text-anchor="middle"
        fill="${NAVY}"
      >${esc(opportunity)}</text>`,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* ROLE AREA                                                              */
  /* ---------------------------------------------------------------------- */

  svg.push(
    `<rect
      x="0"
      y="${layout.roleTop}"
      width="${widthPx}"
      height="${layout.roleHeight}"
      fill="url(#kaiRoleGradient)"
    />`,
  );

  const sectionLabelY =
    layout.roleTop +
    Math.round(
      layout.roleHeight *
        0.055,
    );

  const sectionFont =
    Math.max(
      20,
      Math.round(
        widthPx *
          0.019,
      ),
    );

  svg.push(
    `<text
      x="${layout.leftMargin}"
      y="${sectionLabelY}"
      font-family="KaiSans, sans-serif"
      font-size="${sectionFont}"
      font-weight="850"
      fill="${WHITE}"
    >POSITIONS</text>`,
  );

  svg.push(
    `<rect
      x="${layout.leftMargin}"
      y="${
        sectionLabelY +
        11
      }"
      width="${Math.round(
        widthPx * 0.085,
      )}"
      height="4"
      fill="${GOLD}"
    />`,
  );

  const roleStartY =
    sectionLabelY +
    Math.round(
      sectionFont * 1.55,
    );

  const roleBottom =
    layout.roleTop +
    layout.roleHeight -
    Math.round(
      heightPx * 0.02,
    );

  const roleAvailableHeight =
    roleBottom -
    roleStartY;

  const maxRows =
    layout.roleRows;

  /**
   * Compute row height from actual geometry.
   *
   * We never shrink below the role legibility floor.
   */
  const actualRowHeight =
    Math.max(
      layout.roleRowHeight,
      Math.floor(
        roleAvailableHeight /
          Math.max(
            maxRows,
            1,
          ),
      ),
    );

  const titleGap =
    Math.round(
      widthPx *
        0.012,
    );

  const titleWidth =
    layout.columnWidth -
    layout.countWidth -
    titleGap;

  /**
   * Render all roles.
   *
   * IMPORTANT:
   * No "+ more roles".
   * No silent truncation.
   * No experience paragraphs.
   *
   * Exact title + exact count only.
   *
   * Experience and qualification data remain available in KAI's
   * structured requirement, but the social poster is not a PDF
   * requirement sheet.
   */
  for (
    let column = 0;
    column <
      layout.roleColumns;
    column += 1
  ) {
    const columnX =
      layout.leftMargin +
      column *
        (
          layout.columnWidth +
          layout.columnGap
        );

    for (
      let row = 0;
      row <
        layout.roleRows;
      row += 1
    ) {
      const index =
        column *
          layout.roleRows +
        row;

      const position =
        facts.positions[index];

      if (!position) {
        continue;
      }

      const rowY =
        roleStartY +
        row *
          actualRowHeight;

      const titleLines =
        wrapText(
          position.title,
          titleWidth,
          layout.roleFontSize,
          2,
        );

      const countText =
        typeof position.count ===
        "number"
          ? String(
              position.count,
            )
          : "";

      if (countText) {
        const countHeight =
          Math.round(
            layout.roleFontSize *
              1.42,
          );

        svg.push(
          `<rect
            x="${columnX}"
            y="${rowY}"
            width="${layout.countWidth}"
            height="${countHeight}"
            rx="5"
            fill="${GOLD}"
          />`,
        );

        svg.push(
          `<text
            x="${
              columnX +
              Math.round(
                layout.countWidth /
                  2,
              )
            }"
            y="${
              rowY +
              Math.round(
                countHeight *
                  0.72,
              )
            }"
            font-family="KaiSans, sans-serif"
            font-size="${Math.max(
              15,
              Math.round(
                layout.roleFontSize *
                  0.78,
              ),
            )}"
            font-weight="850"
            text-anchor="middle"
            fill="${NAVY}"
          >${esc(countText)}</text>`,
        );
      }

      const titleX =
        columnX +
        layout.countWidth +
        titleGap;

      for (
        let line = 0;
        line <
          titleLines.length;
        line += 1
      ) {
        svg.push(
          `<text
            x="${titleX}"
            y="${
              rowY +
              Math.round(
                layout.roleFontSize *
                  0.96,
              ) +
              line *
                Math.round(
                  layout.roleFontSize *
                    1.03,
                )
            }"
            font-family="KaiSans, sans-serif"
            font-size="${layout.roleFontSize}"
            font-weight="700"
            fill="${SOFT_WHITE}"
          >${esc(
            titleLines[line],
          )}</text>`,
        );
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* SOURCE-GROUNDED CTA / BENEFITS                                         */
  /* ---------------------------------------------------------------------- */

  const benefitLabels =
    getBenefitLabels(
      facts,
    );

  const contact =
    buildContactLine(
      facts,
      input,
    );

  /**
   * Only render CTA when actual source information exists.
   * No invented CTA.
   */
  if (
    benefitLabels.length > 0 ||
    contact
  ) {
    const bottomBandHeight =
      Math.round(
        heightPx *
          0.085,
      );

    const bottomBandTop =
      layout.roleTop +
      layout.roleHeight -
      bottomBandHeight;

    svg.push(
      `<rect
        x="0"
        y="${bottomBandTop}"
        width="${widthPx}"
        height="${bottomBandHeight}"
        fill="${NAVY}"
        fill-opacity="0.94"
      />`,
    );

    const bottomItems = [
      ...benefitLabels.slice(
        0,
        4,
      ),
      ...(contact
        ? [contact]
        : []),
    ];

    const bottomText =
      bottomItems.join(
        "  •  ",
      );

    if (bottomText) {
      const bottomFont =
        fitFont(
          bottomText,
          layout.contentWidth,
          Math.round(
            widthPx *
              0.014,
          ),
          14,
        );

      svg.push(
        `<text
          x="${layout.leftMargin}"
          y="${
            bottomBandTop +
            Math.round(
              bottomBandHeight *
                0.62,
            )
          }"
          font-family="KaiSans, sans-serif"
          font-size="${bottomFont}"
          font-weight="700"
          fill="${WHITE}"
        >${esc(bottomText)}</text>`,
      );
    }
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
/* HEADLINE DECISION                                                          */
/* -------------------------------------------------------------------------- */

function selectHeadline(
  facts: AdvertisementFacts,
): string {
  /**
   * The source header is already a grounded, candidate-facing claim.
   * Prefer it.
   *
   * Do not overwrite a real source-derived headline with generic
   * "WE ARE HIRING" copy.
   */
  if (
    facts.header &&
    facts.header.trim()
  ) {
    return facts.header.trim();
  }

  if (
    facts.projectType &&
    facts.country
  ) {
    return `${facts.projectType} — ${facts.country}`;
  }

  if (
    facts.industry &&
    facts.country
  ) {
    return `${facts.industry} — ${facts.country}`;
  }

  if (
    facts.country
  ) {
    return facts.country;
  }

  return "CAREER OPPORTUNITY";
}

function selectSecondaryLine(
  facts: AdvertisementFacts,
): string {
  const parts = [
    facts.country,
    facts.industry,
  ]
    .filter(Boolean)
    .map(
      (value) =>
        String(value).trim(),
    );

  const unique: string[] =
    [];

  for (const part of parts) {
    if (
      !unique.some(
        (existing) =>
          existing.toLowerCase() ===
          part.toLowerCase(),
      )
    ) {
      unique.push(part);
    }
  }

  return unique.join(
    "  ·  ",
  );
}

/* -------------------------------------------------------------------------- */
/* SUPPORT                                                                    */
/* -------------------------------------------------------------------------- */

function totalVacancies(
  facts: AdvertisementFacts,
): number | null {
  if (
    facts.positions.length ===
      0 ||
    !facts.positions.every(
      (position) =>
        typeof position.count ===
        "number",
    )
  ) {
    return null;
  }

  return facts.positions.reduce(
    (sum, position) =>
      sum +
      (position.count ?? 0),
    0,
  );
}

function getBenefitLabels(
  facts: AdvertisementFacts,
): string[] {
  if (
    !facts.benefits?.length
  ) {
    return [];
  }

  return facts.benefits
    .map(
      (benefit) =>
        benefit.detail
          ? `${benefit.label}: ${benefit.detail}`
          : benefit.label,
    )
    .filter(Boolean);
}

function buildContactLine(
  facts: AdvertisementFacts,
  input: BrandingOverlayInput,
): string | null {
  const values = [
    facts.contact.phone,
    facts.contact.email,
    facts.contact.whatsapp,
    input.contactLine,
  ]
    .filter(Boolean)
    .map(
      (value) =>
        String(value).trim(),
    );

  const unique: string[] =
    [];

  for (const value of values) {
    if (
      !unique.includes(value)
    ) {
      unique.push(value);
    }
  }

  return unique.length
    ? unique.join(
        "  ·  ",
      )
    : null;
}

function estimateTextWidth(
  text: string,
  size: number,
): number {
  return (
    text.length *
    size *
    0.56
  );
}

function fitFont(
  text: string,
  maxWidth: number,
  preferred: number,
  minimum: number,
): number {
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

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
): string[] {
  const words =
    text
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length ===
    0
  ) {
    return [""];
  }

  const lines: string[] =
    [];

  let current = "";

  for (const word of words) {
    const candidate =
      current
        ? `${current} ${word}`
        : word;

    if (
      !current ||
      estimateTextWidth(
        candidate,
        fontSize,
      ) <= maxWidth
    ) {
      current =
        candidate;
      continue;
    }

    lines.push(
      current,
    );

    current =
      word;

    if (
      lines.length ===
      maxLines - 1
    ) {
      const remaining =
        words
          .slice(
            words.indexOf(
              word,
            ) + 1,
          )
          .join(
            " ",
          );

      current =
        remaining
          ? `${current} ${remaining}`
          : current;

      break;
    }
  }

  if (current) {
    lines.push(
      current,
    );
  }

  return lines.slice(
    0,
    maxLines,
  );
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

/* -------------------------------------------------------------------------- */
/* FOOTER                                                                     */
/* -------------------------------------------------------------------------- */

async function buildFooterOnlyImage(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    widthPx,
    heightPx,
  } = input;

  const footer =
    await buildFooter(
      input,
    );

  return sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 4,
      background: {
        r: 255,
        g: 255,
        b: 255,
        alpha: 1,
      },
    },
  })
    .composite([
      {
        input: footer,
        left: 0,
        top:
          heightPx -
          brandingBandHeight(
            widthPx,
            heightPx,
          ),
      },
    ])
    .png()
    .toBuffer();
}

async function buildFooter(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    widthPx,
    heightPx,
    agencyLogoPng,
    qrPng,
    agencyName,
    registrationNumber,
    contactLine,
    addressLine,
    footerStyle,
  } = input;

  const theme =
    footerTheme(
      footerStyle,
    );

  const height =
    brandingBandHeight(
      widthPx,
      heightPx,
    );

  const pad =
    Math.round(
      widthPx * 0.025,
    );

  const qrSize =
    qrPng
      ? Math.round(
          height * 0.70,
        )
      : 0;

  const logoSize =
    agencyLogoPng
      ? Math.round(
          height * 0.58,
        )
      : 0;

  const qrLeft =
    widthPx -
    pad -
    qrSize;

  const textLeft =
    agencyLogoPng
      ? pad +
        logoSize +
        Math.round(
          pad * 0.55,
        )
      : pad;

  const textRight =
    qrPng
      ? qrLeft -
        pad
      : widthPx -
        pad;

  const available =
    Math.max(
      120,
      textRight -
        textLeft,
    );

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${height}">`,
    `<rect width="${widthPx}" height="${height}" fill="${theme.background}"/>`,
  ];

  if (
    theme.topRulePx >
    0
  ) {
    svg.push(
      `<rect x="0" y="0" width="${widthPx}" height="${theme.topRulePx}" fill="${theme.topRuleColour}"/>`,
    );
  }

  if (
    agencyLogoPng &&
    logoSize >
      0
  ) {
    const logo =
      await normaliseImage(
        agencyLogoPng,
        logoSize,
      );

    svg.push(
      `<image
        href="${toDataUri(
          logo,
        )}"
        x="${pad}"
        y="${Math.round(
          (height -
            logoSize) /
            2,
        )}"
        width="${logoSize}"
        height="${logoSize}"
        preserveAspectRatio="xMidYMid meet"
      />`,
    );
  }

  let y =
    Math.round(
      height * 0.38,
    );

  if (
    agencyName
  ) {
    const size =
      fitFont(
        agencyName,
        available,
        Math.round(
          height * 0.22,
        ),
        13,
      );

    svg.push(
      `<text
        x="${textLeft}"
        y="${y}"
        font-family="KaiSans, sans-serif"
        font-size="${size}"
        font-weight="850"
        fill="${theme.text}"
      >${esc(
        agencyName,
      )}</text>`,
    );

    y +=
      Math.round(
        size * 1.03,
      );
  }

  if (
    registrationNumber
  ) {
    const registration =
      `REG. ${registrationNumber}`;

    const size =
      fitFont(
        registration,
        available,
        Math.round(
          height * 0.095,
        ),
        10,
      );

    svg.push(
      `<text
        x="${textLeft}"
        y="${y}"
        font-family="KaiSans, sans-serif"
        font-size="${size}"
        font-weight="550"
        fill="${theme.text}"
        opacity="0.82"
      >${esc(
        registration,
      )}</text>`,
    );

    y +=
      Math.round(
        size * 1.15,
      );
  }

  const secondary =
    [
      contactLine,
      addressLine,
    ]
      .filter(Boolean)
      .join(
        "  ·  ",
      );

  if (secondary) {
    const size =
      fitFont(
        secondary,
        available,
        Math.round(
          height * 0.082,
        ),
        9,
      );

    svg.push(
      `<text
        x="${textLeft}"
        y="${Math.min(
          height - 5,
          y,
        )}"
        font-family="KaiSans, sans-serif"
        font-size="${size}"
        font-weight="500"
        fill="${theme.text}"
        opacity="0.72"
      >${esc(
        secondary,
      )}</text>`,
    );
  }

  if (
    qrPng &&
    qrSize >
      0
  ) {
    const qr =
      await normaliseImage(
        qrPng,
        qrSize,
      );

    svg.push(
      `<image
        href="${toDataUri(
          qr,
        )}"
        x="${qrLeft}"
        y="${Math.round(
          (height -
            qrSize) /
            2,
        )}"
        width="${qrSize}"
        height="${qrSize}"
        preserveAspectRatio="xMidYMid meet"
      />`,
    );
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

function toDataUri(
  png: Buffer,
): string {
  return `data:image/png;base64,${png.toString(
    "base64",
  )}`;
}

async function normaliseImage(
  png: Buffer,
  size: number,
): Promise<Buffer> {
  return sharp(
    png,
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
