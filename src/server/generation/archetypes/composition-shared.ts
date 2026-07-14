import type { PlatformFormat } from "@/lib/platform-formats";
import type { InterviewEvent } from "../interview-events";

/**
 * Shared low-level toolkit for the four archetype composition engines.
 * Deliberately contains only primitives (scaling, text fitting, icons,
 * the verification panel) — layout and structure live entirely inside
 * each engine, which is what makes the four archetypes genuinely
 * different systems rather than one template with themes.
 */

export const BASE_W = 1080;
export const BASE_H = 1350;
export const LANDSCAPE_ASPECT_THRESHOLD = 1.3;

/** Conservative average glyph-width ratio for the embedded Liberation font stack — no DOM/canvas text measurement exists in this server-side path. */
const AVG_GLYPH_WIDTH_RATIO = 0.58;

export interface Scalers {
  px: (baseline: number) => number;
  fpx: (baseline: number) => number;
  isLandscape: boolean;
}

export function makeScalers(fmt: PlatformFormat): Scalers {
  const isLandscape = fmt.widthPx / fmt.heightPx >= LANDSCAPE_ASPECT_THRESHOLD;
  const layoutScale = isLandscape ? fmt.heightPx / (BASE_H * 0.75) : fmt.heightPx / BASE_H;
  const fontScale = Math.min(layoutScale, fmt.widthPx / BASE_W);
  return {
    px: (b: number) => Math.round(b * layoutScale),
    fpx: (b: number) => Math.round(b * fontScale),
    isLandscape,
  };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function estimateTextWidth(text: string, fontSizePx: number): number {
  return text.length * fontSizePx * AVG_GLYPH_WIDTH_RATIO;
}

/** Shrinks a single-line font size until the string fits, never below the floor. */
export function fitFontSize(text: string, maxWidthPx: number, startPx: number, minPx: number): number {
  if (maxWidthPx <= 0 || estimateTextWidth(text, startPx) <= maxWidthPx) return startPx;
  const fitted = Math.floor(maxWidthPx / (text.length * AVG_GLYPH_WIDTH_RATIO));
  return Math.max(minPx, Math.min(startPx, fitted));
}

/**
 * Word-wraps text at an estimated width, shrinking the font size until
 * everything fits within maxLines. Returns the raw (unescaped) lines and
 * the final font size — callers escape when emitting SVG.
 */
export function fitWrappedText(
  text: string,
  maxWidthPx: number,
  startPx: number,
  minPx: number,
  maxLines: number,
): { lines: string[]; fontSize: number } {
  const wrap = (fontSize: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (estimateTextWidth(candidate, fontSize) <= maxWidthPx || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  for (let size = startPx; size >= minPx; size -= 2) {
    const lines = wrap(size);
    if (lines.length <= maxLines && lines.every((l) => estimateTextWidth(l, size) <= maxWidthPx)) {
      return { lines, fontSize: size };
    }
  }
  const lines = wrap(minPx).slice(0, maxLines);
  return { lines, fontSize: minPx };
}

export function formatPositionLine(p: { title: string; count?: number; experience?: string }): string {
  const count = p.count ? ` (${p.count})` : "";
  const exp = p.experience ? ` — ${p.experience}` : "";
  return `${p.title}${count}${exp}`;
}

export function formatInterviewLine(event: InterviewEvent): string {
  return [event.location, event.date].filter(Boolean).join(" — ");
}

export function formatBenefitLine(b: { label: string; detail?: string }): string {
  return b.detail ? `${b.label} — ${b.detail}` : b.label;
}

// ---------------------------------------------------------------------------
// Vector icons — real SVG paths, never font glyphs (missing-glyph bug class
// fixed in FIX-009 must not come back via decorative Unicode characters).
// Each returns a fragment drawn inside an s×s box anchored at (x, y) top-left.
// ---------------------------------------------------------------------------

export function checkIcon(x: number, y: number, s: number, color: string): string {
  const u = s / 10;
  return `<path d="M ${x + 1.5 * u} ${y + 5.5 * u} L ${x + 4 * u} ${y + 8 * u} L ${x + 8.5 * u} ${y + 2 * u}" stroke="${color}" stroke-width="${Math.max(1.5, 1.4 * u)}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
}

export function phoneIcon(x: number, y: number, s: number, color: string): string {
  const u = s / 10;
  return `<path d="M ${x + 2 * u} ${y + 1.5 * u} C ${x + 1.5 * u} ${y + 5 * u} ${x + 5 * u} ${y + 8.5 * u} ${x + 8.5 * u} ${y + 8 * u} L ${x + 8.5 * u} ${y + 6.2 * u} L ${x + 6.4 * u} ${y + 5.6 * u} L ${x + 5.5 * u} ${y + 6.4 * u} C ${x + 4.2 * u} ${y + 5.8 * u} ${x + 3.6 * u} ${y + 5 * u} ${x + 3.4 * u} ${y + 4.2 * u} L ${x + 4.2 * u} ${y + 3.4 * u} L ${x + 3.8 * u} ${y + 1.5 * u} Z" fill="${color}" />`;
}

export function mailIcon(x: number, y: number, s: number, color: string): string {
  const u = s / 10;
  return `<rect x="${x + u}" y="${y + 2.5 * u}" width="${8 * u}" height="${5.5 * u}" rx="${0.8 * u}" fill="none" stroke="${color}" stroke-width="${Math.max(1.2, u)}" />
<path d="M ${x + 1.4 * u} ${y + 3 * u} L ${x + 5 * u} ${y + 5.8 * u} L ${x + 8.6 * u} ${y + 3 * u}" stroke="${color}" stroke-width="${Math.max(1.2, u)}" fill="none" stroke-linecap="round" />`;
}

export function pinIcon(x: number, y: number, s: number, color: string): string {
  const u = s / 10;
  return `<path d="M ${x + 5 * u} ${y + 9 * u} C ${x + 5 * u} ${y + 9 * u} ${x + 1.8 * u} ${y + 5.6 * u} ${x + 1.8 * u} ${y + 3.8 * u} C ${x + 1.8 * u} ${y + 2 * u} ${x + 3.2 * u} ${y + u} ${x + 5 * u} ${y + u} C ${x + 6.8 * u} ${y + u} ${x + 8.2 * u} ${y + 2 * u} ${x + 8.2 * u} ${y + 3.8 * u} C ${x + 8.2 * u} ${y + 5.6 * u} ${x + 5 * u} ${y + 9 * u} ${x + 5 * u} ${y + 9 * u} Z" fill="${color}" />
<circle cx="${x + 5 * u}" cy="${y + 3.8 * u}" r="${1.3 * u}" fill="#ffffff" />`;
}

// ---------------------------------------------------------------------------
// Verification panel — the KAI moat, rendered as an integrated component.
// ---------------------------------------------------------------------------

export interface VerificationPanelParams {
  x: number;
  y: number;
  height: number;
  qrDataUri: string;
  raLicenseId?: string | null;
  fontFamily: string;
  /** Caption text color for the labels next to the QR — pass a light color on dark bars, dark on light backgrounds. */
  captionColor: string;
  accentColor: string;
}

/**
 * The verification unit every archetype embeds: a white card holding the
 * KAI QR, with "SCAN TO VERIFY" / "MEA REGISTERED" / RA captions beside
 * it — designed to read as part of the advertisement's CTA architecture,
 * not a sticker floating in empty canvas. Returns the fragment and its
 * total width so engines can right-align it.
 */
export function verificationPanel(p: VerificationPanelParams): { svg: string; width: number } {
  const qrBox = p.height;
  const qrPad = Math.round(qrBox * 0.08);
  const captionSize = Math.max(10, Math.round(qrBox * 0.14));
  const smallSize = Math.max(8, Math.round(qrBox * 0.11));
  const captionX = p.x + qrBox + Math.round(qrBox * 0.14);
  const raText = p.raLicenseId ? `RA ${p.raLicenseId}` : "";
  const captionWidth = Math.max(
    estimateTextWidth("SCAN TO VERIFY", captionSize),
    estimateTextWidth("MEA REGISTERED AGENCY", smallSize),
    raText ? estimateTextWidth(raText, smallSize) : 0,
  );
  const midY = p.y + p.height / 2;

  const svg = `<rect x="${p.x}" y="${p.y}" width="${qrBox}" height="${qrBox}" rx="${Math.round(qrBox * 0.1)}" fill="#ffffff" stroke="${p.accentColor}" stroke-width="2" />
  <image x="${p.x + qrPad}" y="${p.y + qrPad}" width="${qrBox - 2 * qrPad}" height="${qrBox - 2 * qrPad}" href="${p.qrDataUri}" />
  <text x="${captionX}" y="${midY - captionSize * 0.55}" font-family="${p.fontFamily}" font-size="${captionSize}" font-weight="700" fill="${p.captionColor}">SCAN TO VERIFY</text>
  <text x="${captionX}" y="${midY + smallSize * 0.5}" font-family="${p.fontFamily}" font-size="${smallSize}" fill="${p.captionColor}">MEA REGISTERED AGENCY</text>
  ${raText ? `<text x="${captionX}" y="${midY + smallSize * 1.8}" font-family="${p.fontFamily}" font-size="${smallSize}" font-weight="700" fill="${p.captionColor}">${escapeXml(raText)}</text>` : ""}`;

  return { svg, width: qrBox + Math.round(qrBox * 0.14) + captionWidth };
}

/** Builds the contact CTA string parts every archetype's bottom bar uses. */
export function contactParts(contact: {
  name?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
}): { primary: string; secondary: string } {
  const phones = [contact.phone, contact.whatsapp].filter(Boolean).join(" · ");
  const rest = [contact.name, contact.email].filter(Boolean).join("  ·  ");
  return { primary: phones, secondary: rest };
}

/**
 * Clamps an acceptance-loop tuning multiplier into a bounded range so a
 * correction loop can nudge, never distort, a composition.
 */
export function clampTuning(value: number | undefined, min = 0.85, max = 1.3): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Benchmark poster components (market-reference grammar: angled interview
// ribbon, gold email pill, trust roundel) — shared shapes only; each engine
// decides placement, scale, and color, keeping archetypes distinct.
// ---------------------------------------------------------------------------

/** Angled full-width ribbon with a bold white line and optional highlight (yellow) second line. */
export function angledRibbon(p: {
  y: number;
  width: number;
  height: number;
  fill: string;
  line1: string;
  line2?: string | null;
  fontFamily: string;
  line1Size: number;
  line2Size: number;
  skewPx?: number;
}): string {
  const skew = p.skewPx ?? Math.round(p.height * 0.35);
  const textX = Math.round(p.width * 0.06);
  const oneLine = !p.line2;
  const line1Y = oneLine ? p.y + p.height / 2 + p.line1Size * 0.36 : p.y + p.height / 2 - p.line1Size * 0.18;
  return `<polygon points="0,${p.y} ${p.width},${p.y + skew * 0.4} ${p.width},${p.y + p.height} 0,${p.y + p.height - skew * 0.4}" fill="${p.fill}" />
  <text x="${textX}" y="${line1Y}" font-family="${p.fontFamily}" font-size="${p.line1Size}" font-weight="700" fill="#ffffff">${escapeXml(p.line1)}</text>
  ${p.line2 ? `<text x="${textX}" y="${p.y + p.height / 2 + p.line2Size * 1.05}" font-family="${p.fontFamily}" font-size="${p.line2Size}" font-weight="700" fill="#ffd21f">${escapeXml(p.line2)}</text>` : ""}`;
}

/** Rounded gold pill with dark bold text (the market's email treatment). Returns fragment + width. */
export function goldPill(p: {
  x: number;
  y: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill?: string;
  textColor?: string;
}): { svg: string; width: number } {
  const padX = Math.round(p.height * 0.55);
  const width = Math.round(estimateTextWidth(p.text, p.fontSize)) + padX * 2;
  return {
    svg: `<rect x="${p.x}" y="${p.y}" width="${width}" height="${p.height}" rx="${p.height / 2}" fill="${p.fill ?? "#f2b705"}" />
  <text x="${p.x + width / 2}" y="${p.y + p.height / 2 + p.fontSize * 0.36}" text-anchor="middle" font-family="${p.fontFamily}" font-size="${p.fontSize}" font-weight="700" fill="${p.textColor ?? "#101d33"}">${escapeXml(p.text)}</text>`,
    width,
  };
}

/** Trust roundel (starred double-ring circle) carrying grounded trust text — mirrors the market's "positions available" badge shape without inventing counts. */
export function trustRoundel(p: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  ringColor: string;
  fontFamily: string;
  topText: string;
  mainText: string;
  bottomText: string;
}): string {
  const star = (x: number, y: number, s: number) =>
    `<path d="M ${x} ${y - s} L ${x + s * 0.29} ${y - s * 0.31} L ${x + s * 0.95} ${y - s * 0.31} L ${x + s * 0.42} ${y + s * 0.12} L ${x + s * 0.59} ${y + s * 0.81} L ${x} ${y + s * 0.38} L ${x - s * 0.59} ${y + s * 0.81} L ${x - s * 0.42} ${y + s * 0.12} L ${x - s * 0.95} ${y - s * 0.31} L ${x - s * 0.29} ${y - s * 0.31} Z" fill="${p.ringColor}" />`;
  return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}" />
  <circle cx="${p.cx}" cy="${p.cy}" r="${p.r - Math.max(3, p.r * 0.08)}" fill="none" stroke="${p.ringColor}" stroke-width="${Math.max(1.5, p.r * 0.035)}" />
  ${star(p.cx, p.cy - p.r * 0.62, p.r * 0.11)}
  ${star(p.cx - p.r * 0.32, p.cy - p.r * 0.56, p.r * 0.085)}
  ${star(p.cx + p.r * 0.32, p.cy - p.r * 0.56, p.r * 0.085)}
  <text x="${p.cx}" y="${p.cy - p.r * 0.18}" text-anchor="middle" font-family="${p.fontFamily}" font-size="${Math.round(p.r * 0.22)}" font-weight="700" fill="#ffffff">${escapeXml(p.topText)}</text>
  <text x="${p.cx}" y="${p.cy + p.r * 0.16}" text-anchor="middle" font-family="${p.fontFamily}" font-size="${Math.round(p.r * 0.34)}" font-weight="700" fill="#ffd21f">${escapeXml(p.mainText)}</text>
  <text x="${p.cx}" y="${p.cy + p.r * 0.48}" text-anchor="middle" font-family="${p.fontFamily}" font-size="${Math.round(p.r * 0.17)}" font-weight="700" fill="#ffffff">${escapeXml(p.bottomText)}</text>`;
}

/** Darkens a hex color until white text (or use on light backgrounds) holds contrast — DNA-derived brand colors can be too light for poster duty. */
export function ensureDeepColor(hex: string, maxLuma = 105): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  let r = parseInt(m[1].slice(0, 2), 16);
  let g = parseInt(m[1].slice(2, 4), 16);
  let b = parseInt(m[1].slice(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma > maxLuma) {
    const f = maxLuma / luma;
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
