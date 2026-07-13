import { buildEmbeddedFontStyleBlock, KAI_SERIF_FONT_FAMILY } from "../embedded-fonts";
import type { CompositionInput } from "./types";
import {
  clampTuning,
  checkIcon,
  contactParts,
  escapeXml,
  fitFontSize,
  fitWrappedText,
  formatBenefitLine,
  formatInterviewLine,
  makeScalers,
  verificationPanel,
} from "./composition-shared";

/**
 * ARCHETYPE 4 — DTP / NEWSPAPER.
 *
 * Reference grammar (Al-Yousuf KSA WPR ad, Romania newspaper ad): the
 * traditional overseas-recruitment print form — a heavy double border,
 * serif typography, centered composition, "REQUIRED FOR <COUNTRY>"
 * headline treatment, a ruled positions box, dense centered benefit and
 * requirement lines, bordered interview boxes, a bold centered contact
 * line, and — always — the FULL official RC number in small print at the
 * very bottom. Minimal imagery by design; the KAI verification QR sits
 * inside the bottom band with its caption, aligned into the composition.
 */
export function renderDtpNewspaper(input: CompositionInput): string {
  const { facts, plan } = input;
  const fmt = plan.platformFormat;
  const { px, fpx, isLandscape } = makeScalers(fmt);
  const font = KAI_SERIF_FONT_FAMILY;
  const accent = plan.accentColor === "#1a1a1a" ? "#111111" : plan.accentColor;
  const W = fmt.widthPx;
  const H = fmt.heightPx;
  const margin = px(28);
  const pad = px(64);
  const ink = "#111111";
  const centerX = W / 2;

  const parts: string[] = [
    `<rect width="${W}" height="${H}" fill="#fdfcf8" />`,
    // Double newspaper border
    `<rect x="${margin}" y="${margin}" width="${W - margin * 2}" height="${H - margin * 2}" fill="none" stroke="${ink}" stroke-width="4" />
  <rect x="${margin + px(10)}" y="${margin + px(10)}" width="${W - (margin + px(10)) * 2}" height="${H - (margin + px(10)) * 2}" fill="none" stroke="${ink}" stroke-width="1.5" />`,
  ];

  const contentW = isLandscape ? Math.round(W * 0.5) - pad : W - pad * 2;
  const colCenterX = isLandscape ? pad + contentW / 2 : centerX;
  let y = margin + px(56);

  // --- Masthead: agency name, centered ---
  const logoSize = px(56);
  if (plan.agencyLogoDataUri) {
    parts.push(
      `<image x="${colCenterX - logoSize / 2}" y="${y - px(12)}" width="${logoSize}" height="${logoSize}" href="${plan.agencyLogoDataUri}" preserveAspectRatio="xMidYMid meet" />`,
    );
    y += logoSize + px(8);
  }
  const agencySize = fitFontSize(facts.agencyName.toUpperCase(), contentW, fpx(34), fpx(16));
  parts.push(
    `<text x="${colCenterX}" y="${y + fpx(16)}" text-anchor="middle" font-family="${font}" font-size="${agencySize}" font-weight="700" letter-spacing="3" fill="${ink}">${escapeXml(facts.agencyName.toUpperCase())}</text>`,
  );
  y += px(44);
  parts.push(
    `<line x1="${colCenterX - contentW / 2}" y1="${y}" x2="${colCenterX + contentW / 2}" y2="${y}" stroke="${ink}" stroke-width="3" />
  <line x1="${colCenterX - contentW / 2}" y1="${y + px(6)}" x2="${colCenterX + contentW / 2}" y2="${y + px(6)}" stroke="${ink}" stroke-width="1" />`,
  );
  y += px(48);

  // --- Bottom band geometry (needed by the body's spread computation) ---
  // Band/panel sized so the QR stays above the minimum reliably-decodable
  // pixel size — an 88px QR of a full tracking URL failed jsQR decoding
  // in the pipeline test; px(104) decodes.
  const bandH = px(150);
  const bandY = H - margin - px(10) - bandH;

  /**
   * Body layout, built twice: pass 1 with zero spread measures the
   * natural content height; pass 2 distributes the leftover vertical
   * space across the section gaps so the composition fills the frame
   * instead of pooling empty paper above the bottom band (the reference
   * DTP ads are dense edge to edge).
   */
  const buildBody = (startY: number, spread: number): { frags: string[]; bottom: number } => {
    const frags: string[] = [];
    let y = startY;

    // "REQUIRED FOR <COUNTRY>" treatment + headline. Deliberately NOT
    // "URGENTLY REQUIRED": urgency is a factual claim, and unless the
    // source stated it (Truth Brain), presentation may not add it.
    frags.push(
      `<text x="${colCenterX}" y="${y}" text-anchor="middle" font-family="${font}" font-size="${fpx(24)}" font-weight="700" letter-spacing="4" fill="${accent}">REQUIRED FOR ${escapeXml(facts.country.toUpperCase())}</text>`,
    );
    y += px(20);
    const headline = fitWrappedText(facts.header, contentW, Math.round(fpx(48) * clampTuning(plan.tuning?.headlineScale)), fpx(24), 2);
    for (const line of headline.lines) {
      y += Math.round(headline.fontSize * 1.2);
      frags.push(
        `<text x="${colCenterX}" y="${y}" text-anchor="middle" font-family="${font}" font-size="${headline.fontSize}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
      );
    }
    y += px(30);
    const subline = `${facts.industry}${facts.employer ? " — " + facts.employer : ""}`;
    frags.push(
      `<text x="${colCenterX}" y="${y}" text-anchor="middle" font-family="${font}" font-size="${fitFontSize(subline, contentW, fpx(22), fpx(12))}" font-style="italic" fill="#333333">${escapeXml(subline)}</text>`,
    );
    y += px(40) + spread;

    // Positions box with rules between rows
    // rowH must be identical in both passes — anything spread-dependent
    // here would grow the measured content and break the pass-1 math.
    const rowH = Math.max(px(34), Math.min(px(64), Math.floor((H * 0.42) / Math.max(facts.positions.length, 1))));
    const boxX = colCenterX - contentW / 2;
    const boxH = facts.positions.length * rowH + px(16);
    frags.push(
      `<rect x="${boxX}" y="${y}" width="${contentW}" height="${boxH}" fill="none" stroke="${ink}" stroke-width="2.5" />`,
    );
    facts.positions.forEach((p, i) => {
      const ry = y + px(8) + i * rowH;
      const title = p.experience ? `${p.title} — ${p.experience}` : p.title;
      const withCount = p.count ? `${title}   (${p.count} Nos)` : title;
      const size = fitFontSize(withCount, contentW - px(40), fpx(26), fpx(13));
      frags.push(
        `<text x="${colCenterX}" y="${ry + rowH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(withCount)}</text>`,
      );
      if (i < facts.positions.length - 1) {
        frags.push(
          `<line x1="${boxX + px(24)}" y1="${ry + rowH}" x2="${boxX + contentW - px(24)}" y2="${ry + rowH}" stroke="#999999" stroke-width="1" />`,
        );
      }
    });
    const leftBottomY = y + boxH + px(36) + spread;

    // Second column on landscape, same column on portrait
    const col2W = isLandscape ? Math.round(W * 0.5) - pad - px(20) : contentW;
    const col2CenterX = isLandscape ? W - pad - col2W / 2 : centerX;
    let cy = isLandscape ? margin + px(120) : leftBottomY;

    if (facts.benefits.length > 0) {
      for (const b of facts.benefits) {
        const line = formatBenefitLine(b);
        const size = fitFontSize(line, col2W - px(60), fpx(24), fpx(13));
        const textW = line.length * size * 0.58;
        frags.push(
          `${checkIcon(col2CenterX - textW / 2 - px(34), cy - fpx(16), fpx(22), accent)}
  <text x="${col2CenterX + px(2)}" y="${cy}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
        );
        cy += px(38);
      }
      cy += px(6) + spread;
    }

    if (facts.footer) {
      const note = fitWrappedText(facts.footer, col2W, fpx(21), fpx(12), 2);
      for (const line of note.lines) {
        frags.push(
          `<text x="${col2CenterX}" y="${cy}" text-anchor="middle" font-family="${font}" font-size="${note.fontSize}" font-style="italic" fill="#333333">${escapeXml(line)}</text>`,
        );
        cy += Math.round(note.fontSize * 1.4);
      }
      cy += px(14) + spread;
    }

    if (facts.interview.length > 0) {
      frags.push(
        `<text x="${col2CenterX}" y="${cy}" text-anchor="middle" font-family="${font}" font-size="${fpx(20)}" font-weight="700" letter-spacing="3" fill="${ink}">INTERVIEW</text>`,
      );
      cy += px(20);
      const cols = Math.min(facts.interview.length, 2);
      const gap = px(14);
      const ibW = (col2W - gap * (cols - 1)) / cols;
      const ibH = px(58);
      const startX = col2CenterX - col2W / 2;
      facts.interview.forEach((event, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = startX + col * (ibW + gap);
        const byy = cy + row * (ibH + gap);
        const line = formatInterviewLine(event);
        const size = fitFontSize(line, ibW - px(20), fpx(20), fpx(11));
        frags.push(
          `<rect x="${bx}" y="${byy}" width="${ibW}" height="${ibH}" fill="none" stroke="${ink}" stroke-width="2" />
  <text x="${bx + ibW / 2}" y="${byy + ibH / 2 + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
        );
      });
      cy += Math.ceil(facts.interview.length / cols) * (ibH + gap) + px(20) + spread;
    }

    // Contact line, bold centered
    const { primary, secondary } = contactParts(facts.contact);
    const contactLine = [primary, secondary].filter(Boolean).join("  ·  ");
    if (contactLine) {
      const size = fitFontSize(contactLine, col2W, fpx(28), fpx(13));
      frags.push(
        `<line x1="${col2CenterX - col2W / 2}" y1="${cy - px(2)}" x2="${col2CenterX + col2W / 2}" y2="${cy - px(2)}" stroke="${ink}" stroke-width="1.5" />
  <text x="${col2CenterX}" y="${cy + px(34)}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="${ink}">${escapeXml(contactLine)}</text>`,
      );
      cy += px(44);
    }

    return { frags, bottom: cy };
  };

  const probe = buildBody(y, 0);
  const leftover = bandY - px(36) - probe.bottom;
  const spread = Math.max(0, Math.min(Math.round(px(72) * clampTuning(plan.tuning?.spacingScale)), Math.floor(leftover / 5)));
  const body = spread > px(6) ? buildBody(y, spread) : probe;
  parts.push(...body.frags);
  const panelH = px(120);
  const panelProbe = verificationPanel({
    x: 0,
    y: bandY + Math.round((bandH - panelH) / 2) - px(8),
    height: panelH,
    qrDataUri: plan.qrDataUri,
    raLicenseId: facts.raLicenseId,
    fontFamily: font,
    captionColor: ink,
    accentColor: ink,
  });
  const panelX = W - margin - px(30) - panelProbe.width;
  parts.push(
    `<line x1="${margin + px(24)}" y1="${bandY}" x2="${W - margin - px(24)}" y2="${bandY}" stroke="${ink}" stroke-width="2" />`,
    verificationPanel({
      x: panelX,
      y: bandY + Math.round((bandH - panelH) / 2) - px(8),
      height: panelH,
      qrDataUri: plan.qrDataUri,
      raLicenseId: facts.raLicenseId,
      fontFamily: font,
      captionColor: ink,
      accentColor: ink,
    }).svg,
  );

  const smallPrintX = margin + px(30);
  const smallPrintW = panelX - smallPrintX - px(20);
  const rcLine = facts.fullRegistrationNumber
    ? `Regd. No. ${facts.fullRegistrationNumber}`
    : facts.raLicenseId
      ? `RA ${facts.raLicenseId}`
      : "";
  parts.push(
    `<text x="${smallPrintX}" y="${bandY + px(42)}" font-family="${font}" font-size="${fitFontSize(facts.agencyName, smallPrintW, fpx(18), fpx(10))}" font-weight="700" fill="${ink}">${escapeXml(facts.agencyName)}</text>`,
  );
  if (rcLine) {
    parts.push(
      `<text x="${smallPrintX}" y="${bandY + px(70)}" font-family="${font}" font-size="${fitFontSize(rcLine, smallPrintW, fpx(15), fpx(8))}" fill="#333333">${escapeXml(rcLine)}</text>`,
    );
  }
  parts.push(
    `<text x="${smallPrintX}" y="${bandY + px(94)}" font-family="${font}" font-size="${fpx(12)}" fill="#555555">Verify this agency by scanning the KAI QR code.</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${buildEmbeddedFontStyleBlock()}
  ${parts.join("\n  ")}
</svg>`;
}
