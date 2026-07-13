import type { PlatformFormat } from "@/lib/platform-formats";
import type { BadgeConfig } from "./badge-selection.service";
import { buildFallbackBackgroundSvgFragment } from "./fallback-background";
import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY, KAI_SERIF_FONT_FAMILY } from "./embedded-fonts";
import type { InterviewEvent } from "./interview-events";

/**
 * Every fixed pixel constant below (padding, logo/badge size, line
 * spacing, font sizes) was tuned against this reference canvas. FIX-010:
 * two separate scale factors are derived from it — see `layoutScale` and
 * `fontScale` below — so the template holds its proportions across every
 * platform format instead of clustering all content in a small top-left
 * corner (and leaving the badge, which already anchors to
 * widthPx/heightPx directly, stranded far below it) on tall formats like
 * WhatsApp Status / Instagram Story.
 */
const BASELINE_WIDTH_PX = 1080;
const BASELINE_HEIGHT_PX = 1350;

/** Decision 4: any format meaningfully wider than it is tall gets the dedicated two-column landscape composition below, not a re-scaled portrait template with unused horizontal space. */
const LANDSCAPE_ASPECT_THRESHOLD = 1.3;

interface RenderablePosition {
  title: string;
  count?: number;
  experience?: string;
}

interface SectionRenderInput {
  platformFormat: PlatformFormat;
  header: string;
  industry: string;
  country: string;
  employer?: string | null;
  positions: RenderablePosition[];
  benefits: { label: string; detail?: string }[];
  /** Decision 3: one or more interview events — see server/generation/interview-events.ts. */
  interview: InterviewEvent[];
  contact: { name?: string; phone?: string; email?: string; whatsapp?: string };
  footer?: string | null;
  agencyName: string;
  raLicenseId?: string | null;
  qrDataUri: string; // "data:image/png;base64,..."
  badge: BadgeConfig;
  style: "TYPOGRAPHY" | "NEWSPAPER" | "VISUAL";
  /**
   * AI-generated decorative background (Visual style only, Sprint 005).
   * Per ADR-006 and the Sprint 005 "Critical Scope": this is a full-canvas
   * decorative layer only — every piece of factual text is still composed
   * as real SVG text nodes on top of it, never baked into the image
   * itself. A semi-transparent panel sits between the background and the
   * text for contrast/readability, which is standard poster design, not
   * a workaround for the image model rendering text.
   */
  backgroundImageDataUri?: string | null;
  agencyLogoDataUri?: string | null;
  /** From the recruiter's theme selection (theme-recommendation.service.ts) — the one property theme controls in this renderer. */
  accentColor?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * FIX-012: a single-line, non-wrapping <text> element clips silently
 * off-canvas once the string is long enough relative to its font size —
 * found by rendering this real, longer-than-the-original-test-fixtures
 * header ("Hiring for Bilfinger Shutdown Project, Saudi Arabia") and the
 * full official RC number format inside the compact badge. Shrinks the
 * font size (down to a floor, never below legibility) until the string's
 * estimated rendered width fits the available space, using an average
 * glyph-width ratio since no real text-measurement API is available in
 * this server-side rasterization path (no DOM/canvas metrics). This is
 * an approximation, not exact per-glyph measurement — deliberately
 * conservative (slightly overestimates width) so it shrinks a little
 * early rather than risk still clipping.
 */
function fitFontSize(text: string, maxWidthPx: number, startFontSizePx: number, minFontSizePx: number): number {
  const AVG_GLYPH_WIDTH_RATIO = 0.62; // conservative for a bold sans/serif at this font stack
  const estimatedWidth = text.length * startFontSizePx * AVG_GLYPH_WIDTH_RATIO;
  if (estimatedWidth <= maxWidthPx || maxWidthPx <= 0) return startFontSizePx;
  const fitted = Math.floor(maxWidthPx / (text.length * AVG_GLYPH_WIDTH_RATIO));
  return Math.max(minFontSizePx, Math.min(startFontSizePx, fitted));
}

/**
 * Decision 3: one line per interview event — "City — Date" — never a
 * single string concatenating multiple unrelated cities/dates. Falls
 * back to whichever of date/location is present if only one is given.
 */
function formatInterviewLine(event: InterviewEvent): string {
  return [event.location, event.date].filter(Boolean).join(" — ");
}

const BADGE_SIZE_PX: Record<BadgeConfig["size"], number> = {
  compact: 96,
  standard: 128,
  large: 160,
};

/**
 * Renders all three advertisement styles as real SVG — Typography and
 * Newspaper/DTP need no AI call at all; Visual layers an optional
 * AI-generated background image underneath the same deterministic text
 * composition every style uses. Per ADR-006, exact recruitment text
 * (positions, salary, contact, RA number) is always composed here as
 * real text nodes, never delegated to an image model, in every style.
 *
 * Template-based rather than free-form layout: Newspaper gets a column
 * rule and boxed look (the DTP "USP"), Typography gets a single clean
 * column, Visual gets a full-bleed background with a readability panel
 * behind the text block. Section-based editing works because each block
 * is rendered independently from the advertisement's own named sections.
 *
 * Decision 4: landscape formats (aspect ratio meaningfully wider than
 * tall) use renderLandscapeComposition() instead — a re-scaled version
 * of this single-column template left ~45% of a 1600x900 canvas
 * permanently blank, since every constant scales with height/width but
 * the template itself is a single narrow column regardless of how wide
 * the canvas actually is.
 */
export function renderSectionComposition(input: SectionRenderInput): string {
  const fmt = input.platformFormat;
  if (fmt.widthPx / fmt.heightPx >= LANDSCAPE_ASPECT_THRESHOLD) {
    return renderLandscapeComposition(input);
  }

  const isNewspaper = input.style === "NEWSPAPER";
  const isVisual = input.style === "VISUAL";

  // FIX-010: layoutScale (spacing, padding, logo/badge size) is driven by
  // height, so tall formats get generously spread-out content instead of
  // a cluster near the top with the badge stranded far below. fontScale
  // is capped by width too — a single <text> line is never wrapped, so
  // letting font size grow with height alone on a tall-but-not-wide
  // format (e.g. WhatsApp Status, 1080x1920 — same 1080px width as every
  // square format) clipped the header off the right edge of the canvas.
  const layoutScale = fmt.heightPx / BASELINE_HEIGHT_PX;
  const fontScale = Math.min(layoutScale, fmt.widthPx / BASELINE_WIDTH_PX);
  const px = (baseline: number) => Math.round(baseline * layoutScale);
  const fpx = (baseline: number) => Math.round(baseline * fontScale);

  const padding = px(48);

  const positionLines = input.positions
    .map((p) => {
      const count = p.count ? ` (${p.count})` : "";
      const exp = p.experience ? ` — ${p.experience}` : "";
      return `${p.title}${count}${exp}`;
    })
    .map(escapeXml);

  const benefitLines = input.benefits.map((b) =>
    escapeXml(b.detail ? `${b.label} — ${b.detail}` : b.label),
  );

  const contactLine = [input.contact.name, input.contact.phone, input.contact.whatsapp, input.contact.email]
    .filter(Boolean)
    .join("  ·  ");

  const badgeSize = px(BADGE_SIZE_PX[input.badge.size]);
  const badgeX = fmt.widthPx - padding - badgeSize;
  const badgeY = fmt.heightPx - padding - badgeSize;
  const badgeRx =
    input.badge.shape === "circular" ? badgeSize / 2 : input.badge.shape === "rounded_square" ? px(16) : px(8);

  // FIX-009: embedded, self-contained fonts — see embedded-fonts.ts for
  // why these can no longer be system font-family names.
  const fontFamily = isNewspaper ? KAI_SERIF_FONT_FAMILY : KAI_SANS_FONT_FAMILY;
  const accentColor = input.accentColor ?? "#1a1a1a";
  const rule = isNewspaper
    ? `<line x1="${padding}" y1="${px(180)}" x2="${fmt.widthPx - padding}" y2="${px(180)}" stroke="${accentColor}" stroke-width="2" />`
    : "";

  // Visual: text sits on a dark, semi-transparent panel over the bottom
  // ~55% of the canvas so it stays readable over any photo. Header still
  // reads at the top against a lighter scrim strip.
  const textColor = isVisual ? "#ffffff" : "#111111";
  const secondaryTextColor = isVisual ? "#e5e5e5" : "#444444";
  const panelTop = fmt.heightPx * 0.42;

  const background = input.backgroundImageDataUri
    ? `<image x="0" y="0" width="${fmt.widthPx}" height="${fmt.heightPx}" href="${input.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${fmt.widthPx}" height="${px(140)}" fill="#000000" fill-opacity="0.35" />
  <rect x="0" y="${panelTop}" width="${fmt.widthPx}" height="${fmt.heightPx - panelTop}" fill="#000000" fill-opacity="0.55" />`
    : isVisual
      ? buildFallbackBackgroundSvgFragment({ widthPx: fmt.widthPx, heightPx: fmt.heightPx, industry: input.industry })
      : `<rect width="${fmt.widthPx}" height="${fmt.heightPx}" fill="#ffffff" />`;

  // Design grammar (reference R&D, Sprint 006): the Typography/"Structured
  // Professional" style is the one archetype whose reference ads (e.g.
  // the Qatar and UAE construction ads reviewed) consistently open with a
  // solid colored banner strip announcing role/country, rather than
  // black-on-white text — Visual already gets an equivalent effect from
  // its own photo scrim above, and Newspaper's dense DTP grammar is
  // deliberately plain black-on-white with a rule, so the banner is
  // scoped to Typography only rather than applied blindly to all three.
  const isTypography = !isNewspaper && !isVisual;
  const headerBannerHeight = px(150);
  const headerBanner = isTypography
    ? `<rect x="0" y="0" width="${fmt.widthPx}" height="${headerBannerHeight}" fill="${accentColor}" />`
    : "";
  const headerTextColor = isTypography ? "#ffffff" : textColor;
  const headerSecondaryColor = isTypography ? "#f0f0f0" : secondaryTextColor;
  const logoBackdrop =
    isTypography && input.agencyLogoDataUri
      ? `<rect x="${padding - px(8)}" y="${px(48 - 20) - px(8)}" width="${px(64) + px(16)}" height="${px(64) + px(16)}" rx="${px(8)}" fill="#ffffff" />`
      : "";

  // Design grammar (reference R&D, Sprint 006): every real recruitment
  // advertisement reviewed uses a bullet/check marker per line item, never
  // a plain unmarked list — "•" is a safe embedded-font glyph (verified
  // separately; unlike a Unicode checkmark, it's guaranteed present in
  // Liberation Sans). checkmarkIcon() below draws benefits' check as a
  // real vector path instead, so it never depends on font glyph coverage.
  const positionsBlock = positionLines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${px(260 + i * 34)}" font-family="${fontFamily}" font-size="${fpx(22)}" fill="${isVisual ? "#ffffff" : "#222222"}">• ${line}</text>`,
    )
    .join("\n  ");

