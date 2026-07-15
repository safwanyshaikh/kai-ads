import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import type { CompositionInput } from "./types";
import {
  angledRibbon,
  clampTuning,
  ensureDeepColor,
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
 * ARCHETYPE 2 — STRUCTURED PROFESSIONAL (benchmark commercial grammar).
 *
 * The photography-free sibling of the market poster references: a navy
 * identity band (logo chip, agency name, trust roundel), a HUGE stacked
 * two-color hook on clean white, the angled interview ribbon with
 * highlighted dates, a navy contact bar with a gold email pill, the
 * full-width benefit banner, a banded positions card, the grounded
 * requirement note, and a bottom identity strip with the integrated KAI
 * verification panel. Distinct from the Visual Hero by design: zero
 * imagery, maximum clarity and confidence.
 */
export function renderStructuredProfessional(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(48);

  const navy = "#0e2240";
  const brand = ensureDeepColor(plan.dna?.primaryColor ?? "#0d4f8b");
  const brand2 = ensureDeepColor(plan.dna?.secondaryColor ?? brand);
  const accent = plan.dna?.accentColor ?? "#e0342c";
  const gold = "#ffd21f";

  const headlineScale = clampTuning(plan.tuning?.headlineScale);
  const spacingScale = clampTuning(plan.tuning?.spacingScale);
  const ctaScale = clampTuning(plan.tuning?.ctaScale);
  const qrPanelScale = clampTuning(plan.tuning?.qrPanelScale, 0.9, 1.2);
  const bannerSpacing = clampTuning(plan.tuning?.bannerSpacing);

  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#f7f9fb" />`];

  // --- Navy identity band (no agency logo — trust architecture places it
  // exclusively in the footer to avoid duplication) ---
  const bandH = px(132);
  parts.push(`<rect x="0" y="0" width="${W}" height="${bandH}" fill="${navy}" />
  <rect x="0" y="${bandH}" width="${W}" height="${px(7)}" fill="${gold}" />`);
  parts.push(
    `<text x="${pad}" y="${bandH / 2 + fpx(8)}" font-family="${font}" font-size="${fpx(22)}" font-weight="700" letter-spacing="3" fill="#c9d5e4">OVERSEAS RECRUITMENT</text>`,
  );

  // --- Candidate hook (reclaimed from removed trust roundel) ---
  const candidateHook = plan.directives?.candidateHook;
  if (candidateHook) {
    const hookY = bandH + px(56);
    const hookSize = fitFontSize(candidateHook.text, W - pad * 2, fpx(28), fpx(16));
    parts.push(
      `<text x="${pad}" y="${hookY}" font-family="${font}" font-size="${hookSize}" font-weight="700" letter-spacing="2" fill="${brand}">${escapeXml(candidateHook.text)}</text>`,
    );
  }

  // --- HUGE stacked hook on white ---
  const hookLines = plan.copy?.hookLines?.length
    ? plan.copy.hookLines
    : facts.country && !facts.header.toLowerCase().includes(facts.country.toLowerCase())
      ? [facts.header.toUpperCase(), `IN ${facts.country.toUpperCase()}`]
      : [facts.header.toUpperCase()];
  let y = bandH + (candidateHook ? px(78) : px(96));
  const hookMaxW = W - pad * 2;
  hookLines.forEach((line, i) => {
    const wrapped = fitWrappedText(line, i === 0 ? hookMaxW : W - pad * 2, Math.round(fpx(i === 0 ? 84 : 78) * headlineScale), fpx(40), 2);
    for (const l of wrapped.lines) {
      y += Math.round(wrapped.fontSize * 1.05);
      parts.push(
        `<text x="${pad}" y="${y}" font-family="${font}" font-size="${wrapped.fontSize}" font-weight="700" letter-spacing="-1" fill="${i === 0 ? navy : brand}">${escapeXml(l)}</text>`,
      );
    }
    y += px(6);
  });
  const subline = `${facts.industry.toUpperCase()}${facts.employer ? "  ·  " + facts.employer.toUpperCase() : ""}`;
  y += px(26);
  parts.push(
    `<rect x="${pad}" y="${y - fpx(19)}" width="${px(50)}" height="${px(7)}" fill="${accent}" />
  <text x="${pad + px(64)}" y="${y}" font-family="${font}" font-size="${fitFontSize(subline, W - pad * 2 - px(64), fpx(23), fpx(12))}" font-weight="700" letter-spacing="1" fill="#33415a">${escapeXml(subline)}</text>`,
  );

  // --- Angled interview ribbon (facts-derived fallback) ---
  const ribbon =
    plan.copy?.interviewRibbon ??
    (facts.interview.length > 0
      ? { line1: "INTERVIEW", line2: facts.interview.map((e) => formatInterviewLine(e)).join("  ·  ") }
      : null);
  const ribbonH = px(ribbon?.line2 ? 116 : 86);
  const ribbonY = y + px(Math.round(34 * spacingScale));
  if (ribbon) {
    parts.push(
      angledRibbon({
        y: ribbonY,
        width: W,
        height: ribbonH,
        fill: brand2,
        line1: ribbon.line1,
        line2: ribbon.line2,
        fontFamily: font,
        line1Size: fitFontSize(ribbon.line1, W - px(120), fpx(37), fpx(20)),
        line2Size: fitFontSize(ribbon.line2 ?? "", W - px(120), fpx(33), fpx(18)),
      }),
    );
  }

  // --- Navy contact bar ---
  const contactY = (ribbon ? ribbonY + ribbonH : ribbonY) + px(10);
  const contactH = px(Math.round(94 * ctaScale));
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
    const pillH = px(Math.round(56 * ctaScale));
    const pill = goldPill({
      x: cx,
      y: contactY + Math.round((contactH - pillH) / 2),
      height: pillH,
      text: `Email: ${email}`,
      fontFamily: font,
      fontSize: fitFontSize(`Email: ${email}`, W - cx - pad - px(60), fpx(Math.round(27 * ctaScale)), fpx(14)),
    });
    parts.push(pill.svg);
  }

  // --- Benefit banner ---
  let bandY = contactY + contactH + px(10);
  const bannerText =
    plan.copy?.benefitBanner ??
    (facts.benefits.length > 0 ? facts.benefits.map((b) => b.label.toUpperCase()).join(" + ") : null);
  if (bannerText) {
    const bannerH = px(76);
    const size = fitFontSize(bannerText, W - pad * 2, fpx(38), fpx(18));
    parts.push(
      `<rect x="0" y="${bandY}" width="${W}" height="${bannerH}" fill="${brand2}" />
  <text x="${W / 2}" y="${bandY + bannerH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${gold}">${escapeXml(bannerText)}</text>`,
    );
    bandY += bannerH + px(Math.round(14 * spacingScale * bannerSpacing));
  }

  // --- Positions card (banded rows) ---
  const bottomStripH = px(118);
  const cardX = pad;
  const cardW = W - pad * 2;
  const headerRowH = px(52);
  const noteH = facts.footer ? px(42) : 0;
  const availForRows = H - bottomStripH - noteH - bandY - headerRowH - px(26);
  const rowH = Math.max(px(40), Math.min(px(62), Math.floor(availForRows / Math.max(facts.positions.length, 1))));
  const cardH = headerRowH + facts.positions.length * rowH;
  parts.push(
    `<rect x="${cardX}" y="${bandY}" width="${cardW}" height="${cardH}" rx="${px(8)}" fill="#ffffff" stroke="#d8e0e8" stroke-width="1.5" />
  <rect x="${cardX}" y="${bandY}" width="${cardW}" height="${headerRowH}" rx="${px(8)}" fill="${navy}" />
  <rect x="${cardX}" y="${bandY + headerRowH - px(8)}" width="${cardW}" height="${px(8)}" fill="${navy}" />
  <text x="${cardX + px(20)}" y="${bandY + headerRowH / 2 + fpx(9)}" font-family="${font}" font-size="${fpx(24)}" font-weight="700" letter-spacing="3" fill="#ffffff">OPEN POSITIONS</text>`,
  );
  facts.positions.forEach((p, i) => {
    const ry = bandY + headerRowH + i * rowH;
    const size = fitFontSize(p.title, cardW - px(140), fpx(30), fpx(15));
    parts.push(
      `<rect x="${cardX + px(2)}" y="${ry}" width="${cardW - px(4)}" height="${rowH}" fill="${i % 2 === 0 ? "#eef2f7" : "#ffffff"}" />
  <text x="${cardX + px(22)}" y="${ry + rowH / 2 + fpx(10)}" font-family="${font}" font-size="${fpx(26)}" font-weight="700" fill="${brand}">${String(i + 1).padStart(2, "0")}</text>
  <text x="${cardX + px(72)}" y="${ry + rowH / 2 + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="${navy}">${escapeXml(p.title)}</text>
  ${p.count ? `<text x="${cardX + cardW - px(22)}" y="${ry + rowH / 2 + fpx(9)}" text-anchor="end" font-family="${font}" font-size="${fpx(26)}" font-weight="700" fill="${brand2}">${p.count} Nos</text>` : ""}`,
    );
  });
  let afterCard = bandY + cardH + px(12);

  // --- Grounded requirement note ---
  if (facts.footer) {
    const size = fitFontSize(facts.footer, W - pad * 2, fpx(23), fpx(13));
    parts.push(
      `<text x="${W / 2}" y="${afterCard + fpx(18)}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${accent}">${escapeXml(facts.footer)}</text>`,
    );
    afterCard += noteH;
  }

  // --- Bottom identity strip + KAI verification panel ---
  const stripY = H - bottomStripH;
  parts.push(`<rect x="0" y="${stripY}" width="${W}" height="${bottomStripH}" fill="${navy}" />
  <rect x="0" y="${stripY}" width="${W}" height="${px(6)}" fill="${gold}" />`);
  const panelH = px(Math.round(92 * qrPanelScale));
  const panelProbe = verificationPanel({
    x: 0,
    y: stripY + Math.round((bottomStripH - panelH) / 2) + px(3),
    height: panelH,
    qrDataUri: plan.qrDataUri,
    raLicenseId: facts.raLicenseId,
    fontFamily: font,
    captionColor: "#ffffff",
    accentColor: brand,
  });
  const panelX = W - pad - panelProbe.width;
  parts.push(
    verificationPanel({
      x: panelX,
      y: stripY + Math.round((bottomStripH - panelH) / 2) + px(3),
      height: panelH,
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: "#ffffff",
      accentColor: brand,
    }).svg,
  );
  const stripTextW = panelX - pad - px(20);
  parts.push(
    `<text x="${pad}" y="${stripY + bottomStripH / 2 - fpx(2)}" font-family="${font}" font-size="${fitFontSize(facts.agencyName, stripTextW, fpx(24), fpx(13))}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>
  ${facts.fullRegistrationNumber ? `<text x="${pad}" y="${stripY + bottomStripH / 2 + fpx(22)}" font-family="${font}" font-size="${fitFontSize(`Regd. No. ${facts.fullRegistrationNumber}`, stripTextW, fpx(16), fpx(9))}" fill="#c6d2e0">Regd. No. ${escapeXml(facts.fullRegistrationNumber)}</text>` : ""}`,
  );

  void isLandscape;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${parts.join("\n  ")}
</svg>`;
}
