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
