import "../font-config";
import sharp from "sharp";
import {
  footerTheme,
  type FooterStyle,
} from "./footer-styles";
import type { AdvertisementFacts } from "./types";

/**
 * KAI RENDERING ENGINE
 *
 * ONE deterministic rendering layer for verified recruitment facts.
 *
 * GEMINI owns:
 * - creative concept
 * - photography
 * - people
 * - environment
 * - visual storytelling
 * - visual hierarchy
 * - colour
 * - composition
 * - commercial appearance
 *
 * KAI owns:
 * - exact recruitment facts
 * - exact positions / counts
 * - exact benefits
 * - exact interview information
 * - exact employer/project facts
 * - exact contact
 * - exact agency identity
 * - exact registration
 * - exact QR verification
 *
 * This module does NOT create a separate poster/template.
 * It overlays verified information onto the completed Gemini artwork.
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

const NAVY = "#0B1F33";
const GOLD = "#F3D98B";
const WHITE = "#FFFFFF";

const SIDE_MARGIN = 0.045;
const INFO_ZONE_PCT = 0.285;
const FOOTER_ZONE_PCT = 0.085;
const MIN_FONT = 11;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function px(
  fraction: number,
  widthPx: number,
): number {
  return Math.max(
    1,
    Math.round(
      fraction * widthPx,
    ),
  );
}

function textWidth(
  text: string,
  size: number,
): number {
  return text.length * size * 0.56;
}

function fitFont(
  text: string,
  maxWidth: number,
  preferred: number,
  minimum = MIN_FONT,
): number {
  let size = preferred;

  while (
    size > minimum &&
    textWidth(
      text,
      size,
    ) > maxWidth
  ) {
    size -= 1;
  }

  return Math.max(
    size,
    minimum,
  );
}

function wrapLines(
  text: string,
  maxWidth: number,
  size: number,
): string[] {
  const words =
    text
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current
      ? `${current} ${word}`
      : word;

    if (
      !current ||
      textWidth(
        next,
        size,
      ) <= maxWidth
    ) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function countRoles(
  facts: AdvertisementFacts,
): number {
  return facts.positions.length;
}

function totalVacancies(
  facts: AdvertisementFacts,
): number | null {
  if (
    facts.positions.length === 0 ||
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

function buildCandidateHook(
  facts: AdvertisementFacts,
): string {
  const parts = [
    facts.projectType,
    facts.industry,
    facts.country,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value).trim(),
    );

  const unique: string[] = [];

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

  return unique.join(" — ");
}

function buildOpportunityLabel(
  facts: AdvertisementFacts,
): string {
  const vacancies =
    totalVacancies(facts);

  const roles =
    countRoles(facts);

  if (
    vacancies !== null &&
    vacancies > 0
  ) {
    return `${vacancies} VACANCIES · ${roles} ROLES`;
  }

  return `${roles} ROLES`;
}

function toDataUri(
  png: Buffer,
): string {
  return `data:image/png;base64,${png.toString(
    "base64",
  )}`;
}

export function brandingBandHeight(
  widthPx: number,
  heightPx: number,
): number {
  return Math.min(
    Math.round(
      heightPx * FOOTER_ZONE_PCT,
    ),
    Math.round(
      widthPx * 0.12,
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

export const BRANDING_RESERVED_HEIGHT_PCT = 9;

/**
 * Main rendering entry point.
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

  const layers: Array<{
    input: Buffer;
    left: number;
    top: number;
  }> = [];

  if (facts) {
    const factualOverlay =
      await buildIntegratedFactOverlay(
        input,
      );

    layers.push({
      input: factualOverlay,
      left: 0,
      top: 0,
    });
  }

  const footer =
    await buildCompactFooter(
      input,
    );

  layers.push({
    input: footer,
    left: 0,
    top:
      heightPx -
      brandingBandHeight(
        widthPx,
        heightPx,
      ),
  });

  return sharp(imagePng)
    .composite(layers)
    .png()
    .toBuffer();
}

/**
 * Single integrated verified-fact overlay.
 *
 * Gemini remains visible underneath.
 * No cream poster.
 * No separate document body.
 * No template reconstruction.
 */
