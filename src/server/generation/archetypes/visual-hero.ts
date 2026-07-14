import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import { buildFallbackBackgroundSvgFragment } from "../fallback-background";
import type { CompositionInput } from "./types";
import {
  angledRibbon,
  ensureDeepColor,
  clampTuning,
  escapeXml,
  fitFontSize,
  fitWrappedText,
  formatInterviewLine,
  goldPill,
  makeScalers,
  phoneIcon,
  trustRoundel,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 1 — VISUAL HERO (benchmark poster grammar).
 *
 * Rebuilt against the strongest supplied market references (the Al-Yousuf
 * "Shutdown Project in Saudi Arabia" posters): a full-bleed industrial
 * photograph with a light wash over the upper zone carrying a HUGE
 * stacked two-color hook (first-second read), a trust roundel top-right,
 * an angled interview ribbon with highlighted dates, a navy contact bar
 * with a gold email pill, a full-width benefit banner, a banded
 * positions card, and a bottom identity strip with the integrated KAI
 * verification panel. Every text node remains deterministic truth
 * (ADR-006); the photo is Creative Brain presentation only.
 */
export function renderVisualHero(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(48);

  // Poster palette: navy/green market grammar, tinted by Agency DNA.
  const navy = "#0e2240";
  // Market poster green (deep, saturated) — DNA continuity is carried by the logo chip, roundel and identity strip, not by muddying the band palette.
  const green = "#15683a";
  void ensureDeepColor;
  const accent = plan.dna?.accentColor ?? "#e0342c";
  const gold = "#ffd21f";

  const headlineScale = clampTuning(plan.tuning?.headlineScale);
  const spacingScale = clampTuning(plan.tuning?.spacingScale);

  const background = plan.backgroundImageDataUri
    ? `<image x="0" y="0" width="${W}" height="${H}" href="${plan.backgroundImageDataUri}" preserveAspectRatio="xMidYMid slice" />`
    : buildFallbackBackgroundSvgFragment({ widthPx: W, heightPx: H, industry: facts.industry });

  // Light wash over the top ~45% (the benchmark's "bright sky" zone) so
  // the huge navy/green hook reads over any photograph; dark wash below
  // for the light-on-dark bands.
  // The photograph is the star (benchmark grammar): only a soft veil at
  // the very top holds the identity chip + hook (the image brief demands
  // a bright sky there), the mid-zone shows the plant RAW, and a dark
  // wash rises under the lower information bands.
  const scrims = `<defs>
    <linearGradient id="heroTopWash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f4f7fa" stop-opacity="0.62" />
      <stop offset="55%" stop-color="#f4f7fa" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#f4f7fa" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="heroBottomWash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#050d1a" stop-opacity="0" />
      <stop offset="40%" stop-color="#050d1a" stop-opacity="0.72" />
      <stop offset="100%" stop-color="#050d1a" stop-opacity="0.9" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${Math.round(H * 0.42)}" fill="url(#heroTopWash)" />
  <rect x="0" y="${Math.round(H * 0.44)}" width="${W}" height="${H - Math.round(H * 0.44)}" fill="url(#heroBottomWash)" />`;

  const parts: string[] = [];

  // --- Identity chip (top-left): logo + agency name ---
  const chipH = px(84);
  const logoSize = chipH - px(16);
  let identityX = pad;
  if (plan.agencyLogoDataUri) {
    const chipW = logoSize + px(20);
    parts.push(
      `<rect x="${pad}" y="${pad}" width="${chipW}" height="${chipH}" rx="${px(10)}" fill="#ffffff" stroke="#d7dee6" stroke-width="1" />
  <image x="${pad + px(10)}" y="${pad + px(8)}" width="${logoSize}" height="${logoSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    identityX = pad + chipW + px(18);
  }
  const agencyNameSize = fitFontSize(facts.agencyName, W - identityX - pad - px(220), fpx(34), fpx(18));
  parts.push(
    `<text x="${identityX}" y="${pad + chipH / 2 - fpx(2)}" font-family="${font}" font-size="${agencyNameSize}" font-weight="700" fill="${navy}">${escapeXml(facts.agencyName)}</text>
  <text x="${identityX}" y="${pad + chipH / 2 + fpx(24)}" font-family="${font}" font-size="${fpx(17)}" letter-spacing="2" fill="#3c4a5d">OVERSEAS RECRUITMENT</text>`,
  );

  // --- Trust roundel (top-right): grounded registration identity ---
  const roundelR = px(80);
  parts.push(
    trustRoundel({
      cx: W - pad - roundelR,
      cy: pad + roundelR + px(6),
      r: roundelR,
      fill: navy,
      ringColor: gold,
      fontFamily: font,
      topText: "MEA",
      mainText: facts.raLicenseId ? `RA ${facts.raLicenseId}` : "REGISTERED",
      bottomText: "REGISTERED",
    }),
  );

  // --- HUGE stacked hook (first-second read) ---
  const hookLines = plan.copy?.hookLines?.length
    ? plan.copy.hookLines
    : facts.country && !facts.header.toLowerCase().includes(facts.country.toLowerCase())
      ? [facts.header.toUpperCase(), `IN ${facts.country.toUpperCase()}`]
      : [facts.header.toUpperCase()];
  const roundelBottom = pad + roundelR * 2 + px(6);
  let y = Math.max(pad + chipH + px(56), roundelBottom + px(10));
  const hookMaxW = W - pad * 2;
  hookLines.forEach((line, i) => {
    const wrapped = fitWrappedText(line, hookMaxW, Math.round(fpx(i === 0 ? 96 : 88) * headlineScale), fpx(48), 2);
    for (const l of wrapped.lines) {
      y += Math.round(wrapped.fontSize * 1.04);
      // White halo under the fill keeps the hook punchy over any photo.
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

  // --- Angled interview ribbon (facts-derived fallback keeps interviews
  // present even when no copy plan was supplied) ---
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
  const contactH = px(96);
  const phone = facts.contact.phone ?? facts.contact.whatsapp;
  const email = facts.contact.email;
  parts.push(`<rect x="0" y="${contactY}" width="${W}" height="${contactH}" fill="${navy}" />`);
  let cx = pad;
  if (phone) {
    const size = fpx(44);
    parts.push(
      `${phoneIcon(cx, contactY + contactH / 2 - fpx(20), fpx(40), gold)}
  <text x="${cx + px(52)}" y="${contactY + contactH / 2 + size * 0.34}" font-family="${font}" font-size="${size}" font-weight="700" fill="${gold}">${escapeXml(phone)}</text>`,
    );
    cx += px(52) + phone.length * size * 0.72 + px(28);
  }
  if (email) {
    const pillH = px(58);
    const pillSize = fitFontSize(`Email: ${email}`, W - cx - pad - px(60), fpx(28), fpx(15));
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
    bandY += bannerH + px(Math.round(14 * spacingScale));
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

  // --- Bottom identity strip + KAI verification panel ---
  const stripY = H - bottomStripH;
  parts.push(`<rect x="0" y="${stripY}" width="${W}" height="${bottomStripH}" fill="${navy}" />
  <rect x="0" y="${stripY}" width="${W}" height="${px(6)}" fill="${gold}" />`);
  const panelProbe = verificationPanel({
    x: 0,
    y: stripY + Math.round((bottomStripH - px(92)) / 2) + px(3),
    height: px(92),
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
      y: stripY + Math.round((bottomStripH - px(92)) / 2) + px(3),
      height: px(92),
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: "#ffffff",
      accentColor: green,
    }).svg,
  );
  const stripTextW = panelX - pad - px(20);
  parts.push(
    `<text x="${pad}" y="${stripY + bottomStripH / 2 - fpx(2)}" font-family="${font}" font-size="${fitFontSize(facts.agencyName, stripTextW, fpx(24), fpx(13))}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>
  ${facts.fullRegistrationNumber ? `<text x="${pad}" y="${stripY + bottomStripH / 2 + fpx(22)}" font-family="${font}" font-size="${fitFontSize(`Regd. No. ${facts.fullRegistrationNumber}`, stripTextW, fpx(16), fpx(9))}" fill="#c6d2e0">Regd. No. ${escapeXml(facts.fullRegistrationNumber)}</text>` : ""}`,
  );

  // Landscape: same grammar compresses naturally via scalers; the hook and
  // bands span the full width, which suits wide canvases.
  void isLandscape;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${background}
  ${scrims}
  ${parts.join("\n  ")}
</svg>`;
}
