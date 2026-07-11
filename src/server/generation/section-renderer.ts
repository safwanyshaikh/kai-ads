import type { PlatformFormat } from "@/lib/platform-formats";
import type { BadgeConfig } from "./badge-selection.service";

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
  style: "TYPOGRAPHY" | "NEWSPAPER";
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
 * Renders the Typography and Newspaper/DTP styles as real SVG — no AI
 * image call, no dependency on OpenAI availability. Per ADR-006, exact
 * recruitment text (positions, salary, contact, RA number) is always
 * composed here as real text nodes, never delegated to an image model.
 *
 * This is intentionally template-based rather than free-form layout:
 * Newspaper gets a column rule and a boxed look (the DTP "USP"),
 * Typography gets a single clean column with strong type hierarchy.
 * Section-based editing (ADR-006 / Critical Editing USP) works because
 * each of these blocks is rendered independently from the advertisement's
 * own named sections, not from one opaque layout pass.
 */
export function renderSectionComposition(input: SectionRenderInput): string {
  const fmt = input.platformFormat;
  const isNewspaper = input.style === "NEWSPAPER";
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
  const rule = isNewspaper
    ? `<line x1="${padding}" y1="180" x2="${fmt.widthPx - padding}" y2="180" stroke="#1a1a1a" stroke-width="2" />`
    : "";

  const positionsBlock = positionLines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${260 + i * 34}" font-family="${fontFamily}" font-size="22" fill="#222222">${line}</text>`,
    )
    .join("\n  ");

  const benefitsBlock =
    benefitLines.length > 0
      ? `<text x="${padding}" y="${260 + positionLines.length * 34 + 40}" font-family="${fontFamily}" font-size="24" font-weight="700" fill="#111111">Benefits</text>
  ${benefitLines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${300 + positionLines.length * 34 + i * 30}" font-family="${fontFamily}" font-size="20" fill="#333333">${line}</text>`,
    )
    .join("\n  ")}`
      : "";

  const interviewBlock =
    input.interview.date || input.interview.location
      ? `<text x="${padding}" y="${fmt.heightPx - 220}" font-family="${fontFamily}" font-size="20" fill="#333333">Interview: ${escapeXml([input.interview.date, input.interview.location].filter(Boolean).join(", "))}</text>`
      : "";

  const contactBlock = contactLine
    ? `<text x="${padding}" y="${fmt.heightPx - 180}" font-family="${fontFamily}" font-size="20" font-weight="600" fill="#111111">${escapeXml(contactLine)}</text>`
    : "";

  const raBlock = input.raLicenseId
    ? `<text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - 8}" font-family="${fontFamily}" font-size="8" text-anchor="middle" fill="#333333">RA ${escapeXml(input.raLicenseId)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt.widthPx}" height="${fmt.heightPx}" viewBox="0 0 ${fmt.widthPx} ${fmt.heightPx}">
  <rect width="${fmt.widthPx}" height="${fmt.heightPx}" fill="#ffffff" />
  <text x="${padding}" y="90" font-family="${fontFamily}" font-size="${isNewspaper ? 40 : 52}" font-weight="700" fill="#111111">${escapeXml(input.header)}</text>
  <text x="${padding}" y="130" font-family="${fontFamily}" font-size="24" fill="#444444">${escapeXml(input.industry)} \u00b7 ${escapeXml(input.country)}${input.employer ? " \u00b7 " + escapeXml(input.employer) : ""}</text>
  ${rule}
  <text x="${padding}" y="220" font-family="${fontFamily}" font-size="28" font-weight="700" fill="#111111">Positions</text>
  ${positionsBlock}
  ${benefitsBlock}
  ${interviewBlock}
  ${contactBlock}
  <text x="${padding}" y="${fmt.heightPx - padding}" font-family="${fontFamily}" font-size="16" fill="#666666">${escapeXml(input.agencyName)}${input.footer ? " \u00b7 " + escapeXml(input.footer) : ""}</text>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRx}" fill="#ffffff" stroke="#111111" stroke-width="2" />
  <image x="${badgeX + 8}" y="${badgeY + 8}" width="${badgeSize - 16}" height="${badgeSize - 40}" href="${input.qrDataUri}" />
  <text x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize - 20}" font-family="${fontFamily}" font-size="9" text-anchor="middle" fill="#111111">MEA REGISTERED</text>
  ${raBlock}
  <text x="${badgeX + badgeSize / 2}" y="${badgeY - 8}" font-family="${fontFamily}" font-size="12" text-anchor="middle" fill="#333333">VERIFY AGENCY</text>
</svg>`;
}
