import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import { buildFallbackBackgroundSvgFragment } from "../fallback-background";
import type { CompositionInput } from "./types";
import {
  angledRibbon,
  clampOpacity,
  clampTuning,
  escapeXml,
  fitFontSize,
  fitWrappedText,
  formatInterviewLine,
  goldPill,
  makeScalers,
  phoneIcon,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 1 — VISUAL HERO (benchmark poster grammar).
 *
 * Rebuilt against the strongest supplied market references: a full-bleed
 * industrial photograph with a light wash over the upper zone carrying
 * a HUGE stacked two-color hook (first-second read), an angled interview
 * ribbon with highlighted dates, a navy contact bar with a gold email
 * pill, a full-width benefit banner, a banded positions card, and a
 * single integrated trust footer with agency identity, registration,
 * and the KAI verification panel.
 *
 * TRUST ARCHITECTURE (Phase 5): agency name, logo, RA number, and MEA
 * registration appear ONCE in the integrated trust footer — never
 * duplicated across top and bottom. The top of the canvas is premium
 * candidate-attention territory for the hook + destination + candidate
 * hook, not agency identity repetition.
 */
export function renderVisualHero(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(48);

  const navy = "#0e2240";
  const green = "#15683a";
  const accent = plan.dna?.accentColor ?? "#e0342c";
  const gold = "#ffd21f";

  const headlineScale = clampTuning(plan.tuning?.headlineScale);
  const spacingScale = clampTuning(plan.tuning?.spacingScale);
  const ctaScale = clampTuning(plan.tuning?.ctaScale);
  const qrPanelScale = clampTuning(plan.tuning?.qrPanelScale, 0.9, 1.2);
  const bannerSpacing = clampTuning(plan.tuning?.bannerSpacing);
  const scrimTopOpacity = clampOpacity(plan.tuning?.scrimOpacity, 0.62);
  const scrimBottomOpacity = clampOpacity(plan.tuning?.scrimOpacity, 0.9);

  const background = plan.backgroundImageDataUri
    ? `<image x="0" y="0" width="${W}" height="${H}" href="${plan.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />`
    : buildFallbackBackgroundSvgFragment({ widthPx: W, heightPx: H, industry: facts.industry });

  const scrims = `<defs>
    <linearGradient id="heroTopWash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f4f7fa" stop-opacity="${scrimTopOpacity.toFixed(2)}" />
      <stop offset="55%" stop-color="#f4f7fa" stop-opacity="${(scrimTopOpacity * 0.48).toFixed(2)}" />
      <stop offset="100%" stop-color="#f4f7fa" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="heroBottomWash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#050d1a" stop-opacity="0" />
      <stop offset="40%" stop-color="#050d1a" stop-opacity="${(scrimBottomOpacity * 0.8).toFixed(2)}" />
      <stop offset="100%" stop-color="#050d1a" stop-opacity="${scrimBottomOpacity.toFixed(2)}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${Math.round(H * 0.42)}" fill="url(#heroTopWash)" />
  <rect x="0" y="${Math.round(H * 0.44)}" width="${W}" height="${H - Math.round(H * 0.44)}" fill="url(#heroBottomWash)" />`;

  const parts: string[] = [];

  // --- Candidate hook in reclaimed top-canvas (Phase 5) ---
  // Instead of repeating agency identity at the top, use this premium
  // space for a source-grounded candidate-facing hook line.
  let y = pad + px(16);
  const candidateHook = plan.directives?.candidateHook;
  if (candidateHook) {
    const hookSize = fitFontSize(candidateHook.text, W - pad * 2, fpx(28), fpx(14));
    parts.push(
      `<text x="${pad}" y="${y + hookSize}" font-family="${font}" font-size="${hookSize}" font-weight="700" letter-spacing="2" stroke="#f6f8fa" stroke-width="${Math.max(4, Math.round(hookSize * 0.2))}" stroke-linejoin="round" fill="none">${escapeXml(candidateHook.text)}</text>
  <text x="${pad}" y="${y + hookSize}" font-family="${font}" font-size="${hookSize}" font-weight="700" letter-spacing="2" fill="${green}">${escapeXml(candidateHook.text)}</text>`,
    );
    y += hookSize + px(24);
  } else {
    y += px(20);
  }

  // --- HUGE stacked hook (first-second read) ---
  const hookLines = plan.copy?.hookLines?.length
    ? plan.copy.hookLines
    : facts.country && !facts.header.toLowerCase().includes(facts.country.toLowerCase())
      ? [facts.header.toUpperCase(), `IN ${facts.country.toUpperCase()}`]
      : [facts.header.toUpperCase()];
  const hookMaxW = W - pad * 2;
  hookLines.forEach((line, i) => {
    const wrapped = fitWrappedText(line, hookMaxW, Math.round(fpx(i === 0 ? 96 : 88) * headlineScale), fpx(48), 2);
    for (const l of wrapped.lines) {
      y += Math.round(wrapped.fontSize * 1.04);
      parts.push(
        `<text x="${pad}" y="${y}" font-family="${font}" font-size="${wrapped.fontSize}" font-weight="700" letter-spacing="-1" stroke="#f6f8fa" stroke-width="${Math.max(6, Math.round(wrapped.fontSize * 0.14))}" stroke-linejoin="round" fill="none">${escapeXml(l)}</text>
  <text x="${pad}" y="${y}" font-family="${font}" font-size="${wrapped.fontSize}" font-weight="700" letter-spacing="-1" fill="${i === 0 ? navy : green}">${escapeXml(l)}</text>`,
      );
    }
    y += px(8);
  });

  // Employer / industry underline chip (three-second read)
  const subline = `${facts.industry.toUpperCase()}${facts.employer ? "  ·  " + facts.employer.toUpperCase() : ""}`;
  const sublineSize = fitFontSize(subline, W - pad * 2, fpx(24), fpx(13));
  y += px(30);
  parts.push(
    `<rect x="${pad}" y="${y - fpx(20)}" width="${px(52)}" height="${px(7)}" fill="${accent}" />
  <text x="${pad + px(66)}" y="${y}" font-family="${font}" font-size="${sublineSize}" font-weight="700" letter-spacing="1" stroke="#f6f8fa" stroke-width="${Math.max(4, Math.round(sublineSize * 0.28))}" stroke-linejoin="round" fill="none">${escapeXml(subline)}</text>
  <text x="${pad + px(66)}" y="${y}" font-family="${font}" font-size="${sublineSize}" font-weight="700" letter-spacing="1" fill="${navy}">${escapeXml(subline)}</text>`,
  );

  // --- Angled interview ribbon ---
  const ribbon =
    plan.copy?.interviewRibbon ??
    (facts.interview.length > 0
      ? { line1: "INTERVIEW", line2: facts.interview.map((e) => formatInterviewLine(e)).join("  ·  ") }
      : null);
  const ribbonH = px(ribbon?.line2 ? 118 : 88);
  const ribbonY = Math.round(H * 0.455);
  if (ribbon) {
    parts.push(
      angledRibbon({
        y: ribbonY,
        width: W,
        height: ribbonH,
        fill: green,
        line1: ribbon.line1,
        line2: ribbon.line2,
        fontFamily: font,
        line1Size: fitFontSize(ribbon.line1, W - px(120), fpx(38), fpx(20)),
        line2Size: fitFontSize(ribbon.line2 ?? "", W - px(120), fpx(34), fpx(18)),
      }),
    );
  }

  // --- Navy contact bar: big phone + gold email pill ---
  const contactY = ribbonY + (ribbon ? ribbonH + px(10) : 0);
  const contactH = px(Math.round(96 * ctaScale));
  const phone = facts.contact.phone ?? facts.contact.whatsapp;
  const email = facts.contact.email;
  parts.push(`<rect x="0" y="${contactY}" width="${W}" height="${contactH}" fill="${navy}" />`);
  let cx = pad;
  if (phone) {
    const size = fpx(Math.round(44 * ctaScale));
    parts.push(
      `${phoneIcon(cx, contactY + contactH / 2 - fpx(20), fpx(Math.round(40 * ctaScale)), gold)}
  <text x="${cx + px(52)}" y="${contactY + contactH / 2 + size * 0.34}" font-family="${font}" font-size="${size}" font-weight="700" fill="${gold}">${escapeXml(phone)}</text>`,
    );
    cx += px(52) + phone.length * size * 0.72 + px(28);
  }
  if (email) {
    const pillH = px(Math.round(58 * ctaScale));
    const pillSize = fitFontSize(`Email: ${email}`, W - cx - pad - px(60), fpx(Math.round(28 * ctaScale)), fpx(15));
    const pill = goldPill({
      x: cx,
      y: contactY + Math.round((contactH - pillH) / 2),
      height: pillH,
      text: `Email: ${email}`,
      fontFamily: font,
      fontSize: pillSize,
    });
    parts.push(pill.svg);
  }

  // --- Benefit banner (grounded compensation) ---
  let bandY = contactY + contactH + px(10);
  const bannerText =
    plan.copy?.benefitBanner ??
    (facts.benefits.length > 0 ? facts.benefits.map((b) => b.label.toUpperCase()).join(" + ") : null);
  if (bannerText) {
    const bannerH = px(78);
    const size = fitFontSize(bannerText, W - pad * 2, fpx(40), fpx(18));
    parts.push(
      `<rect x="0" y="${bandY}" width="${W}" height="${bannerH}" fill="${green}" />
  <text x="${W / 2}" y="${bandY + bannerH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${gold}">${escapeXml(bannerText)}</text>`,
    );
    bandY += bannerH + px(Math.round(14 * spacingScale * bannerSpacing));
  }

  // --- Positions card (banded rows) ---
  const bottomStripH = px(120);
  const cardX = pad;
  const cardW = W - pad * 2;
  const headerRowH = px(52);
  const footerNote = facts.footer;
  const noteH = footerNote ? px(40) : 0;
  const availForRows = H - bottomStripH - noteH - bandY - headerRowH - px(30);
  const rowH = Math.max(px(40), Math.min(px(60), Math.floor(availForRows / Math.max(facts.positions.length, 1))));
  const cardH = headerRowH + facts.positions.length * rowH;
  parts.push(
    `<rect x="${cardX}" y="${bandY}" width="${cardW}" height="${cardH}" rx="${px(8)}" fill="#ffffff" />
  <rect x="${cardX}" y="${bandY}" width="${cardW}" height="${headerRowH}" rx="${px(8)}" fill="${navy}" />
  <rect x="${cardX}" y="${bandY + headerRowH - px(8)}" width="${cardW}" height="${px(8)}" fill="${navy}" />
  <text x="${cardX + px(20)}" y="${bandY + headerRowH / 2 + fpx(9)}" font-family="${font}" font-size="${fpx(24)}" font-weight="700" letter-spacing="3" fill="#ffffff">POSITIONS</text>`,
  );
  facts.positions.forEach((p, i) => {
    const ry = bandY + headerRowH + i * rowH;
    const label = p.count ? `${p.title}` : p.title;
    const size = fitFontSize(label, cardW - px(120), fpx(30), fpx(15));
    parts.push(
      `<rect x="${cardX}" y="${ry}" width="${cardW}" height="${rowH}" fill="${i % 2 === 0 ? "#eef2f7" : "#ffffff"}" />
  <path d="M ${cardX + px(20)} ${ry + rowH / 2 - fpx(8)} L ${cardX + px(32)} ${ry + rowH / 2} L ${cardX + px(20)} ${ry + rowH / 2 + fpx(8)} Z" fill="${accent}" />
  <text x="${cardX + px(46)}" y="${ry + rowH / 2 + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="${navy}">${escapeXml(label)}</text>
  ${p.count ? `<text x="${cardX + cardW - px(20)}" y="${ry + rowH / 2 + fpx(9)}" text-anchor="end" font-family="${font}" font-size="${fpx(26)}" font-weight="700" fill="${green}">${p.count} Nos</text>` : ""}`,
    );
  });
  let afterCard = bandY + cardH + px(14);

  // --- Grounded requirement note ---
  if (footerNote) {
    const size = fitFontSize(footerNote, W - pad * 2, fpx(24), fpx(13));
    parts.push(
      `<text x="${W / 2}" y="${afterCard + fpx(16)}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${gold}">${escapeXml(footerNote)}</text>`,
    );
    afterCard += noteH;
  }

  // --- Single integrated trust footer (Phase 5) ---
  // Agency logo + name + registration + QR verification — all in one
  // integrated band. No repetition from the top of the canvas.
  const stripY = H - bottomStripH;
  parts.push(`<rect x="0" y="${stripY}" width="${W}" height="${bottomStripH}" fill="${navy}" />
  <rect x="0" y="${stripY}" width="${W}" height="${px(6)}" fill="${gold}" />`);

  // Logo in the trust footer (its only appearance)
  let trustTextX = pad;
  const logoFooterSize = px(52);
  if (plan.agencyLogoDataUri) {
    const logoY = stripY + Math.round((bottomStripH - logoFooterSize) / 2);
    parts.push(
      `<rect x="${pad}" y="${logoY}" width="${logoFooterSize + px(8)}" height="${logoFooterSize + px(8)}" rx="${px(6)}" fill="#ffffff" />
  <image x="${pad + px(4)}" y="${logoY + px(4)}" width="${logoFooterSize}" height="${logoFooterSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    trustTextX = pad + logoFooterSize + px(22);
  }

  const qrH = px(Math.round(92 * qrPanelScale));
  const panelProbe = verificationPanel({
    x: 0,
    y: stripY + Math.round((bottomStripH - qrH) / 2) + px(3),
    height: qrH,
    qrDataUri: plan.qrDataUri,
    raLicenseId: facts.raLicenseId,
    fontFamily: font,
    captionColor: "#ffffff",
    accentColor: green,
  });
  const panelX = W - pad - panelProbe.width;
  parts.push(
    verificationPanel({
      x: panelX,
      y: stripY + Math.round((bottomStripH - qrH) / 2) + px(3),
      height: qrH,
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: "#ffffff",
      accentColor: green,
    }).svg,
  );
  const stripTextW = panelX - trustTextX - px(20);
  parts.push(
    `<text x="${trustTextX}" y="${stripY + bottomStripH / 2 - fpx(2)}" font-family="${font}" font-size="${fitFontSize(facts.agencyName, stripTextW, fpx(24), fpx(13))}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>
  ${facts.fullRegistrationNumber ? `<text x="${trustTextX}" y="${stripY + bottomStripH / 2 + fpx(22)}" font-family="${font}" font-size="${fitFontSize(`Regd. No. ${facts.fullRegistrationNumber}`, stripTextW, fpx(16), fpx(9))}" fill="#c6d2e0">Regd. No. ${escapeXml(facts.fullRegistrationNumber)}</text>` : ""}`,
  );

  void isLandscape;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${background}
  ${scrims}
  ${parts.join("\n  ")}
</svg>`;
}
