/**
 * DTP ADVERTISEMENT BLOCK — one classified advertisement.
 *
 * Measure, then draw. The block reports the exact height its content
 * needs, and the page compositor packs from that number; nothing is
 * placed against a reserved or nominal height. That is the whole reason
 * this renderer exists separately: a classified block must close up
 * around whatever facts it actually holds.
 *
 * SPACE COLLAPSING (spec §17) is structural here rather than a rule
 * applied afterwards: each section is emitted by a function that
 * returns zero lines when its fact is absent, so an advertisement with
 * no salary, no benefits, no logo and no QR simply has no salary,
 * benefit, logo or QR geometry — not an empty allocation.
 *
 * Identity (spec §5, §21): the tenant's mark, a client's mark and KAI's
 * verification are separate inputs with separate slots, resolved
 * through the existing brand-identity guards. This renderer weakens
 * none of that.
 */
import { resolveSlotImage, type BrandAsset } from "@/lib/brand-identity";
import {
  DTP_TYPE,
  dtpFamily,
  dtpLineHeight,
  dtpSize,
  dtpText,
  dtpTextWidth,
  dtpWrap,
  type DtpToken,
} from "./dtp-typography";

export interface DtpTenantIdentity {
  /** Agency name — required; a classified without an advertiser is not publishable. */
  name: string;
  registrationText?: string | null;
  /** Tenant's own primary mark. Never a client's. */
  logo?: BrandAsset | null;
}

export interface DtpClientIdentity {
  /** Hiring company name, when the requirement names one. */
  name?: string | null;
  /** Client mark — artwork identity, never a tenant slot. */
  logo?: BrandAsset | null;
}

export interface DtpPosition {
  title: string;
  count?: number | null;
  /** Free-form per-role detail, e.g. salary or experience. */
  detail?: string | null;
}

/**
 * One advertisement's content. Built FROM the existing verified fact
 * layer by the caller — this is a presentation shape, not a second
 * vacancy schema (spec §23).
 */
export interface DtpAdvertisement {
  /** The headline bar: destination, or the campaign's own hook. */
  headline: string;
  /** Project / sector line under the bar. */
  subhead?: string | null;
  urgency?: string | null;
  tenant: DtpTenantIdentity;
  client?: DtpClientIdentity | null;
  positions: DtpPosition[];
  salary?: string | null;
  eligibility?: string[];
  benefits?: string[];
  interview?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  applicationNote?: string | null;
  /** KAI verification QR — KAI's own identity, never the tenant's. */
  verificationQr?: BrandAsset | null;
  /** Accent for this block only. Never leaks to the page (spec §12). */
  accent?: string | null;
}

export const DTP_INK = "#111111";
export const DTP_PAPER = "#FFFFFF";
export const DTP_RULE = "#111111";

/** Padding inside a block, proportional to the column. */
const PAD_RATIO = 0.026;
/** Gap between sections inside a block. */
const SECTION_GAP_RATIO = 0.018;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface Line {
  token: DtpToken;
  text: string;
  colour?: string;
  /** Right-aligned trailing text (the count in a position row). */
  trailing?: string;
  /** Draw dot leaders between text and trailing, newspaper style. */
  leaders?: boolean;
}

/**
 * The block's content as a flat list of measured lines, in draw order.
 * Every section contributes zero lines when its fact is missing.
 */
