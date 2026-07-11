import type { PlatformFormat } from "@/lib/platform-formats";
import type { BadgeConfig } from "./badge-selection.service";
import { buildFallbackBackgroundSvgFragment } from "./fallback-background";

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
  interview: { date?: string; location?: string };
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
 */
export function renderSectionComposition(input: SectionRenderInput): string {
  const fmt = input.platformFormat;
  const isNewspaper = input.style === "NEWSPAPER";
  const isVisual = input.style === "VISUAL";
  const padding = 48;

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

  const badgeSize = BADGE_SIZE_PX[input.badge.size];
  const badgeX = fmt.widthPx - padding - badgeSize;
  const badgeY = fmt.heightPx - padding - badgeSize;
  const badgeRx =
    input.badge.shape === "circular" ? badgeSize / 2 : input.badge.shape === "rounded_square" ? 16 : 8;

  const fontFamily = isNewspaper ? "Georgia, 'Times New Roman', serif" : "Arial, Helvetica, sans-serif";
  const accentColor = input.accentColor ?? "#1a1a1a";
  const rule = isNewspaper
    ? `<line x1="${padding}" y1="180" x2="${fmt.widthPx - padding}" y2="180" stroke="${accentColor}" stroke-width="2" />`
    : "";

  // Visual: text sits on a dark, semi-transparent panel over the bottom
  // ~55% of the canvas so it stays readable over any photo. Header still
  // reads at the top against a lighter scrim strip.
  const textColor = isVisual ? "#ffffff" : "#111111";
  const secondaryTextColor = isVisual ? "#e5e5e5" : "#444444";
  const panelTop = fmt.heightPx * 0.42;

  const background = input.backgroundImageDataUri
    ? `<image x="0" y="0" width="${fmt.widthPx}" height="${fmt.heightPx}" href="${input.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${fmt.widthPx}" height="140" fill="#000000" fill-opacity="0.35" />
  <rect x="0" y="${panelTop}" width="${fmt.widthPx}" height="${fmt.heightPx - panelTop}" fill="#000000" fill-opacity="0.55" />`
    : isVisual
      ? buildFallbackBackgroundSvgFragment({ widthPx: fmt.widthPx, heightPx: fmt.heightPx, industry: input.industry })
      : `<rect width="${fmt.widthPx}" height="${fmt.heightPx}" fill="#ffffff" />`;

  const positionsBlock = positionLines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${260 + i * 34}" font-family="${fontFamily}" font-size="22" fill="${isVisual ? "#ffffff" : "#222222"}">${line}</text>`,
    )
    .join("\n  ");

  const benefitsBlock =
    benefitLines.length > 0
      ? `<text x="${padding}" y="${260 + positionLines.length * 34 + 40}" font-family="${fontFamily}" font-size="24" font-weight="700" fill="${textColor}">Benefits</text>
  ${benefitLines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${300 + positionLines.length * 34 + i * 30}" font-family="${fontFamily}" font-size="20" fill="${secondaryTextColor}">${line}</text>`,
    )
    .join("\n  ")}`
      : "";

  const interviewBlock =
    input.interview.date || input.interview.location
      ? `<text x="${padding}" y="${fmt.heightPx - 220}" font-family="${fontFamily}" font-size="20" fill="${secondaryTextColor}">Interview: ${escapeXml([input.interview.date, input.interview.location].filter(Boolean).join(", "))}</text>`
      : "";

  const contactBlock = contactLine
    ? `<text x="${padding}" y="${fmt.heightPx - 180}" font-family="${fontFamily}" font-size="20" font-weight="600" fill="${textColor}">${escapeXml(contactLine)}</text>`
    : "";

  const raBlock = input.raLicenseId
    ? `<text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - 8}" font-family="${fontFamily}" font-size="8" text-anchor="middle" fill="#333333">RA ${escapeXml(input.raLicenseId)}</text>`
    : "";

  const logoBlock = input.agencyLogoDataUri
    ? `<image x="${padding}" y="${padding - 20}" width="64" height="64" href="${input.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`
    : "";

  const headerX = input.agencyLogoDataUri ? padding + 80 : padding;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt.widthPx}" height="${fmt.heightPx}" viewBox="0 0 ${fmt.widthPx} ${fmt.heightPx}">
  ${background}
  ${logoBlock}
  <text x="${headerX}" y="90" font-family="${fontFamily}" font-size="${isNewspaper ? 40 : 52}" font-weight="700" fill="${textColor}">${escapeXml(input.header)}</text>
  <text x="${headerX}" y="130" font-family="${fontFamily}" font-size="24" fill="${secondaryTextColor}">${escapeXml(input.industry)} \u00b7 ${escapeXml(input.country)}${input.employer ? " \u00b7 " + escapeXml(input.employer) : ""}</text>
  ${rule}
  <text x="${padding}" y="220" font-family="${fontFamily}" font-size="28" font-weight="700" fill="${accentColor === "#1a1a1a" ? textColor : accentColor}">Positions</text>
  ${positionsBlock}
  ${benefitsBlock}
  ${interviewBlock}
  ${contactBlock}
  <text x="${padding}" y="${fmt.heightPx - padding}" font-family="${fontFamily}" font-size="16" fill="${secondaryTextColor}">${escapeXml(input.agencyName)}${input.footer ? " \u00b7 " + escapeXml(input.footer) : ""}</text>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRx}" fill="#ffffff" stroke="${accentColor}" stroke-width="2" />
  <image x="${badgeX + 8}" y="${badgeY + 8}" width="${badgeSize - 16}" height="${badgeSize - 40}" href="${input.qrDataUri}" />
  <text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - 20}" font-family="${fontFamily}" font-size="9" text-anchor="middle" fill="#111111">MEA REGISTERED</text>
  ${raBlock}
  <text x="${badgeX + badgeSize / 2}" y="${badgeY - 8}" font-family="${fontFamily}" font-size="12" text-anchor="middle" fill="#333333">VERIFY AGENCY</text>
</svg>`;
}
