import { buildEmbeddedFontStyleBlock, KAI_SANS_FONT_FAMILY } from "../embedded-fonts";
import type { CompositionInput } from "./types";
import {
  checkIcon,
  contactParts,
  escapeXml,
  fitFontSize,
  formatBenefitLine,
  formatInterviewLine,
  makeScalers,
  phoneIcon,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 3 — HIGH-DENSITY RECRUITMENT.
 *
 * Reference grammar (Romania high-density ad, UAE construction table ad):
 * built around a vacancy TABLE, not cards — an accent header row
 * ("POSITION / VACANCIES / EXPERIENCE"), alternating-row striping, tight
 * line height, a compact benefits strip, an interview row, and a slim
 * contact bar with the integrated KAI verification panel. Row height
 * adapts to position count so 20-30 rows stay readable instead of
 * overflowing. On landscape canvases the table splits into two columns.
 */
export function renderHighDensity(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SANS_FONT_FAMILY;
  const accent = plan.accentColor === "#1a1a1a" ? "#0d4f8b" : plan.accentColor;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const pad = px(48);
  const ink = "#141c24";

  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff" />`];

  // --- Slim identity strip ---
  const stripH = px(96);
  parts.push(`<rect x="0" y="0" width="${W}" height="${stripH}" fill="${accent}" />`);
  const logoSize = px(60);
  let stripX = pad;
  if (plan.agencyLogoDataUri) {
    parts.push(
      `<rect x="${pad}" y="${Math.round((stripH - logoSize - px(10)) / 2)}" width="${logoSize + px(10)}" height="${logoSize + px(10)}" rx="${px(8)}" fill="#ffffff" />
  <image x="${pad + px(5)}" y="${Math.round((stripH - logoSize) / 2)}" width="${logoSize}" height="${logoSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    stripX = pad + logoSize + px(34);
  }
  const stripText = `${facts.agencyName}${facts.raLicenseId ? "  ·  RA " + facts.raLicenseId : ""}`;
  parts.push(
    `<text x="${stripX}" y="${stripH / 2 + fpx(8)}" font-family="${font}" font-size="${fitFontSize(stripText, W - stripX - pad, fpx(24), fpx(13))}" font-weight="700" fill="#ffffff">${escapeXml(stripText)}</text>`,
  );

  // --- Headline band ---
  let y = stripH + px(52);
  const headlineSize = fitFontSize(facts.header, W - pad * 2, fpx(44), fpx(20));
  parts.push(
    `<text x="${pad}" y="${y}" font-family="${font}" font-size="${headlineSize}" font-weight="700" fill="${ink}">${escapeXml(facts.header)}</text>`,
  );
  y += px(34);
  const subline = `${facts.country.toUpperCase()} · ${facts.industry}${facts.employer ? " · " + facts.employer : ""}`;
  parts.push(
    `<text x="${pad}" y="${y}" font-family="${font}" font-size="${fitFontSize(subline, W - pad * 2, fpx(22), fpx(12))}" font-weight="600" fill="${accent}">${escapeXml(subline)}</text>`,
  );
  y += px(30);

  // --- Vacancy table ---
  const tableCols = isLandscape && facts.positions.length > 4 ? 2 : 1;
  const colGap = px(32);
  const tableW = Math.round((W - pad * 2 - colGap * (tableCols - 1)) / tableCols);
  const rowsPerCol = Math.ceil(facts.positions.length / tableCols);

  // Reserve space below the table for strips + bar, then adapt row height.
  const benefitsStripH = facts.benefits.length > 0 ? px(64) : 0;
  const footerNoteH = facts.footer ? px(40) : 0;
  const interviewH = facts.interview.length > 0 ? px(96) : 0;
  const barH = px(132);
  const headerRowH = px(48);
  const availableTableH = H - y - benefitsStripH - footerNoteH - interviewH - barH - px(90);
  // Row height adapts BOTH ways: 20-30 rows compress toward the px(30)
  // floor; a medium requirement (e.g. 5 rows) expands toward the px(96)
  // ceiling so the table owns the canvas instead of leaving a void above
  // the contact bar.
  const rowH = Math.max(px(30), Math.min(px(96), Math.floor((availableTableH - headerRowH) / Math.max(rowsPerCol, 1))));

  const hasCounts = facts.positions.some((p) => p.count);
  const hasExp = facts.positions.some((p) => p.experience);
  const countColW = hasCounts ? px(120) : 0;

  // Distribute whatever vertical space the capped table couldn't absorb
  // across the section gaps below it, so a medium-count requirement never
  // pools empty canvas above the contact bar.
  const interviewRows = facts.interview.length > 0 ? Math.ceil(facts.interview.length / 2) : 0;
  const interviewActualH = facts.interview.length > 0 ? px(26) + interviewRows * (px(54) + px(14)) : 0;
  const tableActualH = headerRowH + rowsPerCol * rowH;
  const leftoverBelowTable =
    H - y - tableActualH - benefitsStripH - footerNoteH - interviewActualH - barH - px(70);
  const sectionGap = Math.max(px(20), Math.min(px(110), Math.floor(leftoverBelowTable / 3)));

  for (let c = 0; c < tableCols; c++) {
    const tx = pad + c * (tableW + colGap);
    parts.push(
      `<rect x="${tx}" y="${y}" width="${tableW}" height="${headerRowH}" fill="${ink}" />
  <text x="${tx + px(16)}" y="${y + headerRowH / 2 + fpx(7)}" font-family="${font}" font-size="${fpx(19)}" font-weight="700" letter-spacing="2" fill="#ffffff">POSITION${hasExp ? " / EXPERIENCE" : ""}</text>
  ${hasCounts ? `<text x="${tx + tableW - px(16)}" y="${y + headerRowH / 2 + fpx(7)}" text-anchor="end" font-family="${font}" font-size="${fpx(19)}" font-weight="700" letter-spacing="2" fill="#ffffff">NOS</text>` : ""}`,
    );
    const colPositions = facts.positions.slice(c * rowsPerCol, (c + 1) * rowsPerCol);
    colPositions.forEach((p, i) => {
      const ry = y + headerRowH + i * rowH;
      const title = p.experience ? `${p.title} — ${p.experience}` : p.title;
      const size = fitFontSize(title, tableW - px(32) - countColW, fpx(22), fpx(11));
      parts.push(
        `<rect x="${tx}" y="${ry}" width="${tableW}" height="${rowH}" fill="${i % 2 === 0 ? "#f2f5f8" : "#ffffff"}" />
  <text x="${tx + px(16)}" y="${ry + rowH / 2 + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="600" fill="${ink}">${escapeXml(title)}</text>
  ${p.count ? `<text x="${tx + tableW - px(16)}" y="${ry + rowH / 2 + fpx(7)}" text-anchor="end" font-family="${font}" font-size="${fpx(20)}" font-weight="700" fill="${accent}">${p.count}</text>` : ""}`,
      );
    });
    parts.push(
      `<rect x="${tx}" y="${y}" width="${tableW}" height="${headerRowH + colPositions.length * rowH}" fill="none" stroke="${ink}" stroke-width="2" />`,
    );
  }
  y += headerRowH + rowsPerCol * rowH + sectionGap;

  // --- Benefits strip ---
  if (facts.benefits.length > 0) {
    parts.push(
      `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${benefitsStripH}" rx="${px(8)}" fill="${accent}" fill-opacity="0.1" stroke="${accent}" stroke-width="1.5" />`,
    );
    let bx = pad + px(20);
    const by = y + benefitsStripH / 2;
    for (const b of facts.benefits) {
      const line = formatBenefitLine(b);
      const size = fitFontSize(line, W - pad * 2 - px(80), fpx(21), fpx(12));
      parts.push(
        `${checkIcon(bx, by - fpx(11), fpx(20), accent)}
  <text x="${bx + px(30)}" y="${by + size * 0.36}" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
      );
      bx += px(34) + line.length * size * 0.58 + px(30);
    }
    y += benefitsStripH + Math.round(sectionGap / 2);
  }

  // --- Grounded footer note ---
  if (facts.footer) {
    const size = fitFontSize(facts.footer, W - pad * 2, fpx(19), fpx(11));
    parts.push(
      `<text x="${pad}" y="${y + fpx(6)}" font-family="${font}" font-size="${size}" fill="#43505c">${escapeXml(facts.footer)}</text>`,
    );
    y += footerNoteH + Math.round(sectionGap / 2);
  }

  // --- Interview row ---
  if (facts.interview.length > 0) {
    parts.push(
      `<text x="${pad}" y="${y + fpx(16)}" font-family="${font}" font-size="${fpx(18)}" font-weight="700" letter-spacing="2" fill="${accent}">INTERVIEW</text>`,
    );
    const cols = Math.min(facts.interview.length, 2);
    const gap = px(14);
    const boxW = (W - pad * 2 - gap * (cols - 1)) / cols;
    const boxH = px(54);
    const boxTop = y + px(26);
    facts.interview.forEach((event, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = pad + col * (boxW + gap);
      const byy = boxTop + row * (boxH + gap);
      const line = formatInterviewLine(event);
      const size = fitFontSize(line, boxW - px(20), fpx(19), fpx(11));
      parts.push(
        `<rect x="${bx}" y="${byy}" width="${boxW}" height="${boxH}" rx="${px(8)}" fill="#ffffff" stroke="${ink}" stroke-width="1.5" />
  <text x="${bx + boxW / 2}" y="${byy + boxH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
      );
    });
  }

  // --- Contact bar + verification panel ---
  const barY = H - barH;
  parts.push(`<rect x="0" y="${barY}" width="${W}" height="${barH}" fill="${ink}" />`);
  const panelProbe = verificationPanel({
    x: 0,
    y: barY + Math.round((barH - px(96)) / 2),
    height: px(96),
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
      y: barY + Math.round((barH - px(96)) / 2),
      height: px(96),
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: "#ffffff",
      accentColor: accent,
    }).svg,
  );
  const { primary, secondary } = contactParts(facts.contact);
  const ctaW = panelX - pad - px(20);
  if (primary) {
    const size = fitFontSize(primary, ctaW - px(40), fpx(30), fpx(14));
    parts.push(
      `${phoneIcon(pad, barY + barH / 2 - fpx(26), fpx(28), accent)}
  <text x="${pad + px(40)}" y="${barY + barH / 2 - fpx(2)}" font-family="${font}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(primary)}</text>`,
    );
  }
  if (secondary) {
    const size = fitFontSize(secondary, ctaW, fpx(19), fpx(11));
    parts.push(
      `<text x="${pad + px(40)}" y="${barY + barH / 2 + fpx(24)}" font-family="${font}" font-size="${size}" fill="#cfd8e0">${escapeXml(secondary)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${parts.join("\n  ")}
</svg>`;
}