function contentLines(ad: DtpAdvertisement, colW: number): Line[] {
  const lines: Line[] = [];
  const inner = colW - Math.round(colW * PAD_RATIO) * 2;

  if (ad.urgency) {
    for (const l of dtpWrap(ad.urgency, "DTP_LABEL", inner, colW)) {
      lines.push({ token: "DTP_LABEL", text: l, colour: ad.accent ?? DTP_INK });
    }
  }

  // Advertiser, then the hiring company when one is named. Two
  // different parties, two different lines — never merged.
  //
  // Wrapped, not shrunk and never truncated: an agency's registered
  // name and a client's are legal identities, and a classified column
  // is narrow enough that long ones are ordinary rather than
  // exceptional.
  for (const l of dtpWrap(ad.tenant.name, "DTP_SUBHEAD", inner, colW)) {
    lines.push({ token: "DTP_SUBHEAD", text: l });
  }
  if (ad.client?.name) {
    for (const l of dtpWrap(`Client: ${ad.client.name}`, "DTP_BODY", inner, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }

  if (ad.subhead) {
    for (const l of dtpWrap(ad.subhead, "DTP_SUBHEAD", inner, colW)) {
      lines.push({ token: "DTP_SUBHEAD", text: l });
    }
  }

  for (const p of ad.positions) {
    // The count sits at the right edge with dot leaders between, so the
    // title wraps against the width the leaders leave it, not the full
    // column. A long designation therefore takes a second line instead
    // of running under (or through) its own count.
    const countText = typeof p.count === "number" ? String(p.count) : undefined;
    const countW = countText ? dtpTextWidth(countText, "DTP_NUMBER", colW) + 14 : 0;
    const titleLines = dtpWrap(p.title, "DTP_NUMBER", inner - countW, colW);
    titleLines.forEach((line, i) => {
      const last = i === titleLines.length - 1;
      lines.push({
        token: "DTP_NUMBER",
        text: line,
        // The count belongs to the row, so it rides the final line of a
        // wrapped title rather than floating beside the first.
        trailing: last ? countText : undefined,
        leaders: last && Boolean(countText),
      });
    });
    if (p.detail) {
      for (const l of dtpWrap(p.detail, "DTP_BODY", inner, colW)) {
        lines.push({ token: "DTP_BODY", text: l });
      }
    }
  }

  if (ad.salary) {
    for (const l of dtpWrap(ad.salary, "DTP_PRICE", inner, colW)) {
      lines.push({ token: "DTP_PRICE", text: l, colour: ad.accent ?? DTP_INK });
    }
  }

  for (const item of ad.eligibility ?? []) {
    for (const l of dtpWrap(item, "DTP_BODY", inner, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }

  if ((ad.benefits ?? []).length > 0) {
    for (const l of dtpWrap((ad.benefits ?? []).join(" • "), "DTP_BODY", inner, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }

  if (ad.interview) {
    for (const l of dtpWrap(ad.interview, "DTP_LABEL", inner, colW)) {
      lines.push({ token: "DTP_LABEL", text: l });
    }
  }

  if (ad.applicationNote) {
    for (const l of dtpWrap(ad.applicationNote, "DTP_BODY", inner, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }

  if (ad.contactPhone) {
    for (const l of dtpWrap(ad.contactPhone, "DTP_CONTACT", inner, colW)) {
      lines.push({ token: "DTP_CONTACT", text: l });
    }
  }
  if (ad.contactEmail) {
    for (const l of dtpWrap(ad.contactEmail, "DTP_BODY", inner, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }
  if (ad.website) {
    for (const l of dtpWrap(ad.website, "DTP_BODY", inner, colW)) {
      lines.push({ token: "DTP_BODY", text: l });
    }
  }
  if (ad.tenant.registrationText) {
    for (const l of dtpWrap(ad.tenant.registrationText, "DTP_LEGAL", inner, colW)) {
      lines.push({ token: "DTP_LEGAL", text: l });
    }
  }

  return lines;
}

export interface DtpBlockMeasurement {
  /** The height the block occupies — content, or the minimum slot. */
  heightPx: number;
  /** What the content alone needed, before the minimum slot was applied. */
  contentHeightPx: number;
  headlineBarH: number;
  logoH: number;
  qrH: number;
  lines: Line[];
}

/** Height of the identity strip (logo and/or QR), zero when neither exists. */
function assetHeights(ad: DtpAdvertisement, colW: number): { logoH: number; qrH: number } {
  // No asset, no allocation (spec §16/§17).
  const logoH = ad.tenant.logo ? Math.round(colW * 0.15) : 0;
  const qrH = ad.verificationQr ? Math.round(colW * 0.19) : 0;
  return { logoH, qrH };
}

/**
 * Measures the block, floored at the minimum saleable advertisement.
 *
 * `minHeightPx` is NOT a reserved box, and flooring to it is not a
 * retreat from the space-collapsing rule. The two answer different
 * questions: collapsing decides how much room the CONTENT takes, and
 * the floor states how much room the ADVERTISER BOUGHT. Assignments
 * Abroad Times sells appointment advertisements in fixed physical
 * slots whose smallest unit is 6cm x 8cm, so a two-line classified
 * still occupies 8cm of column — the space is paid for, not wasted.
 *
 * The distinction matters in both directions: content still collapses
 * inside the block (an absent logo or salary adds nothing), and a block
 * whose content exceeds 8cm still grows to hold it. What can never
 * happen is a block SMALLER than the minimum slot, which would be
 * unsaleable — and which is what this renderer produced before the
 * minimum was applied.
 */
export function measureDtpBlock(
  ad: DtpAdvertisement,
  colW: number,
  minHeightPx = 0,
): DtpBlockMeasurement {
  const pad = Math.round(colW * PAD_RATIO);
  const gap = Math.round(colW * SECTION_GAP_RATIO);
  const inner = colW - pad * 2;

  const headlineLines = dtpWrap(ad.headline, "DTP_HEADLINE", inner, colW);
  const headlineBarH =
    headlineLines.length * dtpLineHeight("DTP_HEADLINE", colW) + Math.round(pad * 1.1);

  const { logoH, qrH } = assetHeights(ad, colW);
  const lines = contentLines(ad, colW);
  const bodyH = lines.reduce((sum, l) => sum + dtpLineHeight(l.token, colW), 0);

  const assetStrip = logoH > 0 || qrH > 0 ? Math.max(logoH, qrH) + gap : 0;

  const contentHeight = headlineBarH + pad + bodyH + assetStrip + pad;
  const heightPx = Math.max(contentHeight, minHeightPx);
  return { heightPx, contentHeightPx: contentHeight, headlineBarH, logoH, qrH, lines };
}

/**
 * Draws the block as SVG at (x, y). The caller has already reserved
 * exactly `measureDtpBlock(...).heightPx`, so nothing here may exceed
 * it — measurement and drawing walk the same line list.
 */
export function renderDtpBlock(
  ad: DtpAdvertisement,
  x: number,
  y: number,
  colW: number,
  measurement: DtpBlockMeasurement,
): string {
  const pad = Math.round(colW * PAD_RATIO);
  const inner = colW - pad * 2;
  const parts: string[] = [];
  const accent = ad.accent ?? DTP_INK;

  // Block border — the hairline box a classified sits in.
  parts.push(
    `<rect x="${x}" y="${y}" width="${colW}" height="${measurement.heightPx}" fill="${DTP_PAPER}" stroke="${DTP_RULE}" stroke-width="2"/>`,
  );

  // Headline bar, hugging its text (spec §13).
  const headlineLines = dtpWrap(ad.headline, "DTP_HEADLINE", inner, colW);
  parts.push(
    `<rect x="${x}" y="${y}" width="${colW}" height="${measurement.headlineBarH}" fill="${accent}"/>`,
  );
  const hlSize = dtpSize("DTP_HEADLINE", colW);
  const hlLead = dtpLineHeight("DTP_HEADLINE", colW);
  let hy = y + Math.round(pad * 0.55) + hlSize * 0.86;
  for (const line of headlineLines) {
    parts.push(
      `<text x="${x + pad}" y="${Math.round(hy)}" font-family="${dtpFamily("DTP_HEADLINE")}" ` +
        `font-size="${hlSize}" font-weight="${DTP_TYPE.DTP_HEADLINE.weight}" ` +
        `letter-spacing="${DTP_TYPE.DTP_HEADLINE.tracking}" fill="${DTP_PAPER}">${esc(dtpText(line, "DTP_HEADLINE"))}</text>`,
    );
    hy += hlLead;
  }

  // Body lines, LED OUT to fill the purchased slot.
  //
  // A minimum booking is 6cm x 8cm whether or not the advertiser's copy
  // fills it, and most classifieds do not: three trades and a phone
  // number need about 2.5cm. Setting that copy tight at the top would
  // leave 5cm of white inside a block the advertiser paid for, which
  // reads as an unfinished advertisement.
  //
  // Newspaper compositors answer this by "leading out" — distributing
  // the surplus into the spaces between lines so the copy occupies its
  // slot evenly. That is what happens here, and it is the opposite of
  // the poster renderer's old defect: there a FIXED slab was too tall
  // for its content and the fix was to shrink the container; here the
  // container is a fixed, purchased size that cannot shrink, so the
  // content is spread to meet it.
  //
  // The extra per line is capped, so a nearly empty block does not
  // become absurdly airy; whatever remains after the cap sits below the
  // copy rather than stretching it further.
  const surplus = Math.max(0, measurement.heightPx - measurement.contentHeightPx);
  const gaps = Math.max(1, measurement.lines.length - 1);
  const maxExtraPerLine = Math.round(colW * 0.045);
  const extraPerLine = Math.min(maxExtraPerLine, Math.floor(surplus / gaps));

  let cy = y + measurement.headlineBarH + pad;
  for (const line of measurement.lines) {
    const size = dtpSize(line.token, colW);
    const lead = dtpLineHeight(line.token, colW);
    const spec = DTP_TYPE[line.token];
    const baseline = Math.round(cy + size * 0.84);
    const text = dtpText(line.text, line.token);

    parts.push(
      `<text x="${x + pad}" y="${baseline}" font-family="${dtpFamily(line.token)}" font-size="${size}" ` +
        `font-weight="${spec.weight}" letter-spacing="${spec.tracking}" fill="${line.colour ?? DTP_INK}">${esc(text)}</text>`,
    );

    if (line.trailing) {
      const trailW = dtpTextWidth(line.trailing, line.token, colW);
      parts.push(
        `<text x="${x + colW - pad}" y="${baseline}" font-family="${dtpFamily(line.token)}" font-size="${size}" ` +
          `font-weight="${spec.weight}" text-anchor="end" fill="${line.colour ?? DTP_INK}">${esc(line.trailing)}</text>`,
      );
      if (line.leaders) {
        // Dot leaders, the classified convention for aligning counts.
        const from = x + pad + dtpTextWidth(text, line.token, colW) + 6;
        const to = x + colW - pad - trailW - 6;
        if (to > from) {
          parts.push(
            `<line x1="${Math.round(from)}" y1="${baseline - Math.round(size * 0.22)}" x2="${Math.round(to)}" ` +
              `y2="${baseline - Math.round(size * 0.22)}" stroke="${DTP_INK}" stroke-width="1" ` +
              `stroke-dasharray="2 4" opacity="0.55"/>`,
          );
        }
      }
    }
    cy += lead + extraPerLine;
  }

  // Identity strip: tenant mark left, KAI verification right. Drawn
  // only for assets that exist, so an absent one costs no geometry.
  if (measurement.logoH > 0 || measurement.qrH > 0) {
    const stripTop = y + measurement.heightPx - pad - Math.max(measurement.logoH, measurement.qrH);

    if (measurement.logoH > 0) {
      const logoPng = resolveSlotImage(
        "The DTP block's tenant logo slot",
        ["TENANT_PRIMARY_LOGO"],
        ad.tenant.logo,
      );
      if (logoPng) {
        const w = Math.round(measurement.logoH * 1.6);
        parts.push(
          `<image href="data:image/png;base64,${logoPng.toString("base64")}" x="${x + pad}" y="${stripTop}" ` +
            `width="${w}" height="${measurement.logoH}" preserveAspectRatio="xMidYMid meet"/>`,
        );
      }
    }

    if (measurement.qrH > 0) {
      const qrPng = resolveSlotImage(
        "The DTP block's verification QR slot",
        ["KAI_VERIFICATION_QR"],
        ad.verificationQr,
      );
      if (qrPng) {
        parts.push(
          `<image href="data:image/png;base64,${qrPng.toString("base64")}" ` +
            `x="${x + colW - pad - measurement.qrH}" y="${stripTop}" width="${measurement.qrH}" ` +
            `height="${measurement.qrH}" preserveAspectRatio="xMidYMid meet"/>`,
        );
      }
    }
  }

  return parts.join("");
}