  function checkmarkIcon(x: number, y: number, size: number, color: string): string {
    const s = size / 10;
    return `<path d="M ${x} ${y - 3 * s} L ${x + 3 * s} ${y} L ${x + 8 * s} ${y - 6 * s}" stroke="${color}" stroke-width="${Math.max(1.5, s)}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  // FIX-011: the "Benefits" header and its first line previously landed
  // at the identical y-coordinate for any number of positions
  // (260 + n*34 + 40 === 300 + n*34 + 0, always, for every n) — the
  // header text and first benefit line rendered on top of each other,
  // garbling both. Benefit lines are now spaced a fixed gap below
  // wherever the header actually landed, instead of from an
  // independently-computed baseline that happened to coincide with it.
  const benefitsHeaderBaseline = 260 + positionLines.length * 34 + 40;
  const benefitIconSize = fpx(16);
  const benefitsBlock =
    benefitLines.length > 0
      ? `<text x="${padding}" y="${px(benefitsHeaderBaseline)}" font-family="${fontFamily}" font-size="${fpx(24)}" font-weight="700" fill="${textColor}">Benefits</text>
  ${benefitLines
    .map(
      (line, i) =>
        `${checkmarkIcon(padding, px(benefitsHeaderBaseline + 36 + i * 30) - benefitIconSize * 0.6, benefitIconSize, secondaryTextColor)}
  <text x="${padding + benefitIconSize + px(6)}" y="${px(benefitsHeaderBaseline + 36 + i * 30)}" font-family="${fontFamily}" font-size="${fpx(20)}" fill="${secondaryTextColor}">${line}</text>`,
    )
    .join("\n  ")}`
      : "";

  // Decision 3 + reference R&D (Sprint 006): a single interview event
  // keeps the original one-line "Interview: ..." format anchored at a
  // fixed distance from the bottom. Two or more events — the common
  // multi-city case (e.g. the real Baroda + Mumbai Bilfinger posting) —
  // render as side-by-side bordered boxes, matching every multi-city
  // reference advertisement reviewed (never a stacked bullet list): a
  // bold "Interview" header above a row of boxes, wrapping to further
  // rows past 2 events. Anchored so the box grid's bottom edge lands
  // where the single-line case's baseline would have, so contact/footer
  // below are never displaced.
  const interviewEvents = input.interview;
  const interviewBlockBottomY = fmt.heightPx - px(220);
  const interviewBlock =
    interviewEvents.length === 0
      ? ""
      : interviewEvents.length === 1
        ? `<text x="${padding}" y="${interviewBlockBottomY}" font-family="${fontFamily}" font-size="${fpx(20)}" fill="${secondaryTextColor}">Interview: ${escapeXml(formatInterviewLine(interviewEvents[0]))}</text>`
        : (() => {
            const columns = Math.min(interviewEvents.length, 2);
            const rows = Math.ceil(interviewEvents.length / columns);
            const gap = px(16);
            const boxHeight = px(64);
            const availableWidth = fmt.widthPx - padding * 2;
            const boxWidth = (availableWidth - gap * (columns - 1)) / columns;
            const totalBoxesHeight = rows * boxHeight + (rows - 1) * gap;
            const headerY = interviewBlockBottomY - totalBoxesHeight - px(24);
            const boxesTopY = headerY + px(16);
            const boxFill = isVisual ? "rgba(255,255,255,0.10)" : "#f5f5f5";
            const boxStroke = isVisual ? "#ffffff" : accentColor;
            const boxes = interviewEvents
              .map((event, i) => {
                const col = i % columns;
                const row = Math.floor(i / columns);
                const boxX = padding + col * (boxWidth + gap);
                const boxY = boxesTopY + row * (boxHeight + gap);
                const centerX = boxX + boxWidth / 2;
                return `<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${px(8)}" fill="${boxFill}" stroke="${boxStroke}" stroke-width="1.5" />
  <text x="${centerX}" y="${boxY + boxHeight / 2 + fpx(6)}" text-anchor="middle" font-family="${fontFamily}" font-size="${fitFontSize(formatInterviewLine(event), boxWidth - px(12), fpx(17), fpx(11))}" font-weight="600" fill="${textColor}">${escapeXml(formatInterviewLine(event))}</text>`;
              })
              .join("\n  ");
            return `<text x="${padding}" y="${headerY}" font-family="${fontFamily}" font-size="${fpx(20)}" font-weight="700" fill="${textColor}">Interview</text>
  ${boxes}`;
          })();

  const contactBlock = contactLine
    ? `<text x="${padding}" y="${fmt.heightPx - px(180)}" font-family="${fontFamily}" font-size="${fpx(20)}" font-weight="600" fill="${textColor}">${escapeXml(contactLine)}</text>`
    : "";

  // FIX-012: raLicenseId can be a short compact code ("9986") or a much
  // longer full official registration string
  // ("RC-B1487/MUM/PART/1000+/9986/2022") — the badge is a small, fixed
  // box (a "constrained visual area"), so its font size is fitted to
  // that box's actual width rather than assuming a short code.
  const raText = input.raLicenseId ? `RA ${input.raLicenseId}` : "";
  const raFontSize = raText ? fitFontSize(raText, badgeSize - px(16), fpx(8), fpx(5)) : fpx(8);
  const raBlock = input.raLicenseId
    ? `<text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - px(8)}" font-family="${fontFamily}" font-size="${raFontSize}" text-anchor="middle" fill="#333333">${escapeXml(raText)}</text>`
    : "";

