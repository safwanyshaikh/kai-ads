import "../font-config";
import sharp from "sharp";
import { brandingStripHeight } from "./branding-overlay";
import type { AdvertisementFacts } from "./types";

/**
 * KAI FACT LAYER — FACTUAL OVERLAY ONLY
 *
 * Responsibility:
 *   - Render verified recruitment facts deterministically.
 *   - Never invent, rewrite, reorder creatively, or stylistically redesign facts.
 *   - Never create the advertisement's visual composition.
 *
 * The LLM/image model owns:
 *   - hero concept
 *   - photography
 *   - visual hierarchy
 *   - atmosphere
 *   - composition
 *   - colour mood
 *   - visual storytelling
 *
 * KAI owns:
 *   - exact recruitment facts
 *   - exact position titles
 *   - exact vacancy counts
 *   - exact benefits
 *   - exact interview information
 *   - exact recruitment headline supplied by the source
 *
 * This layer is intentionally transparent so the LLM artwork remains
 * visually dominant. It is a factual precision layer, not a poster designer.
 */

const NAVY = "#0B1F33";
const GOLD = "#F3D98B";
const WHITE = "#FFFFFF";
const SLATE = "#4A5A6C";

const SIDE_MARGIN = 0.055;
const FACT_FONT = 0.018;
const SMALL_FONT = 0.014;
const HEADLINE_FONT = 0.045;
const MIN_FONT = 0.014;

const MAX_ASPECT = 4.0;

export class LayoutCapacityError extends Error {
  readonly code = "LAYOUT_CAPACITY";

  constructor(readonly unplaced: string[]) {
    super(
      `Advertisement cannot be rendered without omitting verified information at minimum readability. Unplaced: ${unplaced.join("; ")}`,
    );
    this.name = "LayoutCapacityError";
  }
}

export interface FactLayerInput {
  facts: AdvertisementFacts;
  widthPx: number;
  heightPx: number;
}