async function buildIntegratedFactOverlay(
  input: BrandingOverlayInput,
): Promise<Buffer> {
  const {
    widthPx,
    heightPx,
    facts,
  } = input;

  if (!facts) {
    return Buffer.alloc(0);
  }

  const infoHeight =
    Math.round(
      heightPx *
        INFO_ZONE_PCT,
    );

  const footerHeight =
    brandingBandHeight(
      widthPx,
      heightPx,
    );

  const infoTop =
    heightPx -
    footerHeight -
    infoHeight;

  const margin =
    px(
      SIDE_MARGIN,
      widthPx,
    );

  const contentWidth =
    widthPx -
    margin * 2;

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">`,
  ];

  svg.push(
    `<defs>
      <linearGradient id="kaiInfoGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${NAVY}" stop-opacity="0.08"/>
        <stop offset="18%" stop-color="${NAVY}" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.95"/>
      </linearGradient>
    </defs>`,
  );

  svg.push(
    `<rect x="0" y="${infoTop}" width="${widthPx}" height="${infoHeight}" fill="url(#kaiInfoGradient)"/>`,
  );

  let y =
    infoTop +
    px(
      0.038,
      widthPx,
    );

  const hook =
    buildCandidateHook(
      facts,
    );

  if (hook) {
    const hookFont =
      fitFont(
        hook,
        contentWidth,
        px(
          0.032,
          widthPx,
        ),
        px(
          0.020,
          widthPx,
        ),
      );

    svg.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${hookFont}" font-weight="800" fill="${WHITE}">${esc(
        hook,
      )}</text>`,
    );

    y +=
      Math.round(
        hookFont * 1.18,
      );
  }

  const opportunity =
    buildOpportunityLabel(
      facts,
    );

  const ribbonFont =
    fitFont(
      opportunity,
      contentWidth * 0.48,
      px(
        0.014,
        widthPx,
      ),
      px(
        0.010,
        widthPx,
      ),
    );

  const ribbonWidth =
    textWidth(
      opportunity,
      ribbonFont,
    ) +
    px(
      0.024,
      widthPx,
    );

  const ribbonHeight =
    Math.round(
      ribbonFont * 1.9,
    );

  svg.push(
    `<rect x="${margin}" y="${y}" width="${ribbonWidth}" height="${ribbonHeight}" rx="${Math.round(
      ribbonHeight / 2,
    )}" fill="${GOLD}"/>`,
  );

  svg.push(
    `<text x="${
      margin +
      Math.round(
        ribbonWidth / 2,
      )
    }" y="${
      y +
      Math.round(
        ribbonHeight * 0.7,
      )
    }" font-family="KaiSans, sans-serif" font-size="${ribbonFont}" font-weight="800" fill="${NAVY}" text-anchor="middle">${esc(
      opportunity,
    )}</text>`,
  );

  y +=
    ribbonHeight +
    px(
      0.014,
      widthPx,
    );

  const positions =
    facts.positions;

  const columns =
    positions.length > 14
      ? 3
      : positions.length > 7
        ? 2
        : 1;

  const gap =
    px(
      0.014,
      widthPx,
    );

  const columnWidth =
    Math.floor(
      (
        contentWidth -
        gap *
          (columns - 1)
      ) / columns,
    );

  const rowsPerColumn =
    Math.ceil(
      positions.length /
        columns,
    );

  const countWidth =
    px(
      0.034,
      widthPx,
    );

  const titleGap =
    px(
      0.008,
      widthPx,
    );

  const titleWidth =
    columnWidth -
    countWidth -
    titleGap;

  const roleFont =
    fitFont(
      "Procurement Engineer - Estimation",
      titleWidth,
      px(
        positions.length > 14
          ? 0.0135
          : 0.016,
        widthPx,
      ),
      px(
        0.010,
        widthPx,
      ),
    );

  const lineHeight =
    Math.round(
      roleFont * 1.18,
    );

  const rowHeight =
    Math.max(
      lineHeight +
        px(
          0.007,
          widthPx,
        ),
      px(
        positions.length > 14
          ? 0.034
          : 0.040,
        widthPx,
      ),
    );

  for (
    let column = 0;
    column < columns;
    column += 1
  ) {
    const columnX =
      margin +
      column *
        (
          columnWidth +
          gap
        );

    for (
      let row = 0;
      row < rowsPerColumn;
      row += 1
    ) {
      const index =
        column *
          rowsPerColumn +
        row;

      const position =
        positions[index];

      if (!position) {
        continue;
      }

      const rowY =
        y +
        row *
          rowHeight;

      if (
        typeof position.count ===
        "number"
      ) {
        svg.push(
          `<rect x="${columnX}" y="${rowY}" width="${countWidth}" height="${Math.round(
            roleFont * 1.35,
          )}" rx="3" fill="${GOLD}"/>`,
        );

        svg.push(
          `<text x="${
            columnX +
            Math.round(
              countWidth / 2,
            )
          }" y="${
            rowY +
            Math.round(
              roleFont * 0.97,
            )
          }" font-family="KaiSans, sans-serif" font-size="${Math.max(
            10,
            Math.round(
              roleFont * 0.78,
            ),
          )}" font-weight="800" fill="${NAVY}" text-anchor="middle">${esc(
            String(
              position.count,
            ),
          )}</text>`,
        );
      }

      const titleX =
        columnX +
        countWidth +
        titleGap;

      const lines =
        wrapLines(
          position.title,
          titleWidth,
          roleFont,
        ).slice(0, 2);

      for (
        let lineIndex = 0;
        lineIndex <
        lines.length;
        lineIndex += 1
      ) {
        svg.push(
          `<text x="${titleX}" y="${
            rowY +
            Math.round(
              roleFont * 0.98,
            ) +
            lineIndex *
              lineHeight
          }" font-family="KaiSans, sans-serif" font-size="${roleFont}" font-weight="600" fill="${WHITE}">${esc(
            lines[lineIndex],
          )}</text>`,
        );
      }
    }
  }

  let detailY =
    y +
    rowsPerColumn *
      rowHeight +
    px(
      0.012,
      widthPx,
    );

  const secondaryFacts: string[] = [];

  if (facts.benefits.length) {
    secondaryFacts.push(
      facts.benefits
        .slice(0, 3)
        .map(
          (benefit) =>
            benefit.detail
              ? `${benefit.label}: ${benefit.detail}`
              : benefit.label,
        )
        .join(" · "),
    );
  }

  const interview =
    facts.interview[0];

  if (
    interview &&
    (
      interview.date ||
      interview.location
    )
  ) {
    secondaryFacts.push(
      [
        "INTERVIEW",
        interview.date,
        interview.location,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  if (secondaryFacts.length) {
    const secondary =
      secondaryFacts.join(
        "  |  ",
      );

    const secondaryFont =
      fitFont(
        secondary,
        contentWidth,
        px(
          0.0105,
          widthPx,
        ),
        px(
          0.008,
          widthPx,
        ),
      );

    if (
      detailY +
        secondaryFont <
      infoTop + infoHeight
    ) {
      svg.push(
        `<text x="${margin}" y="${detailY}" font-family="KaiSans, sans-serif" font-size="${secondaryFont}" fill="${WHITE}" opacity="0.82">${esc(
          secondary,
        )}</text>`,
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

async function buildCompactFooter(
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
    brandBadges,
  } = input;

  const theme =
    footerTheme(
      footerStyle,
    );

  const bandHeight =
    brandingBandHeight(
      widthPx,
      heightPx,
    );

  const pad =
    Math.round(
      widthPx *
        0.018,
    );

  const qrSize =
    qrPng
      ? Math.round(
          bandHeight *
            0.68,
        )
      : 0;

  const logoSize =
    agencyLogoPng
      ? Math.round(
          bandHeight *
            0.56,
        )
      : 0;

  const qrLeft =
    qrPng
      ? widthPx -
        pad -
        qrSize
      : widthPx - pad;

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
        Math.round(
          pad * 0.55,
        )
      : widthPx - pad;

  const available =
    Math.max(
      100,
      textRight -
        textLeft,
    );

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${bandHeight}">`,
  ];

  svg.push(
    `<rect x="0" y="0" width="${widthPx}" height="${bandHeight}" fill="${theme.background}"/>`,
  );

  if (
    theme.topRulePx > 0
  ) {
    svg.push(
      `<rect x="0" y="0" width="${widthPx}" height="${theme.topRulePx}" fill="${theme.topRuleColour}"/>`,
    );
  }

  if (
    agencyLogoPng &&
    logoSize > 0
  ) {
    svg.push(
      `<image href="${toDataUri(
        await normaliseImage(
          agencyLogoPng,
          logoSize,
        ),
      )}" x="${pad}" y="${Math.round(
        (bandHeight -
          logoSize) /
          2,
      )}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  let textY =
    Math.round(
      bandHeight *
        0.38,
    );

  if (agencyName) {
    const size =
      fitFont(
        agencyName,
        available,
        Math.round(
          bandHeight *
            0.19,
        ),
        13,
      );

    svg.push(
      `<text x="${textLeft}" y="${textY}" font-family="KaiSans, sans-serif" font-size="${size}" font-weight="700" fill="${theme.text}">${esc(
        agencyName,
      )}</text>`,
    );

    textY +=
      Math.round(
        size * 1.08,
      );
  }

  if (registrationNumber) {
    const registration =
      `RA ${registrationNumber}`;

    const size =
      fitFont(
        registration,
        available,
        Math.round(
          bandHeight *
            0.10,
        ),
        10,
      );

    svg.push(
      `<text x="${textLeft}" y="${textY}" font-family="KaiSans, sans-serif" font-size="${size}" fill="${theme.text}" opacity="0.82">${esc(
        registration,
      )}</text>`,
    );

    textY +=
      Math.round(
        size * 1.1,
      );
  }

  const secondary =
    [
      contactLine,
      addressLine,
      brandBadges?.[0],
    ]
      .filter(Boolean)
      .join(" · ");

  if (secondary) {
    const size =
      fitFont(
        secondary,
        available,
        Math.round(
          bandHeight *
            0.085,
        ),
        9,
      );

    svg.push(
      `<text x="${textLeft}" y="${Math.min(
        bandHeight - 5,
        textY,
      )}" font-family="KaiSans, sans-serif" font-size="${size}" fill="${theme.text}" opacity="0.72">${esc(
        secondary,
      )}</text>`,
    );
  }

  if (
    qrPng &&
    qrSize > 0
  ) {
    svg.push(
      `<image href="${toDataUri(
        await normaliseImage(
          qrPng,
          qrSize,
        ),
      )}" x="${qrLeft}" y="${Math.round(
        (bandHeight -
          qrSize) /
          2,
      )}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="xMidYMid meet"/>`,
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

async function normaliseImage(
  png: Buffer,
  size: number,
): Promise<Buffer> {
  return sharp(png)
    .resize(
      size,
      size,
      {
        fit: "inside",
        withoutEnlargement: false,
      },
    )
    .png()
    .toBuffer();
}
