import "../font-config";
import sharp from "sharp";
import type { FooterStyle } from "./footer-styles";
import type { AdvertisementFacts } from "./types";

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

const NAVY = "#0B1F33";
const GOLD = "#F3D98B";
const WHITE = "#FFFFFF";
const SOFT_WHITE = "#F5F7FA";

const OUTER_MARGIN_PCT = 0.045;
const FOOTER_PCT = 0.105;

const MIN_ROLE_FONT = 18;
const MAX_ROLE_FONT = 25;
const MIN_HEADLINE_FONT = 36;
const MAX_HEADLINE_FONT = 64;

type LayoutMode =
  | "HERO"
  | "STANDARD"
  | "DENSE";

interface Layout {
  mode: LayoutMode;

  left: number;
  right: number;
  contentWidth: number;

  footerTop: number;
  footerHeight: number;

  headlineTop: number;
  headlineHeight: number;

  roleTop: number;
  roleBottom: number;
  roleHeight: number;

  columns: number;
  rows: number;
  columnGap: number;
  columnWidth: number;

  roleFont: number;
  roleRowHeight: number;
  countWidth: number;
}

/**
 * KAI recruitment rendering engine.
 *
 * The renderer is deterministic.
 *
 * Gemini:
 *   visual story / photography / environment / people
 *
 * KAI:
 *   exact recruitment facts / readable typography / trust layer
 *
 * Critical rule:
 *   readability > density.
 *
 * If a requirement is dense, the renderer changes the grammar
 * before shrinking the typography.
 */