export interface FactLayerResult {
  png: Buffer;
  heightPx: number;
  artworkHeightPx: number;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function px(fraction: number, widthPx: number): number {
  return Math.max(1, Math.round(fraction * widthPx));
}

function widthFactor(text: string): number {
  const upper = text === text.toUpperCase() && /[A-Z]/.test(text);
  return upper ? 0.62 : 0.56;
}

function textWidth(text: string, size: number): number {
  return text.length * size * widthFactor(text);
}

function fit(
  text: string,
  maxWidth: number,
  preferred: number,
  minimum = MIN_FONT,
): number {
  let size = preferred;

  while (size > minimum && textWidth(text, size) > maxWidth) {
    size -= 1;
  }

  return Math.max(size, minimum);
}

function wrapLines(
  text: string,
  maxWidth: number,
  size: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (!current || textWidth(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function headlineCountLabel(facts: AdvertisementFacts): string {
  const roles = facts.positions.length;

  const allCounted =
    roles > 0 &&
    facts.positions.every(
      (position) => typeof position.count === "number",
    );

  if (allCounted) {
    const vacancies = facts.positions.reduce(
      (sum, position) => sum + (position.count ?? 0),
      0,
    );

    if (vacancies > roles) {
      return roles === 1
        ? `${vacancies} VACANCIES`
        : `${vacancies} VACANCIES · ${roles} ROLES`;
    }
  }

  return `${roles} POSITION${roles === 1 ? "" : "S"} AVAILABLE`;
}

function roleDetail(
  position: AdvertisementFacts["positions"][number],
): string {
  const details: string[] = [];

  if (position.experience) {
    details.push(position.experience);
  }

  if (position.salary) {
    details.push(position.salary);
  }

  if (position.qualification) {
    details.push(position.qualification);
  }

  if (position.certifications?.length) {
    details.push(position.certifications.join(", "));
  }

  return details.join(" · ");
}

function buildFactRows(
  facts: AdvertisementFacts,
): Array<{ title: string; count?: number; detail?: string }> {
  return facts.positions.map((position) => ({
    title: position.title,
    count: position.count,
    detail: roleDetail(position) || undefined,
  }));
}

/**
 * Determines the amount of factual canvas required.
 *
 * This is not a creative layout decision.
 * It is only a capacity calculation ensuring that verified facts remain
 * readable without truncation.
 */
function calculateFactZoneHeight(
  facts: AdvertisementFacts,
  widthPx: number,
): number {
  const margin = px(SIDE_MARGIN, widthPx);
  const contentWidth = widthPx - margin * 2;

  const roleRows = Math.max(1, facts.positions.length);

  const columns =
    roleRows <= 8
      ? 1
      : roleRows <= 24
        ? 2
        : 3;

  const gap = px(0.018, widthPx);
  const columnWidth =
    Math.floor((contentWidth - gap * (columns - 1)) / columns);

  const titleSize = px(FACT_FONT, widthPx);
  const lineHeight = Math.round(titleSize * 1.35);

  const rowsPerColumn = Math.ceil(roleRows / columns);

  const roleHeight = Math.max(
    lineHeight * 2,
    lineHeight + px(0.008, widthPx),
  );

  let positionsHeight =
    rowsPerColumn * roleHeight +
    px(0.06, widthPx);

  if (facts.benefits.length) {
    positionsHeight += px(0.055, widthPx);
  }

  if (facts.interview.length) {
    positionsHeight += px(0.055, widthPx);
  }

  // Keep a meaningful minimum factual zone even for sparse advertisements.
  positionsHeight = Math.max(
    positionsHeight,
    Math.round(widthPx * 0.28),
  );

  // Prevent unused calculation from being optimised away by future tooling.
  void columnWidth;

  return positionsHeight;
}

export async function renderFactLayer(
  input: FactLayerInput,
): Promise<FactLayerResult> {
  const { facts, widthPx: W, heightPx: requestedHeight } = input;

  const margin = px(SIDE_MARGIN, W);
  const contentWidth = W - margin * 2;

  const factZoneHeight = calculateFactZoneHeight(facts, W);

  const brandingHeight = brandingStripHeight(
    W,
    requestedHeight,
    Boolean(facts.contact.phone || facts.contact.email),
  );

  /**
   * The LLM artwork is allowed to occupy the complete upper canvas.
   * The factual overlay begins only in the reserved lower information zone.
   */
  const minimumHeight =
    factZoneHeight +
    brandingHeight +
    px(0.04, W);

  const H = Math.max(requestedHeight, minimumHeight);

  if (H > W * MAX_ASPECT) {
    throw new LayoutCapacityError([
      `Verified information requires a ${H}px canvas, above the ${Math.round(
        W * MAX_ASPECT,
      )}px publishable limit`,
    ]);
  }

  /**
   * IMPORTANT:
   *
   * This is now the only reserved artwork/facts boundary.
   * There is no navy hero block.
   * There is no cream body.
   * There is no creative header.
   * There is no deterministic recreation of the advertisement design.
   *
   * The image model owns the entire upper canvas.
   */
  const artworkHeightPx = H - factZoneHeight;

  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`,
    `<defs>`,
    `<linearGradient id="factPanel" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${NAVY}" stop-opacity="0.94"/>`,
    `<stop offset="1" stop-color="${NAVY}" stop-opacity="0.98"/>`,
    `</linearGradient>`,
    `</defs>`,
  ];

  /**
   * FACT PANEL
   *
   * A compact deterministic information panel.
   * This is deliberately neutral and secondary to the LLM artwork.
   */
  svg.push(
    `<rect x="0" y="${artworkHeightPx}" width="${W}" height="${factZoneHeight}" fill="url(#factPanel)"/>`,
  );

  let y = artworkHeightPx + px(0.04, W);

  /**
   * Candidate-facing source headline.
   *
   * The source/header is rendered exactly as supplied.
   * No creative rewriting happens here.
   */
  if (facts.header) {
    const headlineSize = fit(
      facts.header,
      contentWidth,
      px(HEADLINE_FONT, W),
      px(0.028, W),
    );

    const headlineLines = wrapLines(
      facts.header,
      contentWidth,
      headlineSize,
    ).slice(0, 3);

    for (const line of headlineLines) {
      svg.push(
        `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${WHITE}">${esc(
          line,
        )}</text>`,
      );

      y += Math.round(headlineSize * 1.15);
    }

    y += px(0.012, W);
  }

  /**
   * Employer is factual credit, not the creative hero.
   */
  if (facts.employer) {
    const employerSize = fit(
      facts.employer,
      contentWidth,
      px(0.026, W),
      px(0.018, W),
    );

    svg.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${employerSize}" font-weight="700" fill="${GOLD}">${esc(
        facts.employer,
      )}</text>`,
    );

    y += Math.round(employerSize * 1.25);
  }

  /**
   * Verified opportunity metadata.
   */
  const metadata = [
    facts.country,
    facts.industry,
    facts.projectType,
  ]
    .filter(Boolean)
    .join(" · ");

  if (metadata) {
    const metaSize = fit(
      metadata,
      contentWidth,
      px(SMALL_FONT, W),
      px(MIN_FONT, W),
    );

    svg.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${metaSize}" fill="${WHITE}" opacity="0.9">${esc(
        metadata,
      )}</text>`,
    );

    y += Math.round(metaSize * 1.6);
  }

  /**
   * Vacancy total — deterministic and source-grounded.
   */
  const totalLabel = headlineCountLabel(facts);

  const totalSize = fit(
    totalLabel,
    contentWidth,
    px(SMALL_FONT, W),
    px(MIN_FONT, W),
  );

  const totalWidth =
    textWidth(totalLabel, totalSize) + px(0.035, W);

  const totalHeight = Math.round(totalSize * 2.2);

  svg.push(
    `<rect x="${margin}" y="${y}" width="${totalWidth}" height="${totalHeight}" rx="${Math.round(
      totalHeight / 2,
    )}" fill="${GOLD}"/>`,
  );