  const logoSize = px(64);
  const logoBlock = input.agencyLogoDataUri
    ? `<image x="${padding}" y="${px(48 - 20)}" width="${logoSize}" height="${logoSize}" href="${input.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`
    : "";

  const headerX = input.agencyLogoDataUri ? px(48 + 80) : padding;
  // FIX-012: a long, realistic header ("Hiring for Bilfinger Shutdown
  // Project, Saudi Arabia") clipped off the right edge of the canvas at
  // the fixed baseline font size — fitted the same way as the RA badge
  // text above, against the actual available width right of the header.
  const headerBaseFontSize = isNewspaper ? fpx(40) : fpx(52);
  const headerAvailableWidth = fmt.widthPx - headerX - padding;
  const headerFontSize = fitFontSize(input.header, headerAvailableWidth, headerBaseFontSize, fpx(28));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt.widthPx}" height="${fmt.heightPx}" viewBox="0 0 ${fmt.widthPx} ${fmt.heightPx}">
  ${buildEmbeddedFontStyleBlock()}
  ${background}
  ${headerBanner}
  ${logoBackdrop}
  ${logoBlock}
  <text x="${headerX}" y="${px(90)}" font-family="${fontFamily}" font-size="${headerFontSize}" font-weight="700" fill="${headerTextColor}">${escapeXml(input.header)}</text>
  <text x="${headerX}" y="${px(130)}" font-family="${fontFamily}" font-size="${fpx(24)}" fill="${headerSecondaryColor}">${escapeXml(input.industry)} · ${escapeXml(input.country)}${input.employer ? " · " + escapeXml(input.employer) : ""}</text>
  ${rule}
  <text x="${padding}" y="${px(220)}" font-family="${fontFamily}" font-size="${fpx(28)}" font-weight="700" fill="${accentColor === "#1a1a1a" ? textColor : accentColor}">Positions</text>
  ${positionsBlock}
  ${benefitsBlock}
  ${interviewBlock}
  ${contactBlock}
  <text x="${padding}" y="${fmt.heightPx - padding}" font-family="${fontFamily}" font-size="${fpx(16)}" fill="${secondaryTextColor}">${escapeXml(input.agencyName)}${input.footer ? " · " + escapeXml(input.footer) : ""}</text>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRx}" fill="#ffffff" stroke="${accentColor}" stroke-width="2" />
  <image x="${badgeX + px(8)}" y="${badgeY + px(8)}" width="${badgeSize - px(16)}" height="${badgeSize - px(40)}" href="${input.qrDataUri}" />
  <text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - px(20)}" font-family="${fontFamily}" font-size="${fpx(9)}" text-anchor="middle" fill="#111111">MEA REGISTERED</text>
  ${raBlock}
  <text x="${badgeX + badgeSize / 2}" y="${badgeY - px(8)}" font-family="${fontFamily}" font-size="${fpx(12)}" text-anchor="middle" fill="${textColor}">VERIFY AGENCY</text>