export async function applyBrandingOverlay(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    facts,
    imagePng,
    widthPx,
    heightPx,
  } = input;

  if (!facts) {
    return renderFooterOnly(
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
    await renderAdvertisement(
      input,
      layout,
    );

  return sharp(
    imagePng,
  )
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
 * Compatibility exports used elsewhere.
 */
export function brandingBandHeight(
  widthPx: number,
  heightPx: number,
): number {
  return Math.round(
    Math.min(
      heightPx *
        FOOTER_PCT,
      widthPx *
        0.15,
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
  11;

/* -------------------------------------------------------------------------- */
/* LAYOUT                                                                      */
/* -------------------------------------------------------------------------- */

function calculateLayout(
  facts: AdvertisementFacts,
  widthPx: number,
  heightPx: number,
): Layout {
  const roleCount =
    facts.positions.length;

  const mode =
    roleCount <= 6
      ? "HERO"
      : roleCount <= 12
        ? "STANDARD"
        : "DENSE";

  const footerHeight =
    brandingBandHeight(
      widthPx,
      heightPx,
    );

  const footerTop =
    heightPx -
    footerHeight;

  const left =
    Math.round(
      widthPx *
        OUTER_MARGIN_PCT,
    );

  const right =
    widthPx -
    left;

  const contentWidth =
    right -
    left;

  /**
   * Dense recruitment means more columns, not smaller text.
   *
   * 19 roles => 3 columns => 7 rows.
   */
  const columns =
    mode === "HERO"
      ? 1
      : mode === "STANDARD"
        ? 2
        : roleCount <= 21
          ? 3
          : 4;

  const rows =
    Math.ceil(
      roleCount /
        columns,
    );

  const columnGap =
    Math.round(
      widthPx *
        0.022,
    );

  const columnWidth =
    Math.floor(
      (
        contentWidth -
        columnGap *
          (columns - 1)
      ) /
        columns,
    );

  /**
   * Header consumes no more than the upper 34%.
   * The image remains visually dominant.
   */
  const headlineTop =
    Math.round(
      heightPx *
        0.045,
    );

  const headlineHeight =
    Math.round(
      heightPx *
        (
          mode === "HERO"
            ? 0.23
            : 0.19
        ),
    );

  /**
   * Position area starts lower than before,
   * but its bottom is HARD-LOCKED to the footer.
   */
  const roleTop =
    Math.round(
      heightPx *
        (
          mode === "HERO"
            ? 0.55
            : 0.50
        ),
    );

  const roleBottom =
    footerTop -
    Math.round(
      heightPx *
        0.018,
    );

  const roleHeight =
    Math.max(
      1,
      roleBottom -
        roleTop,
    );

  const countWidth =
    Math.max(
      40,
      Math.round(
        widthPx *
          0.042,
      ),
    );

  const titleGap =
    Math.round(
      widthPx *
        0.012,
    );

  const titleWidth =
    columnWidth -
    countWidth -
    titleGap;

  /**
   * Dense mode deliberately starts around 20 px.
   * Never collapse into unreadable micro-text.
   */
  const preferredRoleFont =
    mode === "HERO"
      ? Math.min(
          MAX_ROLE_FONT,
          Math.round(
            widthPx *
              0.026,
          ),
        )
      : mode ===
          "STANDARD"
        ? Math.min(
            MAX_ROLE_FONT,
            Math.round(
              widthPx *
                0.021,
            ),
          )
        : Math.min(
            MAX_ROLE_FONT,
            Math.round(
              widthPx *
                0.019,
            ),
          );

  const representativeTitle =
    longestPositionTitle(
      facts,
    );

  const roleFont =
    fitFont(
      representativeTitle,
      titleWidth,
      preferredRoleFont,
      MIN_ROLE_FONT,
    );

  /**
   * Calculate row height from the actual number of rows.
   *
   * This prevents the final rows from being pushed into the footer.
   */
  const availableRowsHeight =
    Math.max(
      1,
      roleHeight -
        Math.round(
          heightPx *
            0.055,
        ),
    );

  const roleRowHeight =
    Math.max(
      Math.floor(
        availableRowsHeight /
          Math.max(
            rows,
            1,
          ),
      ),
      Math.round(
        roleFont *
          1.45,
      ),
    );

  return {
    mode,

    left,
    right,
    contentWidth,

    footerTop,
    footerHeight,

    headlineTop,
    headlineHeight,

    roleTop,
    roleBottom,
    roleHeight,

    columns,
    rows,
    columnGap,
    columnWidth,

    roleFont,
    roleRowHeight,
    countWidth,
  };
}

/* -------------------------------------------------------------------------- */
/* ADVERTISEMENT                                                                */
/* -------------------------------------------------------------------------- */

async function renderAdvertisement(
  input: BrandingOverlayInput,
  layout: Layout,
): Promise<Buffer> {
  const {
    widthPx,
    heightPx,
    facts,
  } = input;

  if (!facts) {
    return Buffer.alloc(
      0,
    );
  }

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">`,
    `
      <defs>

        <linearGradient
          id="kaiTop"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="${NAVY}"
            stop-opacity="0.92"
          />

          <stop
            offset="55%"
            stop-color="${NAVY}"
            stop-opacity="0.42"
          />

          <stop
            offset="100%"
            stop-color="${NAVY}"
            stop-opacity="0"
          />
        </linearGradient>

        <linearGradient
          id="kaiRoles"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="${NAVY}"
            stop-opacity="0.20"
          />

          <stop
            offset="20%"
            stop-color="${NAVY}"
            stop-opacity="0.72"
          />

          <stop
            offset="100%"
            stop-color="${NAVY}"
            stop-opacity="0.93"
          />
        </linearGradient>

        <linearGradient
          id="kaiFooter"
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
  ];

  /* ---------------------------------------------------------------------- */
  /* HEADLINE                                                                */
  /* ---------------------------------------------------------------------- */

  const headline =
    selectHeadline(
      facts,
    );

  const headlineFont =
    fitFont(
      headline,
      layout.contentWidth,
      layout.mode ===
        "HERO"
        ? MAX_HEADLINE_FONT
        : Math.round(
            MAX_HEADLINE_FONT *
              0.86,
          ),
      MIN_HEADLINE_FONT,
    );

  const headlineLines =
    wrapText(
      headline,
      layout.contentWidth,
      headlineFont,
      2,
    );

  svg.push(`
    <rect
      x="0"
      y="0"
      width="${widthPx}"
      height="${Math.round(
        layout.headlineHeight *
          1.35,
      )}"
      fill="url(#kaiTop)"
    />
  `);

  let headlineY =
    layout.headlineTop +
    headlineFont;

  for (
    const line of headlineLines
  ) {
    svg.push(`
      <text
        x="${layout.left}"
        y="${headlineY}"
        font-family="KaiSans, sans-serif"
        font-size="${headlineFont}"
        font-weight="900"
        fill="${WHITE}"
        letter-spacing="-0.6"
      >${esc(line)}</text>
    `);

    headlineY +=
      Math.round(
        headlineFont *
          0.92,
      );
  }

  const secondary =
    selectSecondary(
      facts,
    );

  if (secondary) {
    const secondaryFont =
      Math.max(
        21,
        Math.round(
          widthPx *
            0.018,
        ),
      );

    svg.push(`
      <text
        x="${layout.left}"
        y="${
          headlineY +
          Math.round(
            secondaryFont *
              1.2,
          )
        }"
        font-family="KaiSans, sans-serif"
        font-size="${secondaryFont}"
        font-weight="650"
        fill="${GOLD}"
      >${esc(secondary)}</text>
    `);
  }

  /* ---------------------------------------------------------------------- */
  /* VACANCY SIGNAL                                                          */
  /* ---------------------------------------------------------------------- */

  const total =
    totalVacancies(
      facts,
    );

  if (
    total !== null &&
    total > 0
  ) {
    const text =
      `${total} VACANCIES`;

    const font =
      Math.max(
        17,
        Math.round(
          widthPx *
            0.015,
        ),
      );

    const width =
      Math.min(
        Math.round(
          widthPx *
            0.30,
        ),
        Math.round(
          estimateTextWidth(
            text,
            font,
          ) +
            widthPx *
              0.045,
        ),
      );

    const height =
      Math.round(
        font *
          1.65,
      );

    const y =
      Math.min(
        Math.round(
          heightPx *
            0.34,
        ),
        headlineY +
          Math.round(
            font *
              1.45,
          ),
      );

    svg.push(`
      <rect
        x="${layout.left}"
        y="${y}"
        width="${width}"
        height="${height}"
        rx="${Math.round(
          height / 2,
        )}"
        fill="${GOLD}"
      />

      <text
        x="${
          layout.left +
          Math.round(
            width / 2,
          )
        }"
        y="${
          y +
          Math.round(
            height *
              0.69,
          )
        }"
        text-anchor="middle"
        font-family="KaiSans, sans-serif"
        font-size="${font}"
        font-weight="850"
        fill="${NAVY}"
      >${esc(text)}</text>
    `);
  }

  /* ---------------------------------------------------------------------- */
  /* ROLE REGION                                                             */
  /* ---------------------------------------------------------------------- */

  svg.push(`
    <rect
      x="0"
      y="${layout.roleTop}"
      width="${widthPx}"
      height="${layout.roleHeight}"
      fill="url(#kaiRoles)"
    />
  `);

  const labelFont =
    Math.max(
      20,
      Math.round(
        widthPx *
          0.019,
      ),
    );

  const labelY =
    layout.roleTop +
    Math.round(
      heightPx *
        0.045,
    );

  svg.push(`
    <text
      x="${layout.left}"
      y="${labelY}"
      font-family="KaiSans, sans-serif"
      font-size="${labelFont}"
      font-weight="850"
      fill="${WHITE}"
    >POSITIONS</text>

    <rect
      x="${layout.left}"
      y="${labelY + 10}"
      width="${Math.round(
        widthPx *
          0.075,
      )}"
      height="4"
      fill="${GOLD}"
    />
  `);

  const firstRoleY =
    labelY +
    Math.round(
      labelFont *
        1.45,
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
   * Divide roles vertically by columns.
   *
   * 19 roles:
   *   column 1 = 7
   *   column 2 = 6
   *   column 3 = 6
   *
   * This is visually much stronger than 10 rows in two columns.
   */
  const columnCounts =
    distributeRoles(
      facts.positions.length,
      layout.columns,
    );

  let globalIndex = 0;

  for (
    let column = 0;
    column <
      layout.columns;
    column += 1
  ) {
    const count =
      columnCounts[column] ??
      0;

    const columnX =
      layout.left +
      column *
        (
          layout.columnWidth +
          layout.columnGap
        );

    for (
      let row = 0;
      row < count;
      row += 1
    ) {
      const position =
        facts.positions[
          globalIndex
        ];

      globalIndex +=
        1;

      if (!position) {
        continue;
      }

      /**
       * Hard bottom boundary:
       *
       * Nothing may render below roleBottom.
       */
      const rowY =
        firstRoleY +
        row *
          layout.roleRowHeight;

      if (
        rowY +
          layout.roleRowHeight >
        layout.roleBottom
      ) {
        continue;
      }

      const countText =
        typeof position.count ===
          "number"
          ? String(
              position.count,
            )
          : "";

      if (countText) {
        const badgeHeight =
          Math.round(
            layout.roleFont *
              1.32,
          );

        svg.push(`
          <rect
            x="${columnX}"
            y="${rowY}"
            width="${layout.countWidth}"
            height="${badgeHeight}"
            rx="5"
            fill="${GOLD}"
          />

          <text
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
                badgeHeight *
                  0.72,
              )
            }"
            text-anchor="middle"
            font-family="KaiSans, sans-serif"
            font-size="${Math.max(
              15,
              Math.round(
                layout.roleFont *
                  0.78,
              ),
            )}"
            font-weight="850"
            fill="${NAVY}"
          >${esc(
            countText,
          )}</text>
        `);
      }

      const titleX =
        columnX +
        layout.countWidth +
        titleGap;

      const titleLines =
        wrapText(
          position.title,
          titleWidth,
          layout.roleFont,
          2,
        );

      for (
        let lineIndex = 0;
        lineIndex <
          titleLines.length;
        lineIndex += 1
      ) {
        const lineY =
          rowY +
          Math.round(
            layout.roleFont *
              0.96,
          ) +
          lineIndex *
            Math.round(
              layout.roleFont *
                1.04,
            );

        svg.push(`
          <text
            x="${titleX}"
            y="${lineY}"
            font-family="KaiSans, sans-serif"
            font-size="${layout.roleFont}"
            font-weight="720"
            fill="${SOFT_WHITE}"
          >${esc(
            titleLines[lineIndex],
          )}</text>
        `);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* FOOTER-SAFE SEPARATOR                                                   */
  /* ---------------------------------------------------------------------- */

  svg.push(`
    <rect
      x="0"
      y="${layout.footerTop - 2}"
      width="${widthPx}"
      height="2"
      fill="${GOLD}"
    />
  `);

  /* ---------------------------------------------------------------------- */
  /* TRUST FOOTER                                                            */
  /* ---------------------------------------------------------------------- */

  const footer =
    await renderFooter(
      input,
      layout,
    );

  svg.push(`
    <image
      href="${toDataUri(
        footer,
      )}"
      x="0"
      y="${layout.footerTop}"
      width="${widthPx}"
      height="${layout.footerHeight}"
      preserveAspectRatio="none"
    />
  `);

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
/* FOOTER                                                                      */
/* -------------------------------------------------------------------------- */

async function renderFooter(
  input: BrandingOverlayInput,
  layout: Layout,
): Promise<Buffer> {
  const {
    widthPx,
  } = input;

  const {
    footerHeight,
  } = layout;

  const logoSize =
    input.agencyLogoPng
      ? Math.round(
          footerHeight *
            0.55,
        )
      : 0;

  const qrSize =
    input.qrPng
      ? Math.round(
          footerHeight *
            0.70,
        )
      : 0;

  const pad =
    Math.round(
      widthPx *
        0.025,
    );

  const qrLeft =
    widthPx -
    pad -
    qrSize;

  const textLeft =
    logoSize > 0
      ? pad +
        logoSize +
        Math.round(
          widthPx *
            0.018,
        )
      : pad;

  const textRight =
    qrSize > 0
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${footerHeight}">`,
    `<rect width="${widthPx}" height="${footerHeight}" fill="${NAVY}"/>`,
    `<rect width="${widthPx}" height="3" fill="${GOLD}"/>`,
  ];

  if (
    input.agencyLogoPng &&
    logoSize > 0
  ) {
    const logo =
      await normalise(
        input.agencyLogoPng,
        logoSize,
      );

    svg.push(`
      <image
        href="${toDataUri(
          logo,
        )}"
        x="${pad}"
        y="${Math.round(
          (footerHeight -
            logoSize) /
            2,
        )}"
        width="${logoSize}"
        height="${logoSize}"
        preserveAspectRatio="xMidYMid meet"
      />
    `);
  }

  let y =
    Math.round(
      footerHeight *
        0.38,
    );

  if (
    input.agencyName
  ) {
    const font =
      fitFont(
        input.agencyName,
        available,
        Math.round(
          footerHeight *
            0.22,
        ),
        13,
      );

    svg.push(`
      <text
        x="${textLeft}"
        y="${y}"
        font-family="KaiSans, sans-serif"
        font-size="${font}"
        font-weight="850"
        fill="${WHITE}"
      >${esc(
        input.agencyName,
      )}</text>
    `);

    y +=
      Math.round(
        font *
          1.05,
      );
  }

  if (
    input.registrationNumber
  ) {
    const registration =
      `REG. ${input.registrationNumber}`;

    const font =
      fitFont(
        registration,
        available,
        Math.round(
          footerHeight *
            0.095,
        ),
        10,
      );

    svg.push(`
      <text
        x="${textLeft}"
        y="${y}"
        font-family="KaiSans, sans-serif"
        font-size="${font}"
        font-weight="550"
        fill="${WHITE}"
        opacity="0.82"
      >${esc(
        registration,
      )}</text>
    `);

    y +=
      Math.round(
        font *
          1.15,
      );
  }

  const contact =
    [
      input.contactLine,
      input.addressLine,
    ]
      .filter(Boolean)
      .join(
        "  •  ",
      );

  if (contact) {
    const font =
      fitFont(
        contact,
        available,
        Math.round(
          footerHeight *
            0.078,
        ),
        9,
      );

    svg.push(`
      <text
        x="${textLeft}"
        y="${Math.min(
          footerHeight -
            5,
          y,
        )}"
        font-family="KaiSans, sans-serif"
        font-size="${font}"
        font-weight="500"
        fill="${WHITE}"
        opacity="0.72"
      >${esc(
        contact,
      )}</text>
    `);
  }

  if (
    input.qrPng &&
    qrSize > 0
  ) {
    const qr =
      await normalise(
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
          (footerHeight -
            qrSize) /
            2,
        )}"
        width="${qrSize}"
        height="${qrSize}"
        preserveAspectRatio="xMidYMid meet"
      />
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