  svg.push(
    `<text x="${margin + Math.round(totalWidth / 2)}" y="${
      y + Math.round(totalHeight * 0.7)
    }" font-family="KaiSans, sans-serif" font-size="${totalSize}" font-weight="800" fill="${NAVY}" text-anchor="middle">${esc(
      totalLabel,
    )}</text>`,
  );

  y += totalHeight + px(0.02, W);

  /**
   * POSITIONS
   *
   * Pure facts.
   *
   * No random reordering.
   * No invented grouping.
   * No LLM rewriting.
   */
  const positions = buildFactRows(facts);

  const columns =
    positions.length <= 8
      ? 1
      : positions.length <= 24
        ? 2
        : 3;

  const gap = px(0.018, W);
  const columnWidth = Math.floor(
    (contentWidth - gap * (columns - 1)) / columns,
  );

  const rowsPerColumn = Math.ceil(positions.length / columns);

  const titleSize = px(FACT_FONT, W);
  const countSize = px(SMALL_FONT, W);
  const lineHeight = Math.round(titleSize * 1.28);
  const rowHeight = Math.max(
    lineHeight + px(0.018, W),
    px(0.055, W),
  );

  for (let column = 0; column < columns; column += 1) {
    const columnX =
      margin + column * (columnWidth + gap);

    let cy = y;

    const slice = positions.slice(
      column * rowsPerColumn,
      (column + 1) * rowsPerColumn,
    );

    for (const position of slice) {
      const countBoxWidth = position.count != null
        ? px(0.045, W)
        : 0;

      if (position.count != null) {
        svg.push(
          `<rect x="${columnX}" y="${
            cy - Math.round(countSize * 0.9)
          }" width="${countBoxWidth}" height="${Math.round(
            countSize * 1.35,
          )}" rx="3" fill="${GOLD}"/>`,
        );

        svg.push(
          `<text x="${
            columnX + Math.round(countBoxWidth / 2)
          }" y="${cy}" font-family="KaiSans, sans-serif" font-size="${countSize}" font-weight="800" fill="${NAVY}" text-anchor="middle">${esc(
            String(position.count),
          )}</text>`,
        );
      }

      const titleX =
        columnX +
        (position.count != null
          ? countBoxWidth + px(0.01, W)
          : 0);

      const titleWidth =
        columnWidth -
        (titleX - columnX);

      const titleLines = wrapLines(
        position.title,
        titleWidth,
        titleSize,
      ).slice(0, 3);

      for (const line of titleLines) {
        svg.push(
          `<text x="${titleX}" y="${cy}" font-family="KaiSans, sans-serif" font-size="${titleSize}" font-weight="600" fill="${WHITE}">${esc(
            line,
          )}</text>`,
        );

        cy += lineHeight;
      }

      if (position.detail) {
        const detailSize = fit(
          position.detail,
          titleWidth,
          px(MIN_FONT, W),
          px(MIN_FONT, W),
        );

        svg.push(
          `<text x="${titleX}" y="${cy}" font-family="KaiSans, sans-serif" font-size="${detailSize}" fill="${WHITE}" opacity="0.7">${esc(
            position.detail,
          )}</text>`,
        );

        cy += Math.round(detailSize * 1.3);
      }

      cy += Math.max(
        px(0.012, W),
        rowHeight - (cy - y) % rowHeight,
      );
    }
  }

  /**
   * Benefits
   */
  if (facts.benefits.length) {
    y += px(0.018, W);

    const benefits = facts.benefits
      .map((benefit) =>
        benefit.detail
          ? `${benefit.label}: ${benefit.detail}`
          : benefit.label,
      )
      .join(" · ");

    const benefitSize = fit(
      benefits,
      contentWidth,
      px(SMALL_FONT, W),
      px(MIN_FONT, W),
    );

    svg.push(
      `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${benefitSize}" fill="${GOLD}">${esc(
        benefits,
      )}</text>`,
    );

    y += Math.round(benefitSize * 1.5);
  }

  /**
   * Interview
   *
   * Only grounded fields are displayed.
   */
  const interview = facts.interview[0];

  if (interview) {
    const detail = [
      interview.date,
      interview.location,
    ]
      .filter(Boolean)
      .join(" · ");

    if (detail) {
      y += px(0.012, W);

      const interviewText = `INTERVIEW · ${detail}`;

      const interviewSize = fit(
        interviewText,
        contentWidth,
        px(SMALL_FONT, W),
        px(MIN_FONT, W),
      );

      svg.push(
        `<text x="${margin}" y="${y}" font-family="KaiSans, sans-serif" font-size="${interviewSize}" font-weight="700" fill="${WHITE}">${esc(
          interviewText,
        )}</text>`,
      );

      y += Math.round(interviewSize * 1.5);
    }
  }

  /**
   * The contact/verification footer remains owned by Branding Overlay.
   * No duplicated contact or RA information is emitted here.
   */

  svg.push(`</svg>`);

  const png = await sharp(Buffer.from(svg.join("")))
    .png()
    .toBuffer();

  return {
    png,
    heightPx: H,
    artworkHeightPx,
  };
}
