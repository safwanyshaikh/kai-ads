import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import { buildFallbackBackgroundSvgFragment } from "../fallback-background";
import type { CompositionInput } from "./types";
import {
  checkIcon,
  contactParts,
  escapeXml,
  fitFontSize,
  fitWrappedText,
  formatBenefitLine,
  formatInterviewLine,
  formatPositionLine,
  makeScalers,
  phoneIcon,
  mailIcon,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 1 — VISUAL HERO.
 *
 * Reference grammar (Saudi Electrical Technician ad, Saudi Textile
 * Mechanics ad): a dominant full-bleed industry photograph, a dark
 * gradient scrim rising from the bottom, an eyebrow line ("WE ARE
 * HIRING"), a very large wrapped headline, a country/industry accent
 * pill, position chips, a boxed benefit callout where grounded, and a
 * strong bottom CTA bar carrying contact + the integrated KAI
 * verification panel.
 *
 * The background is presentation (Creative Brain): an AI-generated
 * environment photo when the KAI Creative Engine is configured,
 * otherwise the deterministic industry-gradient fallback. Every fact is
 * SVG text composed here (ADR-006).
 */
export function renderVisualHero(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const accent = plan.accentColor === "#1a1a1a" ? "#e0342c" : plan.accentColor;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(56);

  // Landscape confines content to the left ~58% over a side scrim; portrait
  // and square use the full width over a bottom scrim.
  const contentW = isLandscape ? Math.round(W * 0.52) - pad : W - 2 * pad;

  const background = plan.backgroundImageDataUri
    ? `<image x="0" y="0" width="${W}" height="${H}" href="${plan.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />`
    : buildFallbackBackgroundSvgFragment({ widthPx: W, heightPx: H, industry: facts.industry });

  const scrim = isLandscape
    ? `<defs><linearGradient id="heroScrim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.82" />
      <stop offset="58%" stop-color="#000000" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.05" />
    </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#heroScrim)" />`
    : `<defs><linearGradient id="heroScrim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.45" />
      <stop offset="35%" stop-color="#000000" stop-opacity="0.25" />
      <stop offset="70%" stop-color="#000000" stop-opacity="0.72" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.9" />
    </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#heroScrim)" />`;

  const parts: string[] = [];
  let y = pad + px(20);

  // --- Identity row: logo chip + agency name ---
  const logoSize = px(72);
  if (plan.agencyLogoDataUri) {
    parts.push(
      `<rect x="${pad}" y="${y - px(10)}" width="${logoSize + px(20)}" height="${logoSize + px(20)}" rx="${px(12)}" fill="#ffffff" />
  <image x="${pad + px(10)}" y="${y}" width="${logoSize}" height="${logoSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    parts.push(
      `<text x="${pad + logoSize + px(44)}" y="${y + logoSize / 2 + fpx(9)}" font-family="${font}" font-size="${fpx(26)}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>`,
    );
  } else {
    parts.push(
      `<text x="${pad}" y="${y + fpx(24)}" font-family="${font}" font-size="${fpx(26)}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>`,
    );
  }
  y += logoSize + px(56);

  // --- Eyebrow + headline ---
  parts.push(
    `<rect x="${pad}" y="${y - fpx(20)}" width="${px(56)}" height="${px(6)}" fill="${accent}" />
  <text x="${pad + px(72)}" y="${y}" font-family="${font}" font-size="${fpx(26)}" font-weight="700" letter-spacing="4" fill="${accent}">WE ARE HIRING</text>`,
  );
  y += px(30);

  const headline = fitWrappedText(facts.header, contentW, fpx(72), fpx(36), 3);
  for (const line of headline.lines) {
    y += Math.round(headline.fontSize * 1.14);
    parts.push(
      `<text x="${pad}" y="${y}" font-family="${font}" font-size="${headline.fontSize}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
    );
  }
  y += px(34);

  // --- Country pill + industry ---
  const countryText = facts.country.toUpperCase();
  const pillFont = fpx(24);
  const pillW = Math.round(countryText.length * pillFont * 0.62) + px(48);
  const pillH = px(48);
  parts.push(
    `<rect x="${pad}" y="${y}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${accent}" />
  <text x="${pad + pillW / 2}" y="${y + pillH / 2 + pillFont * 0.36}" text-anchor="middle" font-family="${font}" font-size="${pillFont}" font-weight="700" fill="#ffffff">${escapeXml(countryText)}</text>
  <text x="${pad + pillW + px(24)}" y="${y + pillH / 2 + fpx(8)}" font-family="${font}" font-size="${fpx(22)}" fill="#e8e8e8">${escapeXml(facts.industry)}${facts.employer ? " · " + escapeXml(facts.employer) : ""}</text>`,
  );
  y += pillH + px(44);

  // --- Content blocks as column-aware emitters, so landscape can place
  // the requirement detail (chips + interview) in a right-hand column
  // instead of overflowing a single column past the CTA bar. ---
  const emitChips = (x: number, width: number, startY: number): number => {
    let cy = startY;
    const chipH = px(52);
    const chipGap = px(14);
    for (const p of facts.positions) {
      const line = formatPositionLine(p);
      const size = fitFontSize(line, width - px(56), fpx(24), fpx(15));
      parts.push(
        `<rect x="${x}" y="${cy}" width="${width}" height="${chipH}" rx="${px(10)}" fill="#ffffff" fill-opacity="0.13" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" />
  <circle cx="${x + px(26)}" cy="${cy + chipH / 2}" r="${px(5)}" fill="${accent}" />
  <text x="${x + px(46)}" y="${cy + chipH / 2 + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
      );
      cy += chipH + chipGap;
    }
    return cy + px(16);
  };

  const emitBenefits = (x: number, width: number, startY: number): number => {
    if (facts.benefits.length === 0) return startY;
    const cardPad = px(20);
    const lineH = px(38);
    const cardH = cardPad * 2 + facts.benefits.length * lineH - px(8);
    parts.push(
      `<rect x="${x}" y="${startY}" width="${width}" height="${cardH}" rx="${px(10)}" fill="#000000" fill-opacity="0.45" stroke="${accent}" stroke-width="2" />
  <rect x="${x}" y="${startY}" width="${px(8)}" height="${cardH}" fill="${accent}" />`,
    );
    let by = startY + cardPad + fpx(12);
    for (const b of facts.benefits) {
      const line = formatBenefitLine(b);
      const size = fitFontSize(line, width - px(90), fpx(24), fpx(14));
      parts.push(
        `${checkIcon(x + px(26), by - fpx(14), fpx(20), accent)}
  <text x="${x + px(58)}" y="${by + fpx(2)}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
      );
      by += lineH;
    }
    return startY + cardH + px(28);
  };

  const emitFooterNote = (x: number, width: number, startY: number): number => {
    if (!facts.footer) return startY;
    let cy = startY;
    const note = fitWrappedText(facts.footer, width, fpx(20), fpx(13), 2);
    for (const line of note.lines) {
      cy += Math.round(note.fontSize * 1.3);
      parts.push(
        `<text x="${x}" y="${cy}" font-family="${font}" font-size="${note.fontSize}" fill="#dddddd">${escapeXml(line)}</text>`,
      );
    }
    return cy + px(26);
  };

  const emitInterview = (x: number, width: number, startY: number): number => {
    if (facts.interview.length === 0) return startY;
    let cy = startY;
    const cols = Math.min(facts.interview.length, 2);
    const gap = px(16);
    const boxW = (width - gap * (cols - 1)) / cols;
    const boxH = px(66);
    parts.push(
      `<text x="${x}" y="${cy + fpx(20)}" font-family="${font}" font-size="${fpx(20)}" font-weight="700" letter-spacing="2" fill="${accent}">INTERVIEW</text>`,
    );
    cy += px(34);
    facts.interview.forEach((event, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = x + col * (boxW + gap);
      const byy = cy + row * (boxH + gap);
      const line = formatInterviewLine(event);
      const size = fitFontSize(line, boxW - px(24), fpx(20), fpx(12));
      parts.push(
        `<rect x="${bx}" y="${byy}" width="${boxW}" height="${boxH}" rx="${px(10)}" fill="#ffffff" fill-opacity="0.13" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.5" />
  <text x="${bx + boxW / 2}" y="${byy + boxH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
      );
    });
    return cy + Math.ceil(facts.interview.length / cols) * (boxH + gap);
  };

  if (isLandscape) {
    // Left column continues with the benefit callout + note; the
    // requirement detail (chips + interview) fills the right column.
    let yl = y;
    yl = emitBenefits(pad, contentW, yl);
    emitFooterNote(pad, contentW, yl);
    const rightX = Math.round(W * 0.56);
    const rightW = W - rightX - pad;
    // Readability panel: the side scrim fades out toward the right, so
    // the right column gets its own translucent backing over the photo.
    parts.push(
      `<rect x="${rightX - px(24)}" y="${pad}" width="${rightW + px(48)}" height="${H - px(150) - pad - px(24)}" rx="${px(14)}" fill="#000000" fill-opacity="0.42" />`,
    );
    let yr = pad + px(24);
    yr = emitChips(rightX, rightW, yr);
    emitInterview(rightX, rightW, yr + px(8));
  } else {
    y = emitChips(pad, contentW, y);
    y = emitBenefits(pad, contentW, y);
    y = emitFooterNote(pad, contentW, y);
    y = emitInterview(pad, contentW, y);
  }

  // --- Bottom CTA bar: contact + integrated verification panel ---
  const barH = px(150);
  const barY = H - barH;
  const barParts: string[] = [
    `<rect x="0" y="${barY}" width="${W}" height="${barH}" fill="${accent}" />`,
  ];
  const { primary, secondary } = contactParts(facts.contact);
  const panel = verificationPanel({
    x: 0, // placeholder, computed below
    y: barY + Math.round((barH - px(110)) / 2),
    height: px(110),
    qrDataUri: plan.qrDataUri,
    raLicenseId: facts.raLicenseId,
    fontFamily: font,
    captionColor: "#ffffff",
    accentColor: accent,
  });
  const panelX = W - pad - panel.width;
  const panelAt = verificationPanel({
    x: panelX,
    y: barY + Math.round((barH - px(110)) / 2),
    height: px(110),
    qrDataUri: plan.qrDataUri,
    raLicenseId: facts.raLicenseId,
    fontFamily: font,
    captionColor: "#ffffff",
    accentColor: accent,
  });
  barParts.push(panelAt.svg);

  const ctaTextW = panelX - pad - px(24);
  if (primary) {
    const size = fitFontSize(primary, ctaTextW - px(44), fpx(34), fpx(16));
    barParts.push(
      `${phoneIcon(pad, barY + barH / 2 - fpx(30), fpx(30), "#ffffff")}
  <text x="${pad + px(44)}" y="${barY + barH / 2 - fpx(6)}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(primary)}</text>`,
    );
  }
  if (secondary) {
    const size = fitFontSize(secondary, ctaTextW - px(44), fpx(20), fpx(12));
    barParts.push(
      `${mailIcon(pad, barY + barH / 2 + fpx(6), fpx(24), "#ffffff")}
  <text x="${pad + px(44)}" y="${barY + barH / 2 + fpx(24)}" font-family="${font}" font-size="${size}" fill="#ffffff">${escapeXml(secondary)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${background}
  ${scrim}
  ${parts.join("\n  ")}
  ${barParts.join("\n  ")}
</svg>`;
}