</svg>`;
}

/**
 * Decision 4: a dedicated two-column composition for landscape formats
 * (currently generic_landscape, 1600x900 — but written generically off
 * the aspect ratio, not a hardcoded format key, per platform-formats.ts's
 * "support future platforms without rewriting the generation engine").
 * Left column carries identity/title (logo, header, industry/country/
 * employer, agency name + RC). Right column carries the requirement
 * detail (positions, benefits, interview events, contact) — the content
 * that actually varies in length and benefits from the extra vertical
 * room a wide-but-short canvas gives it. The trust badge stays anchored
 * to the canvas's true bottom-right corner, as in every other format.
 */
function renderLandscapeComposition(input: SectionRenderInput): string {
  const fmt = input.platformFormat;
  const isNewspaper = input.style === "NEWSPAPER";
  const isVisual = input.style === "VISUAL";

  const layoutScale = fmt.heightPx / BASELINE_HEIGHT_PX;
  const fontScale = Math.min(layoutScale, fmt.widthPx / (BASELINE_WIDTH_PX * 1.4));
  const px = (baseline: number) => Math.round(baseline * layoutScale);
  const fpx = (baseline: number) => Math.round(baseline * fontScale);

  const padding = px(48);
  const leftColumnWidth = Math.round(fmt.widthPx * 0.4);
  const rightColumnX = leftColumnWidth + padding;
  const rightColumnWidth = fmt.widthPx - rightColumnX - padding;

  const fontFamily = isNewspaper ? KAI_SERIF_FONT_FAMILY : KAI_SANS_FONT_FAMILY;
  const accentColor = input.accentColor ?? "#1a1a1a";
  const textColor = isVisual ? "#ffffff" : "#111111";
  const secondaryTextColor = isVisual ? "#e5e5e5" : "#444444";

  const background = input.backgroundImageDataUri
    ? `<image x="0" y="0" width="${fmt.widthPx}" height="${fmt.heightPx}" href="${input.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${fmt.widthPx}" height="${fmt.heightPx}" fill="#000000" fill-opacity="0.45" />`
    : isVisual
      ? buildFallbackBackgroundSvgFragment({ widthPx: fmt.widthPx, heightPx: fmt.heightPx, industry: input.industry })
      : `<rect width="${fmt.widthPx}" height="${fmt.heightPx}" fill="#ffffff" />`;

  const divider = `<line x1="${leftColumnWidth}" y1="${padding}" x2="${leftColumnWidth}" y2="${fmt.heightPx - padding}" stroke="${isVisual ? "#ffffff" : accentColor}" stroke-opacity="${isVisual ? 0.4 : 1}" stroke-width="2" />`;

  // --- Left column: identity/title ---
  const logoSize = px(56);
  const logoBlock = input.agencyLogoDataUri
    ? `<image x="${padding}" y="${padding}" width="${logoSize}" height="${logoSize}" href="${input.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`
    : "";
  const headerY = input.agencyLogoDataUri ? padding + logoSize + fpx(44) : padding + fpx(44);
  const headerAvailableWidth = leftColumnWidth - padding * 2;
  const headerFontSize = fitFontSize(input.header, headerAvailableWidth, fpx(36), fpx(20));

  const leftColumn = `
  ${logoBlock}
  <text x="${padding}" y="${headerY}" font-family="${fontFamily}" font-size="${headerFontSize}" font-weight="700" fill="${textColor}">${escapeXml(input.header)}</text>
  <text x="${padding}" y="${headerY + fpx(34)}" font-family="${fontFamily}" font-size="${fpx(20)}" fill="${secondaryTextColor}">${escapeXml(input.industry)} · ${escapeXml(input.country)}</text>
  ${input.employer ? `<text x="${padding}" y="${headerY + fpx(64)}" font-family="${fontFamily}" font-size="${fpx(20)}" fill="${secondaryTextColor}">${escapeXml(input.employer)}</text>` : ""}
  <text x="${padding}" y="${fmt.heightPx - padding}" font-family="${fontFamily}" font-size="${fpx(15)}" fill="${secondaryTextColor}">${escapeXml(input.agencyName)}${input.footer ? " · " + escapeXml(input.footer) : ""}</text>`;

  // --- Right column: requirement detail, stacked with a running cursor ---
  let cursorY = padding + fpx(28);
  const rightLines: string[] = [];

  const pushLine = (text: string, fontSize: number, fill: string, weight?: string, gapAfter = 26) => {
    rightLines.push(
      `<text x="${rightColumnX}" y="${cursorY}" font-family="${fontFamily}" font-size="${fontSize}"${weight ? ` font-weight="${weight}"` : ""} fill="${fill}">${text}</text>`,
    );
    cursorY += px(gapAfter);
  };

  if (input.positions.length > 0) {
    pushLine("Positions", fpx(24), accentColor === "#1a1a1a" ? textColor : accentColor, "700", 34);
    for (const p of input.positions) {
      const count = p.count ? ` (${p.count})` : "";
      const exp = p.experience ? ` — ${p.experience}` : "";
      const fontSize = fitFontSize(`${p.title}${count}${exp}`, rightColumnWidth, fpx(18), fpx(13));
      pushLine(escapeXml(`${p.title}${count}${exp}`), fontSize, isVisual ? "#ffffff" : "#222222", undefined, 28);
    }
    cursorY += px(10);
  }

  if (input.benefits.length > 0) {
    pushLine("Benefits", fpx(20), textColor, "700", 30);
    for (const b of input.benefits) {
      const line = b.detail ? `${b.label} — ${b.detail}` : b.label;
      pushLine(escapeXml(line), fpx(16), secondaryTextColor, undefined, 26);
    }
    cursorY += px(10);
  }

  if (input.interview.length > 0) {
    pushLine(input.interview.length > 1 ? "Interview" : "Interview:", fpx(18), textColor, "700", 28);
    for (const event of input.interview) {
      pushLine(escapeXml(formatInterviewLine(event)), fpx(16), secondaryTextColor, undefined, 26);
    }
    cursorY += px(6);
  }

  const contactLine = [input.contact.name, input.contact.phone, input.contact.whatsapp, input.contact.email]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    pushLine(escapeXml(contactLine), fpx(18), textColor, "600", 0);
  }

  // --- Badge: same bottom-right anchor used in every other format ---
  const badgeSize = px(BADGE_SIZE_PX[input.badge.size]);
  const badgeX = fmt.widthPx - padding - badgeSize;
  const badgeY = fmt.heightPx - padding - badgeSize;
  const badgeRx =
    input.badge.shape === "circular" ? badgeSize / 2 : input.badge.shape === "rounded_square" ? px(16) : px(8);
  const raText = input.raLicenseId ? `RA ${input.raLicenseId}` : "";
  const raFontSize = raText ? fitFontSize(raText, badgeSize - px(16), fpx(8), fpx(5)) : fpx(8);
  const raBlock = input.raLicenseId
    ? `<text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - px(8)}" font-family="${fontFamily}" font-size="${raFontSize}" text-anchor="middle" fill="#333333">${escapeXml(raText)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt.widthPx}" height="${fmt.heightPx}" viewBox="0 0 ${fmt.widthPx} ${fmt.heightPx}">
  ${buildEmbeddedFontStyleBlock()}
  ${background}
  ${divider}
  ${leftColumn}
  ${rightLines.join("\n  ")}
  <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRx}" fill="#ffffff" stroke="${accentColor}" stroke-width="2" />
  <image x="${badgeX + px(8)}" y="${badgeY + px(8)}" width="${badgeSize - px(16)}" height="${badgeSize - px(40)}" href="${input.qrDataUri}" />
  <text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - px(20)}" font-family="${fontFamily}" font-size="${fpx(9)}" text-anchor="middle" fill="#111111">MEA REGISTERED</text>
  ${raBlock}
  <text x="${badgeX + badgeSize / 2}" y="${badgeY - px(8)}" font-family="${fontFamily}" font-size="${fpx(12)}" text-anchor="middle" fill="${textColor}">VERIFY AGENCY</text>
</svg>`;
}
