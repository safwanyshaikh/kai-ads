import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import type { CompositionInput } from "./types";
import {
  checkIcon,
  contactParts,
  escapeXml,
  fitFontSize,
  fitWrappedText,
  formatBenefitLine,
  formatInterviewLine,
  makeScalers,
  phoneIcon,
  mailIcon,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 2 — STRUCTURED PROFESSIONAL.
 *
 * Reference grammar (Qatar structured ad, UAE construction ad, Al-Yousuf
 * Saudi Oil & Gas ad): a solid colored identity banner with logo and
 * agency name, a large dark headline with an accent country chip, then
 * card-based sections — an OPEN POSITIONS card with numbered/bulleted
 * rows, a BENEFITS card with checkmarks, side-by-side interview boxes —
 * closed by an accent CTA bar with contact + the integrated KAI
 * verification panel. Card-and-section architecture, no photography.
 */
export function renderStructuredProfessional(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const accent = plan.accentColor === "#1a1a1a" ? "#0d4f8b" : plan.accentColor;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(56);
  const ink = "#16202b";
  const cardFill = "#f4f6f8";

  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff" />`];

  // --- Identity banner ---
  const bannerH = px(150);
  parts.push(`<rect x="0" y="0" width="${W}" height="${bannerH}" fill="${accent}" />
  <rect x="0" y="${bannerH}" width="${W}" height="${px(8)}" fill="${ink}" />`);
  const logoSize = px(86);
  let bannerTextX = pad;
  if (plan.agencyLogoDataUri) {
    const logoY = Math.round((bannerH - logoSize - px(16)) / 2);
    parts.push(
      `<rect x="${pad}" y="${logoY}" width="${logoSize + px(16)}" height="${logoSize + px(16)}" rx="${px(10)}" fill="#ffffff" />
  <image x="${pad + px(8)}" y="${logoY + px(8)}" width="${logoSize}" height="${logoSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    bannerTextX = pad + logoSize + px(44);
  }
  const agencyFont = fitFontSize(facts.agencyName, W - bannerTextX - pad, fpx(34), fpx(18));
  parts.push(
    `<text x="${bannerTextX}" y="${bannerH / 2 - fpx(2)}" font-family="${font}" font-size="${agencyFont}" font-weight="700" fill="#ffffff">${escapeXml(facts.agencyName)}</text>
  <text x="${bannerTextX}" y="${bannerH / 2 + fpx(26)}" font-family="${font}" font-size="${fpx(18)}" letter-spacing="3" fill="#e6ecf2">OVERSEAS RECRUITMENT${facts.raLicenseId ? " · RA " + escapeXml(facts.raLicenseId) : ""}</text>`,
  );

  // Landscape: two content columns under the banner; portrait: one flow.
  const colW = isLandscape ? Math.round((W - pad * 3) / 2) : W - pad * 2;
  const leftX = pad;
  const rightX = isLandscape ? pad * 2 + colW : pad;

  let y = bannerH + px(56);

  // --- Headline + country chip ---
  const headline = fitWrappedText(facts.header, colW, fpx(50), fpx(26), 2);
  for (const line of headline.lines) {
    y += Math.round(headline.fontSize * 1.15);
    parts.push(
      `<text x="${leftX}" y="${y}" font-family="${font}" font-size="${headline.fontSize}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
    );
  }
  y += px(24);
  const chipText = `${facts.country.toUpperCase()}  ·  ${facts.industry.toUpperCase()}`;
  const chipFont = fitFontSize(chipText, colW - px(40), fpx(20), fpx(11));
  const chipW = Math.round(chipText.length * chipFont * 0.62) + px(40);
  const chipH = px(44);
  parts.push(
    `<rect x="${leftX}" y="${y}" width="${chipW}" height="${chipH}" rx="${px(6)}" fill="${accent}" />
  <text x="${leftX + chipW / 2}" y="${y + chipH / 2 + chipFont * 0.36}" text-anchor="middle" font-family="${font}" font-size="${chipFont}" font-weight="700" fill="#ffffff">${escapeXml(chipText)}</text>`,
  );
  if (facts.employer) {
    parts.push(
      `<text x="${leftX}" y="${y + chipH + fpx(30)}" font-family="${font}" font-size="${fpx(20)}" fill="#4a5561">Project client: ${escapeXml(facts.employer)}</text>`,
    );
    y += fpx(34);
  }
  y += chipH + px(40);

  // --- OPEN POSITIONS card ---
  const rowH = px(46);
  const cardPad = px(24);
  const posCardH = cardPad * 2 + px(34) + facts.positions.length * rowH;
  parts.push(
    `<rect x="${leftX}" y="${y}" width="${colW}" height="${posCardH}" rx="${px(12)}" fill="${cardFill}" />
  <rect x="${leftX}" y="${y}" width="${px(8)}" height="${posCardH}" rx="${px(4)}" fill="${accent}" />
  <text x="${leftX + cardPad + px(6)}" y="${y + cardPad + fpx(8)}" font-family="${font}" font-size="${fpx(22)}" font-weight="700" letter-spacing="2" fill="${accent}">OPEN POSITIONS</text>`,
  );
  let py = y + cardPad + px(34);
  facts.positions.forEach((p, i) => {
    const title = p.experience ? `${p.title} — ${p.experience}` : p.title;
    const size = fitFontSize(title, colW - cardPad * 2 - px(90), fpx(24), fpx(13));
    parts.push(
      `<text x="${leftX + cardPad + px(6)}" y="${py + rowH / 2 + size * 0.36}" font-family="${font}" font-size="${fpx(20)}" font-weight="700" fill="${accent}">${String(i + 1).padStart(2, "0")}</text>
  <text x="${leftX + cardPad + px(48)}" y="${py + rowH / 2 + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(title)}</text>`,
    );
    if (p.count) {
      parts.push(
        `<text x="${leftX + colW - cardPad}" y="${py + rowH / 2 + fpx(7)}" text-anchor="end" font-family="${font}" font-size="${fpx(20)}" font-weight="700" fill="${accent}">× ${p.count}</text>`,
      );
    }
    if (i < facts.positions.length - 1) {
      parts.push(
        `<line x1="${leftX + cardPad}" y1="${py + rowH}" x2="${leftX + colW - cardPad}" y2="${py + rowH}" stroke="#dde3e9" stroke-width="1" />`,
      );
    }
    py += rowH;
  });
  const leftAfterPositions = y + posCardH + px(28);

  // --- Right/next column: benefits card, footer note, interview ---
  let ry = isLandscape ? bannerH + px(56) : leftAfterPositions;

  if (facts.benefits.length > 0) {
    const bRowH = px(44);
    const benCardH = cardPad * 2 + px(34) + facts.benefits.length * bRowH - px(10);
    parts.push(
      `<rect x="${rightX}" y="${ry}" width="${colW}" height="${benCardH}" rx="${px(12)}" fill="${cardFill}" />
  <rect x="${rightX}" y="${ry}" width="${px(8)}" height="${benCardH}" rx="${px(4)}" fill="${accent}" />
  <text x="${rightX + cardPad + px(6)}" y="${ry + cardPad + fpx(8)}" font-family="${font}" font-size="${fpx(22)}" font-weight="700" letter-spacing="2" fill="${accent}">BENEFITS</text>`,
    );
    let by = ry + cardPad + px(38);
    for (const b of facts.benefits) {
      const line = formatBenefitLine(b);
      const size = fitFontSize(line, colW - cardPad * 2 - px(48), fpx(22), fpx(13));
      parts.push(
        `${checkIcon(rightX + cardPad + px(4), by - fpx(2), fpx(22), accent)}
  <text x="${rightX + cardPad + px(40)}" y="${by + fpx(14)}" font-family="${font}" font-size="${size}" font-weight="600" fill="${ink}">${escapeXml(line)}</text>`,
      );
      by += bRowH;
    }
    ry += benCardH + px(28);
  }

  if (facts.footer) {
    const note = fitWrappedText(facts.footer, colW, fpx(19), fpx(12), 2);
    for (const line of note.lines) {
      ry += Math.round(note.fontSize * 1.35);
      parts.push(
        `<text x="${rightX}" y="${ry}" font-family="${font}" font-size="${note.fontSize}" fill="#4a5561">${escapeXml(line)}</text>`,
      );
    }
    ry += px(20);
  }

  if (facts.interview.length > 0) {
    parts.push(
      `<text x="${rightX}" y="${ry + fpx(18)}" font-family="${font}" font-size="${fpx(20)}" font-weight="700" letter-spacing="2" fill="${accent}">INTERVIEW SCHEDULE</text>`,
    );
    ry += px(32);
    const cols = Math.min(facts.interview.length, 2);
    const gap = px(16);
    const boxW = (colW - gap * (cols - 1)) / cols;
    const boxH = px(70);
    facts.interview.forEach((event, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = rightX + col * (boxW + gap);
      const byy = ry + row * (boxH + gap);
      const line = formatInterviewLine(event);
      const size = fitFontSize(line, boxW - px(24), fpx(20), fpx(11));
      parts.push(
        `<rect x="${bx}" y="${byy}" width="${boxW}" height="${boxH}" rx="${px(10)}" fill="#ffffff" stroke="${accent}" stroke-width="2" />
  <text x="${bx + boxW / 2}" y="${byy + boxH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
      );
    });
  }

  // --- Bottom CTA bar with integrated verification panel ---
  const barH = px(150);
  const barY = H - barH;
  parts.push(`<rect x="0" y="${barY}" width="${W}" height="${barH}" fill="${ink}" />
  <rect x="0" y="${barY}" width="${W}" height="${px(8)}" fill="${accent}" />`);

  const panelProbe = verificationPanel({
    x: 0,
    y: barY + Math.round((barH - px(108)) / 2) + px(4),
    height: px(108),
    qrDataUri: plan.qrDataUri,
    raLicenseId: facts.raLicenseId,
    fontFamily: font,
    captionColor: "#ffffff",
    accentColor: accent,
  });
  const panelX = W - pad - panelProbe.width;
  parts.push(
    verificationPanel({
      x: panelX,
      y: barY + Math.round((barH - px(108)) / 2) + px(4),
      height: px(108),
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: "#ffffff",
      accentColor: accent,
    }).svg,
  );

  const { primary, secondary } = contactParts(facts.contact);
  const ctaW = panelX - pad - px(24);
  if (primary) {
    const size = fitFontSize(primary, ctaW - px(46), fpx(32), fpx(15));
    parts.push(
      `${phoneIcon(pad, barY + barH / 2 - fpx(28), fpx(30), accent)}
  <text x="${pad + px(44)}" y="${barY + barH / 2 - fpx(4)}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(primary)}</text>`,
    );
  }
  if (secondary) {
    const size = fitFontSize(secondary, ctaW - px(46), fpx(20), fpx(12));
    parts.push(
      `${mailIcon(pad, barY + barH / 2 + fpx(8), fpx(24), accent)}
  <text x="${pad + px(44)}" y="${barY + barH / 2 + fpx(26)}" font-family="${font}" font-size="${size}" fill="#dfe6ec">${escapeXml(secondary)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${parts.join("\n  ")}
</svg>`;
}
