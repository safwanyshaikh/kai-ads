import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import { buildFallbackBackgroundSvgFragment } from "../fallback-background";
import type { CompositionInput } from "./types";
import {
  angledRibbon,
  checkIcon,
  clampOpacity,
  clampTuning,
  contactParts,
  escapeXml,
  fitFontSize,
  fitWrappedText,
  formatBenefitLine,
  formatInterviewLine,
  goldPill,
  makeScalers,
  phoneIcon,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 1 — VISUAL HERO.
 *
 * Two rendering modes:
 *
 * AI-FIRST MODE (when GPT-generated advertisement canvas is available):
 * GPT is the primary advertisement designer — it generates the complete
 * commercial composition including text, layout, hierarchy, and imagery.
 * KAI overlays ONLY precision-critical elements that GPT cannot guarantee:
 * - Exact agency logo (real asset, not AI-rendered)
 * - KAI verification QR with scan-to-verify caption
 * - Exact RA/RC registration identity
 * This overlay is minimal and positioned to preserve GPT's composition.
 *
 * FALLBACK MODE (when no AI image is available):
 * Full deterministic SVG composition with gradient background — the
 * complete poster grammar: hook, ribbon, contact bar, positions card,
 * benefit banner, trust footer.
 */
export function renderVisualHero(input: CompositionInput): string {
  const { plan } = input;

  if (plan.backgroundImageDataUri) {
    return renderAiFirstVisualHero(input);
  }
  return renderFallbackVisualHero(input);
}

/**
 * HYBRID ARCHITECTURE: GPT generated the text-free creative visual
 * canvas. KAI deterministically composes ALL factual typography —
 * headline, country, positions, benefits, interview, contact, and
 * trust/verification — using transparent scrims, compact cards, and
 * integrated ribbons that preserve the AI canvas's visual power.
 *
 * No GPT-rendered text appears in the final output. Every factual
 * word traces to source-grounded data.
 */
function renderAiFirstVisualHero(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(48);

  const headlineScale = clampTuning(plan.tuning?.headlineScale);
  const ctaScale = clampTuning(plan.tuning?.ctaScale);
  const qrPanelScale = clampTuning(plan.tuning?.qrPanelScale, 0.9, 1.2);
  const spacingScale = clampTuning(plan.tuning?.spacingScale);
  const scrimOpacity = clampOpacity(plan.tuning?.scrimOpacity, 0.72);

  const navy = "#0e2240";
  const green = "#15683a";
  const accent = plan.dna?.accentColor ?? "#e0342c";
  const gold = "#ffd21f";

  const parts: string[] = [];

  // --- GPT's text-free creative canvas as the full background ---
  parts.push(
    `<image x="0" y="0" width="${W}" height="${H}" href="${plan.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />`,
  );

  // --- UPPER ZONE: transparent scrim + dominant headline ---
  const upperH = Math.round(H * 0.34);
  parts.push(
    `<defs><linearGradient id="heroTopScrim" x1="0%" y1="0%" x2="0%" y2="100%">` +
    `<stop offset="0%" stop-color="#050d1a" stop-opacity="${(scrimOpacity * 0.85).toFixed(2)}" />` +
    `<stop offset="70%" stop-color="#050d1a" stop-opacity="${(scrimOpacity * 0.45).toFixed(2)}" />` +
    `<stop offset="100%" stop-color="#050d1a" stop-opacity="0" />` +
    `</linearGradient></defs>` +
    `<rect x="0" y="0" width="${W}" height="${upperH}" fill="url(#heroTopScrim)" />`,
  );

  let y = pad + px(16);
  const candidateHook = plan.directives?.candidateHook;
  if (candidateHook) {
    const hookSize = fitFontSize(candidateHook.text, W - pad * 2, fpx(26), fpx(14));
    parts.push(
      `<text x="${pad}" y="${y + hookSize}" font-family="${font}" font-size="${hookSize}" font-weight="700" letter-spacing="2" fill="${green}">${escapeXml(candidateHook.text)}</text>`,
    );
    y += hookSize + px(16);
  }

  const hookLines = plan.copy?.hookLines?.length
    ? plan.copy.hookLines
    : facts.country && !facts.header.toLowerCase().includes(facts.country.toLowerCase())
      ? [facts.header.toUpperCase(), `IN ${facts.country.toUpperCase()}`]
      : [facts.header.toUpperCase()];
  const hookMaxW = W - pad * 2;
  hookLines.forEach((line, i) => {
    const wrapped = fitWrappedText(line, hookMaxW, Math.round(fpx(i === 0 ? 88 : 80) * headlineScale), fpx(44), 2);
    for (const l of wrapped.lines) {
      y += Math.round(wrapped.fontSize * 1.06);
      parts.push(
        `<text x="${pad}" y="${y}" font-family="${font}" font-size="${wrapped.fontSize}" font-weight="700" letter-spacing="-1" fill="#ffffff">${escapeXml(l)}</text>`,
      );
    }
    y += px(4);
  });

  const subline = `${facts.industry.toUpperCase()}${facts.employer ? "  ·  " + facts.employer.toUpperCase() : ""}`;
  y += px(12);
  const sublineSize = fitFontSize(subline, W - pad * 2, fpx(22), fpx(12));
  parts.push(
    `<rect x="${pad}" y="${y - fpx(16)}" width="${px(46)}" height="${px(6)}" fill="${accent}" />` +
    `<text x="${pad + px(58)}" y="${y}" font-family="${font}" font-size="${sublineSize}" font-weight="700" letter-spacing="1" fill="#e0e8f0">${escapeXml(subline)}</text>`,
  );

  // --- MIDDLE ZONE: positions card + benefits (semi-transparent) ---
  const midY = Math.round(H * 0.38 * spacingScale);
  const bottomStripH = px(160);
  const availMidH = H - midY - bottomStripH - px(30);

  // Positions card — compact, semi-transparent
  const cardX = pad;
  const cardW = W - pad * 2;
  const headerRowH = px(44);
  const maxRowH = px(52);
  const minRowH = px(34);
  const rowH = Math.max(minRowH, Math.min(maxRowH, Math.floor((availMidH * 0.55) / Math.max(facts.positions.length, 1))));
  const cardH = headerRowH + facts.positions.length * rowH;
  let cardY = midY;

  parts.push(
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${px(10)}" fill="${navy}" fill-opacity="0.82" />` +
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${headerRowH}" rx="${px(10)}" fill="${navy}" fill-opacity="0.95" />` +
    `<rect x="${cardX}" y="${cardY + headerRowH - px(6)}" width="${cardW}" height="${px(6)}" fill="${navy}" fill-opacity="0.95" />` +
    `<text x="${cardX + px(18)}" y="${cardY + headerRowH / 2 + fpx(8)}" font-family="${font}" font-size="${fpx(20)}" font-weight="700" letter-spacing="3" fill="#ffffff">POSITIONS</text>`,
  );
  facts.positions.forEach((p, i) => {
    const ry = cardY + headerRowH + i * rowH;
    const label = p.experience ? `${p.title} — ${p.experience}` : p.title;
    const size = fitFontSize(label, cardW - px(100), fpx(26), fpx(13));
    parts.push(
      `<rect x="${cardX + px(2)}" y="${ry}" width="${cardW - px(4)}" height="${rowH}" fill="${i % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}" />` +
      `<path d="M ${cardX + px(18)} ${ry + rowH / 2 - fpx(7)} L ${cardX + px(28)} ${ry + rowH / 2} L ${cardX + px(18)} ${ry + rowH / 2 + fpx(7)} Z" fill="${accent}" />` +
      `<text x="${cardX + px(40)}" y="${ry + rowH / 2 + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(label)}</text>` +
      (p.count ? `<text x="${cardX + cardW - px(18)}" y="${ry + rowH / 2 + fpx(8)}" text-anchor="end" font-family="${font}" font-size="${fpx(22)}" font-weight="700" fill="${gold}">${p.count} Nos</text>` : ""),
    );
  });
  cardY += cardH + px(Math.round(14 * spacingScale));

  // Benefits strip — compact ribbon
  if (facts.benefits.length > 0) {
    const benefitH = px(44);
    parts.push(
      `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${benefitH}" rx="${px(8)}" fill="${green}" fill-opacity="0.88" />`,
    );
    let bx = cardX + px(16);
    const by = cardY + benefitH / 2;
    const dnaSecondary = plan.dna?.secondaryColor ?? green;
    for (const b of facts.benefits) {
      const line = formatBenefitLine(b);
      const size = fitFontSize(line, cardW - px(60), fpx(18), fpx(11));
      parts.push(
        `${checkIcon(bx, by - fpx(10), fpx(18), gold)}` +
        `<text x="${bx + px(26)}" y="${by + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
      );
      bx += px(30) + line.length * size * 0.56 + px(24);
    }
    void dnaSecondary;
    cardY += benefitH + px(Math.round(10 * spacingScale));
  }

  // Footer note (mandatory requirement)
  if (facts.footer) {
    const noteSize = fitFontSize(facts.footer, cardW, fpx(18), fpx(11));
    parts.push(
      `<text x="${W / 2}" y="${cardY + fpx(14)}" text-anchor="middle" font-family="${font}" font-size="${noteSize}" font-weight="700" fill="${gold}">${escapeXml(facts.footer)}</text>`,
    );
    cardY += px(28);
  }

  // Interview ribbon
  if (facts.interview.length > 0) {
    const ribbon =
      plan.copy?.interviewRibbon ??
      { line1: "INTERVIEW", line2: facts.interview.map((e) => formatInterviewLine(e)).join("  ·  ") };
    const ribbonH = px(ribbon.line2 ? 90 : 62);
    parts.push(
      angledRibbon({
        y: cardY,
        width: W,
        height: ribbonH,
        fill: green,
        line1: ribbon.line1,
        line2: ribbon.line2,
        fontFamily: font,
        line1Size: fitFontSize(ribbon.line1, W - px(100), fpx(30), fpx(16)),
        line2Size: fitFontSize(ribbon.line2 ?? "", W - px(100), fpx(26), fpx(14)),
      }),
    );
  }

  // --- LOWER ZONE: contact bar + trust footer ---
  const stripY = H - bottomStripH;
  parts.push(
    `<rect x="0" y="${stripY}" width="${W}" height="${bottomStripH}" fill="${navy}" fill-opacity="0.92" />` +
    `<rect x="0" y="${stripY}" width="${W}" height="${px(5)}" fill="${gold}" />`,
  );

  // Contact CTA
  const { primary, secondary } = contactParts(facts.contact);
  const contactY = stripY + px(8);
  const contactH = px(Math.round(52 * ctaScale));
  let cx = pad;
  if (primary) {
    const size = fpx(Math.round(36 * ctaScale));
    parts.push(
      `${phoneIcon(cx, contactY + contactH / 2 - fpx(16), fpx(Math.round(32 * ctaScale)), gold)}` +
      `<text x="${cx + px(44)}" y="${contactY + contactH / 2 + size * 0.34}" font-family="${font}" font-size="${size}" font-weight="700" fill="${gold}">${escapeXml(primary)}</text>`,
    );
    cx += px(48) + primary.length * size * 0.68 + px(22);
  }
  if (secondary) {
    const pillH = px(Math.round(46 * ctaScale));
    const pill = goldPill({
      x: cx,
      y: contactY + Math.round((contactH - pillH) / 2),
      height: pillH,
      text: `Email: ${secondary}`,
      fontFamily: font,
      fontSize: fitFontSize(`Email: ${secondary}`, W - cx - pad - px(40), fpx(Math.round(22 * ctaScale)), fpx(12)),
    });
    parts.push(pill.svg);
  }

  // Trust footer: logo + agency name + QR panel
  let trustTextX = pad;
  const trustY = stripY + contactH + px(14);
  const logoSize = px(44);
  if (plan.agencyLogoDataUri) {
    const logoY = trustY + px(2);
    parts.push(
      `<rect x="${pad}" y="${logoY - px(3)}" width="${logoSize + px(6)}" height="${logoSize + px(6)}" rx="${px(5)}" fill="#ffffff" />` +
      `<image x="${pad + px(3)}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    trustTextX = pad + logoSize + px(16);
  }

  const qrH = px(Math.round(78 * qrPanelScale));
  const panelProbe = verificationPanel({
    x: 0,
    y: trustY,
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
      y: trustY,
      height: qrH,
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: "#ffffff",
      accentColor: green,
    }).svg,
  );

  const stripTextW = panelX - trustTextX - px(16);
  parts.push(
    `<text x="${trustTextX}" y="${trustY + fpx(16)}" font-family="${font}" font-size="${fitFontSize(facts.agencyName, stripTextW, fpx(18), fpx(10))}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>`,
  );
  if (facts.fullRegistrationNumber) {
    parts.push(
      `<text x="${trustTextX}" y="${trustY + fpx(34)}" font-family="${font}" font-size="${fitFontSize(`Regd. No. ${facts.fullRegistrationNumber}`, stripTextW, fpx(13), fpx(8))}" fill="#c6d2e0">Regd. No. ${escapeXml(facts.fullRegistrationNumber)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${parts.join("\n  ")}
</svg>`;
}

/**
 * FALLBACK: no AI image available. Full deterministic poster composition
 * with industry-themed gradient background. This is the complete
 * advertisement rendered entirely by KAI's SVG engine.
 */
function renderFallbackVisualHero(input: CompositionInput): string {
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

  const background = buildFallbackBackgroundSvgFragment({ widthPx: W, heightPx: H, industry: facts.industry });

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

  // --- Candidate hook in reclaimed top-canvas ---
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

  // --- HUGE stacked hook ---
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

  // Employer / industry subline
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

  // --- Navy contact bar ---
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

  // --- Benefit banner ---
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

  // --- Positions card ---
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

  // --- Trust footer ---
  const stripY = H - bottomStripH;
  parts.push(`<rect x="0" y="${stripY}" width="${W}" height="${bottomStripH}" fill="${navy}" />
  <rect x="0" y="${stripY}" width="${W}" height="${px(6)}" fill="${gold}" />`);

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