function selectHeadline(
  facts: AdvertisementFacts,
): string {
  if (
    facts.header?.trim()
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

  return (
    facts.country ||
    "CAREER OPPORTUNITY"
  );
}

function selectSecondary(
  facts: AdvertisementFacts,
): string {
  return [
    facts.country,
    facts.industry,
  ]
    .filter(Boolean)
    .join(
      "  •  ",
    );
}

function totalVacancies(
  facts: AdvertisementFacts,
): number | null {
  if (
    !facts.positions.length
  ) {
    return null;
  }

  const numeric =
    facts.positions.filter(
      (position) =>
        typeof position.count ===
        "number",
    );

  if (
    numeric.length !==
    facts.positions.length
  ) {
    return null;
  }

  return numeric.reduce(
    (
      total,
      position,
    ) =>
      total +
      (position.count ??
        0),
    0,
  );
}

function longestPositionTitle(
  facts: AdvertisementFacts,
): string {
  if (
    facts.positions.length ===
    0
  ) {
    return "Position";
  }

  return facts.positions.reduce(
    (
      longest,
      current,
    ) =>
      current.title.length >
      longest.length
        ? current.title
        : longest,
    facts.positions[0]
      .title,
  );
}

function distributeRoles(
  roleCount: number,
  columns: number,
): number[] {
  const result =
    Array.from(
      {
        length: columns,
      },
      () => 0,
    );

  const base =
    Math.floor(
      roleCount /
        columns,
    );

  let remainder =
    roleCount %
    columns;

  for (
    let i = 0;
    i < columns;
    i += 1
  ) {
    result[i] =
      base +
      (remainder >
      0
        ? 1
        : 0);

    if (
      remainder >
      0
    ) {
      remainder -=
        1;
    }
  }

  return result;
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
  let size =
    preferred;

  while (
    size > minimum &&
    estimateTextWidth(
      text,
      size,
    ) > maxWidth
  ) {
    size -=
      1;
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

  let current =
    "";

  for (
    const word of words
  ) {
    const candidate =
      current
        ? `${current} ${word}`
        : word;

    if (
      estimateTextWidth(
        candidate,
        fontSize,
      ) <=
        maxWidth ||
      !current
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
      lines.length >=
      maxLines
    ) {
      break;
    }
  }

  if (
    current &&
    lines.length <
      maxLines
  ) {
    lines.push(
      current,
    );
  }

  return lines;
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

async function normalise(
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

async function renderFooterOnly(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const footerHeight =
    brandingBandHeight(
      input.widthPx,
      input.heightPx,
    );

  const footer =
    await renderFooter(
      input,
      {
        mode: "HERO",
        left: 0,
        right:
          input.widthPx,
        contentWidth:
          input.widthPx,
        footerTop:
          input.heightPx -
          footerHeight,
        footerHeight,
        headlineTop: 0,
        headlineHeight: 0,
        roleTop: 0,
        roleBottom: 0,
        roleHeight: 0,
        columns: 1,
        rows: 0,
        columnGap: 0,
        columnWidth:
          input.widthPx,
        roleFont:
          MIN_ROLE_FONT,
        roleRowHeight:
          MIN_ROLE_FONT * 2,
        countWidth: 40,
      },
    );

  return sharp({
    create: {
      width:
        input.widthPx,
      height:
        input.heightPx,
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
          input.heightPx -
          footerHeight,
      },
    ])
    .png()
    .toBuffer();
}
