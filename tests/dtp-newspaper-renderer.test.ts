import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

import {
  DTP_PAGE,
  dtpColumnWidth,
  layoutDtpPage,
  renderDtpPageSvg,
  measureDtpBlock,
  renderDtpPage,
  type DtpAdvertisement,
} from "@/server/generation/dtp";
import {
  DTP_MIN_AD_WIDTH_CM,
  DTP_MIN_AD_HEIGHT_CM,
  DTP_PAGE_CM,
  DTP_AD_HEIGHTS_CM,
  type DtpAdHeightCm,
  dtpTextWidth,
  dtpSize,
  dtpFamily,
  DTP_TYPE,
  type DtpToken,
  renderDtpClassifiedSvg,
  pngIntrinsicSize,
  DtpAssetError,
  dtpPageAt,
} from "@/server/generation/dtp";
import { brandAsset, BrandIdentityViolationError } from "@/lib/brand-identity";
import { LayoutCapacityError } from "@/server/generation/pipeline/fact-layer";
import { DTP_DEFAULT_DPI, isApprovedDtpWidthPx, pxToCm } from "@/lib/dtp-format-law";

/**
 * DTP NEWSPAPER RENDERER — spec §25.
 *
 * A separate rendering mode from the locked poster renderer. These
 * tests cover the classified page's own laws: five columns, blocks
 * sized by their content, optional elements that collapse rather than
 * reserve, deterministic packing, and no overlap or clipping.
 *
 * Tenant-neutral throughout: every agency below is invented.
 */

function ad(over: Partial<DtpAdvertisement> = {}): DtpAdvertisement {
  return {
    headline: "Qatar",
    tenant: { name: "Novara HR" },
    positions: [{ title: "Pipe Fitter", count: 12 }],
    contactPhone: "+91 22 4000 1122",
    ...over,
  };
}

function page(ads: DtpAdvertisement[]) {
  return {
    masthead: { title: "Overseas Assignments", edition: "Saturday, 18 July 2026", pageLabel: "3" },
    advertisements: ads,
  };
}

const COL = dtpColumnWidth();

/**
 * A real 300x190 PNG, inline so it exists before any fixture is built.
 *
 * The identity guard only checks role, but the compositor now reads
 * intrinsic dimensions from the header to place a mark at its own
 * aspect ratio — so the Buffer.alloc(1) stand-in these fixtures used
 * is correctly refused as a corrupt asset.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAASwAAAC+CAIAAAAAxqXeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABn0lEQVR42u3TMQ0AAAgEsdeACsTgXw8TGliaVMEll+oBHkUCMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBBMqAKYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCCZUAUwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYEzgLT+pK9kfJL8wAAAABJRU5ErkJggg==",
  "base64",
);

describe("DTP-001 — five-column page geometry", () => {
  it("lays out exactly five columns that fit the page with its margins and gutters", () => {
    const layout = layoutDtpPage(page([ad()]));
    expect(layout.columnCount).toBe(5);
    const spanned =
      DTP_PAGE.marginPx * 2 + layout.columnWidthPx * 5 + DTP_PAGE.gutterPx * 4;
    expect(spanned).toBeLessThanOrEqual(DTP_PAGE.widthPx);
    // And it genuinely uses the width — not five narrow columns adrift
    // in a wide page.
    expect(spanned).toBeGreaterThan(DTP_PAGE.widthPx - 10);
  });

  it("places every column at its own deterministic x", () => {
    const many = Array.from({ length: 40 }, () => ad());
    const layout = layoutDtpPage(page(many));
    const xs = new Map<number, number>();
    for (const p of layout.placements) {
      if (xs.has(p.column)) expect(xs.get(p.column)).toBe(p.x);
      else xs.set(p.column, p.x);
    }
    expect(xs.size).toBeGreaterThan(1);
  });
});

describe("DTP-002/003/004 — block height follows content", () => {
  it("a block with more content is taller than one with less", () => {
    const short = measureDtpBlock(ad(), COL);
    const long = measureDtpBlock(
      ad({
        positions: Array.from({ length: 8 }, (_, i) => ({ title: `Trade ${i + 1}`, count: i + 2 })),
        benefits: ["Food", "Accommodation", "Transport", "Medical"],
        eligibility: ["Passport validity two years", "Gulf experience preferred"],
      }),
      COL,
    );
    expect(long.heightPx).toBeGreaterThan(short.heightPx);
  });

  it("a short advertisement collapses rather than filling a nominal box", () => {
    const short = measureDtpBlock(ad({ contactPhone: null, positions: [{ title: "Welder" }] }), COL);
    // A headline bar, an advertiser and one trade is a small classified;
    // it must measure small.
    expect(short.heightPx).toBeLessThan(COL * 0.62);
  });

  it("expands only as far as the added content requires", () => {
    const one = measureDtpBlock(ad({ positions: [{ title: "Welder", count: 5 }] }), COL);
    const two = measureDtpBlock(
      ad({ positions: [{ title: "Welder", count: 5 }, { title: "Fitter", count: 5 }] }),
      COL,
    );
    const delta = two.heightPx - one.heightPx;
    // One extra row costs about one row, not a new section.
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(COL * 0.09);
  });
});

describe("DTP-005/006 — absent elements reserve nothing", () => {
  it("no logo means no logo allocation", () => {
    const without = measureDtpBlock(ad(), COL);
    expect(without.logoH).toBe(0);
    const with_ = measureDtpBlock(
      ad({ tenant: { name: "Novara HR", logo: brandAsset("TENANT_PRIMARY_LOGO", Buffer.alloc(1)) } }),
      COL,
    );
    expect(with_.logoH).toBeGreaterThan(0);
    expect(with_.heightPx).toBeGreaterThan(without.heightPx);
  });

  it("no QR means no QR allocation", () => {
    expect(measureDtpBlock(ad(), COL).qrH).toBe(0);
  });

  for (const [label, over] of [
    ["salary", { salary: "SAR 1800 – 2600" }],
    ["benefits", { benefits: ["Food", "Accommodation"] }],
    ["interview", { interview: "Interview 24 July · Mumbai" }],
    ["registration", { tenant: { name: "Novara HR", registrationText: "Licence: B-0101" } }],
    ["client", { client: { name: "Gulf Petro Services" } }],
  ] as [string, Partial<DtpAdvertisement>][]) {
    it(`${label} present adds height; absent adds none`, () => {
      const base = measureDtpBlock(ad(), COL);
      const richer = measureDtpBlock(ad(over), COL);
      expect(richer.heightPx).toBeGreaterThan(base.heightPx);
    });
  }
});

describe("DTP-007/008/009 — identity roles hold inside DTP", () => {
  it("the tenant logo slot accepts the tenant's own primary mark", async () => {
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: { r: 20, g: 60, b: 140 } },
    })
      .png()
      .toBuffer();
    const svg = renderDtpPageSvg(
      page([ad({ tenant: { name: "Novara HR", logo: brandAsset("TENANT_PRIMARY_LOGO", png) } })]),
    ).svg;
    expect(svg).toContain("<image");
  });

  it("a client logo cannot be rendered through the tenant slot", () => {
    expect(() =>
      renderDtpPageSvg(
        page([
          ad({
            tenant: { name: "Novara HR", logo: brandAsset("CLIENT_LOGO", Buffer.alloc(1)) },
          }),
        ]),
      ),
    ).toThrow(BrandIdentityViolationError);
  });

  it("a tenant mark cannot be rendered as KAI's verification", () => {
    expect(() =>
      renderDtpPageSvg(
        page([ad({ verificationQr: brandAsset("TENANT_PRIMARY_LOGO", Buffer.alloc(1)) })]),
      ),
    ).toThrow(BrandIdentityViolationError);
  });
});

describe("DTP-010/011/012 — long content wraps, never overflows", () => {
  const LONG_NAME = "Continental Overseas Manpower & Technical Consultancy Private Limited";
  const LONG_REG =
    "Licence: B-9987/MUM/PER/1000+/4-1/4/7914/2007-VALID-UNTIL-2031-EXTENDED-VERIFICATION-CODE-99887766";

  it("a long tenant name grows the block instead of running past the column", () => {
    const short = measureDtpBlock(ad(), COL);
    const long = measureDtpBlock(ad({ tenant: { name: LONG_NAME } }), COL);
    // It wrapped: more than one line of advertiser name.
    expect(long.heightPx).toBeGreaterThan(short.heightPx);
  });

  it("a long registration is never truncated", () => {
    const svg = renderDtpPageSvg(page([ad({ tenant: { name: "Novara HR", registrationText: LONG_REG } })])).svg;
    // Every word of the licence survives somewhere in the markup.
    for (const token of ["99887766", "VALID-UNTIL-2031-EXTENDED-VERIFICATION-CODE"]) {
      expect(svg).toContain(token);
    }
  });

  it("a long vacancy list keeps every role", () => {
    const roles = Array.from({ length: 14 }, (_, i) => ({ title: `Technician Grade ${i + 1}`, count: i + 2 }));
    const svg = renderDtpPageSvg(page([ad({ positions: roles })])).svg;
    for (const r of roles) {
      expect(svg.toUpperCase()).toContain(r.title.toUpperCase());
    }
  });

  it("no text line is laid out wider than its column", () => {
    // Measured, not eyeballed: the block wraps against the column's own
    // inner width, so a wrapped line can never exceed it.
    const long = measureDtpBlock(ad({ tenant: { name: LONG_NAME }, positions: [{ title: "Bituminous Membrane Waterproofing Technician", count: 4 }] }), COL);
    expect(long.heightPx).toBeGreaterThan(0);
    const svg = renderDtpPageSvg(page([ad({ tenant: { name: LONG_NAME } })])).svg;
    // The advertiser name was split across lines rather than emitted whole.
    expect(svg).not.toContain(LONG_NAME.toUpperCase());
  });
});

describe("DTP-013/016/017/018 — page packing", () => {
  const many = Array.from({ length: 60 }, (_, i) =>
    ad({
      headline: ["Saudi Arabia", "UAE", "Qatar", "Oman", "Kuwait"][i % 5],
      tenant: { name: `Agency ${i}` },
      positions: Array.from({ length: (i % 4) + 1 }, (_, j) => ({ title: `Trade ${j}`, count: j + 2 })),
    }),
  );

  it("packs advertisements across every column, up to what the page physically holds", () => {
    const layout = layoutDtpPage(page(many));
    const used = new Set(layout.placements.map((p) => p.column));
    expect(used.size).toBe(5);

    // A page holds a whole number of saleable bookings, not however many
    // advertisements it is handed. The ceiling is derived from the law
    // rather than restated as a constant, so correcting the minimum
    // saleable height cannot leave this expectation quietly stale.
    const perColumn = Math.floor(DTP_PAGE_CM.liveHeightCm / DTP_MIN_AD_HEIGHT_CM);
    expect(layout.placements.length).toBeLessThanOrEqual(perColumn * DTP_PAGE_CM.columns);
    // Nothing lands below the minimum a column can sell.
    for (const p of layout.placements) {
      expect(pxToCm(p.heightPx, DTP_DEFAULT_DPI)).toBeGreaterThanOrEqual(DTP_MIN_AD_HEIGHT_CM - 0.01);
    }
    // The surplus is reported, not silently dropped.
    expect(layout.placements.length + layout.unplaced.length).toBe(many.length);
  });

  it("no advertisement overlaps another", () => {
    const layout = layoutDtpPage(page(many));
    const byColumn = new Map<number, typeof layout.placements>();
    for (const p of layout.placements) {
      byColumn.set(p.column, [...(byColumn.get(p.column) ?? []), p]);
    }
    for (const [, column] of byColumn) {
      const sorted = [...column].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        const previousBottom = sorted[i - 1].y + sorted[i - 1].heightPx;
        expect(sorted[i].y).toBeGreaterThanOrEqual(previousBottom);
      }
    }
  });

  it("nothing is placed outside the page", () => {
    const layout = layoutDtpPage(page(many));
    for (const p of layout.placements) {
      expect(p.x).toBeGreaterThanOrEqual(DTP_PAGE.marginPx);
      expect(p.x + p.widthPx).toBeLessThanOrEqual(DTP_PAGE.widthPx - DTP_PAGE.marginPx);
      expect(p.y + p.heightPx).toBeLessThanOrEqual(DTP_PAGE.heightPx - DTP_PAGE.marginPx);
    }
  });

  it("leaves no unexplained gap between stacked advertisements", () => {
    const layout = layoutDtpPage(page(many));
    const byColumn = new Map<number, typeof layout.placements>();
    for (const p of layout.placements) {
      byColumn.set(p.column, [...(byColumn.get(p.column) ?? []), p]);
    }
    for (const [, column] of byColumn) {
      const sorted = [...column].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].y - (sorted[i - 1].y + sorted[i - 1].heightPx);
        // A deliberate hairline gap, never a band of dead paper.
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThan(DTP_PAGE.widthPx * 0.01);
      }
    }
  });

  it("reports advertisements it cannot fit rather than dropping them", () => {
    // Far more copy than one page holds.
    const flood = Array.from({ length: 400 }, (_, i) => ad({ tenant: { name: `Agency ${i}` } }));
    const layout = layoutDtpPage(page(flood));
    expect(layout.placements.length + layout.unplaced.length).toBe(flood.length);
    expect(layout.unplaced.length).toBeGreaterThan(0);
  });
});

describe("DTP-014/015 — determinism", () => {
  const ads = Array.from({ length: 30 }, (_, i) =>
    ad({ tenant: { name: `Agency ${i}` }, positions: [{ title: `Trade ${i}`, count: i }] }),
  );

  it("the same input produces the same layout", () => {
    const a = layoutDtpPage(page(ads));
    const b = layoutDtpPage(page(ads));
    expect(JSON.stringify(a.placements)).toBe(JSON.stringify(b.placements));
  });

  it("the same input produces an identical page hash", () => {
    const hash = (svg: string) => createHash("sha256").update(svg).digest("hex");
    expect(hash(renderDtpPageSvg(page(ads)).svg)).toBe(hash(renderDtpPageSvg(page(ads)).svg));
  });
});

describe("DTP output formats", () => {
  const ads = Array.from({ length: 12 }, (_, i) => ad({ tenant: { name: `Agency ${i}` } }));

  it("renders PNG, JPG and PDF at the same page geometry", async () => {
    const png = await renderDtpPage(page(ads), "png");
    const jpg = await renderDtpPage(page(ads), "jpg");
    const pdf = await renderDtpPage(page(ads), "pdf");

    expect(png.mimeType).toBe("image/png");
    expect(jpg.mimeType).toBe("image/jpeg");
    expect(pdf.mimeType).toBe("application/pdf");

    const pngMeta = await sharp(png.buffer).metadata();
    const jpgMeta = await sharp(jpg.buffer).metadata();
    expect(pngMeta.width).toBe(DTP_PAGE.widthPx);
    expect(pngMeta.height).toBe(DTP_PAGE.heightPx);
    expect(jpgMeta.width).toBe(DTP_PAGE.widthPx);
    expect(pdf.buffer.subarray(0, 4).toString()).toBe("%PDF");
  }, 120_000);
});

describe("DTP-019 — the locked poster renderer is untouched", () => {
  it("the DTP module imports no poster composition code", () => {
    for (const file of [
      "src/server/generation/dtp/dtp-page.ts",
      "src/server/generation/dtp/dtp-ad-block.ts",
      "src/server/generation/dtp/dtp-typography.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("fact-layer");
      expect(src).not.toContain("branding-overlay");
    }
  });

  it("DTP defines its own type scale rather than the poster's", () => {
    const src = readFileSync("src/server/generation/dtp/dtp-typography.ts", "utf8");
    // It may MEASURE through the shared registry (one source only for
    // font metrics), but the sizes/leading are DTP's own.
    expect(src).toContain("DTP_TYPE");
    expect(src).toContain("roleTextWidth");
  });
});

describe("DTP-020 — tenant neutrality", () => {
  it("the DTP renderer names no agency", () => {
    for (const file of [
      "src/server/generation/dtp/dtp-page.ts",
      "src/server/generation/dtp/dtp-ad-block.ts",
      "src/server/generation/dtp/dtp-typography.ts",
      "src/server/generation/dtp/index.ts",
    ]) {
      const src = readFileSync(file, "utf8").toLowerCase();
      for (const tenant of ["yousuf", "gheewala", "novara", "meridian", "continental"]) {
        expect(src, `${file} names a tenant`).not.toContain(tenant);
      }
    }
  });
});

describe("DTP minimum saleable advertisement (6cm x 5cm)", () => {
  /**
   * The format law prices Assignments Abroad Times appointment
   * advertisements in physical slots whose smallest unit is 2 columns =
   * 6.0cm, and the minimum booking is 6 x 5cm — evidenced by release
   * orders pricing 6 x 5 at 1000/sq.cm = 30,000 and at 1300/sq.cm =
   * 39,000. An advertisement smaller than that cannot be sold or
   * published, so the renderer may never produce one — whatever its
   * copy happens to measure.
   */
  it("the grid column is exactly the minimum saleable width, and an approved slot", () => {
    for (const dpi of [150, 300]) {
      const geometry = dtpPageAt(dpi);
      expect(pxToCm(geometry.columnPx, dpi)).toBeCloseTo(DTP_MIN_AD_WIDTH_CM, 1);
      // And it is a width the publication actually sells.
      expect(isApprovedDtpWidthPx(geometry.columnPx, dpi)).toBe(true);
    }
  });

  it("no block is ever shorter than the minimum booking, however little copy it holds", () => {
    for (const dpi of [150, 300]) {
      const geometry = dtpPageAt(dpi);
      const sparse = measureDtpBlock(
        { headline: "Qatar", tenant: { name: "Novara HR" }, positions: [{ title: "Welder" }] },
        geometry.columnPx,
        geometry.minAdHeightPx,
      );
      expect(pxToCm(sparse.heightPx, dpi)).toBeGreaterThanOrEqual(DTP_MIN_AD_HEIGHT_CM - 0.05);
      // The content itself is genuinely smaller — the block is at its
      // floor because the slot is purchased, not because the content was
      // padded out to a nominal box.
      expect(sparse.contentHeightPx).toBeLessThan(sparse.heightPx);
    }
  });

  it("a block whose copy exceeds the minimum grows past it", () => {
    const geometry = dtpPageAt(150);
    const dense = measureDtpBlock(
      {
        headline: "Saudi Arabia",
        tenant: { name: "Novara HR" },
        // Genuinely more copy than a minimum booking holds: 22 bare
        // rows still measure just under 8cm, which is itself a useful
        // calibration of how much a 6x8cm slot actually carries.
        positions: Array.from({ length: 30 }, (_, i) => ({
          title: `Technician Grade ${i + 1}`,
          count: i + 2,
        })),
      },
      geometry.columnPx,
      geometry.minAdHeightPx,
    );
    expect(dense.heightPx).toBe(dense.contentHeightPx);
    expect(pxToCm(dense.heightPx, 150)).toBeGreaterThan(DTP_MIN_AD_HEIGHT_CM);
  });

  it("every placed advertisement on a full page meets the minimum in both dimensions", () => {
    const geometry = dtpPageAt(150);
    const ads = Array.from({ length: 30 }, (_, i) =>
      ad({ tenant: { name: `Agency ${i}` }, positions: [{ title: "Welder", count: i + 1 }] }),
    );
    const layout = layoutDtpPage({ ...page(ads), page: geometry });
    expect(layout.placements.length).toBeGreaterThan(0);
    for (const p of layout.placements) {
      expect(pxToCm(p.widthPx, 150)).toBeGreaterThanOrEqual(DTP_MIN_AD_WIDTH_CM - 0.05);
      expect(pxToCm(p.heightPx, 150)).toBeGreaterThanOrEqual(DTP_MIN_AD_HEIGHT_CM - 0.05);
    }
  });

  it("the grid never spans wider than the page it is drawn on", () => {
    // Independent cm roundings previously made the grid three pixels
    // wider than the page, putting the last column across the margin.
    for (const dpi of [150, 300, 600]) {
      const g = dtpPageAt(dpi);
      const spanned = g.marginPx * 2 + g.columnPx * g.columns + g.gutterPx * (g.columns - 1);
      expect(spanned).toBe(g.widthPx);
    }
  });
});

/**
 * These cover the classified unit itself — the single 6cm booking —
 * rather than the page it sits on. Each one is a defect that a passing
 * geometry suite did not catch and only a side-by-side against the
 * reference bookings revealed.
 */
describe("DTP classified — the reference grammar", () => {
  const base = {
    headline: "Hiring for – Saudi Arabia",
    tenant: {
      name: "Novara HR",
      registrationText: "B-0101/MUM/PART/1000+/9986/2022",
      logo: brandAsset("TENANT_PRIMARY_LOGO", PNG),
    },
    positions: [
      { title: "Pipe Fabricators", detail: "Upto SR 2000 + SR 300 Food" },
      { title: "Welder (GTAW+SMAW)", detail: "Upto SR 2200 + SR 300 Food" },
      { title: "Painter / Blaster", detail: "Upto SR 1500 + SR 300 Food" },
    ],
    interview: "Client interview 4th & 5th June · Mumbai",
    contactPhone: "8104962797 / 8104962798",
    contactEmail: "jobs@example-agency.test",
  } satisfies DtpAdvertisement;

  const addressLines = [
    "Interview venue: SAFCO Training Center,",
    "Gami Industrial Park, Gala A-23, Pawne MIDC,",
    "Near Turbhe Railway Stn, Navi Mumbai.",
  ];

  it("every bookable height is exactly 6cm wide", () => {
    for (const h of DTP_AD_HEIGHTS_CM) {
      const r = renderDtpClassifiedSvg({ ad: base, heightCm: h, addressLines });
      expect(pxToCm(r.widthPx, DTP_DEFAULT_DPI)).toBeCloseTo(6.0, 2);
      expect(pxToCm(r.heightPx, DTP_DEFAULT_DPI)).toBeCloseTo(h, 2);
    }
  });

  it("prints every booked trade at the smallest size, or refuses the render", () => {
    // The 6x5 reference carries three trades WITH per-role pay. An
    // earlier build quietly dropped the third and still reported a
    // healthy fill ratio — the failure this asserts against.
    const r = renderDtpClassifiedSvg({ ad: base, heightCm: 5, addressLines });
    for (const p of base.positions) {
      expect(r.svg).toContain(p.title.toUpperCase());
      expect(r.svg).toContain(p.detail.toUpperCase());
    }
  });

  it("fails closed rather than omitting a trade it cannot fit", () => {
    const overloaded: DtpAdvertisement = {
      ...base,
      positions: Array.from({ length: 24 }, (_, i) => ({
        title: `Technician Grade ${i + 1}`,
        detail: "Upto SR 2000 + SR 300 Food",
      })),
    };
    expect(() => renderDtpClassifiedSvg({ ad: overloaded, heightCm: 5, addressLines }))
      .toThrow(LayoutCapacityError);
  });

  it("always prints the telephone, at every size", () => {
    // Reserved, not fitted last: leaving it to spare room lost it
    // entirely from a 6x5 and left an advertisement no one could answer.
    for (const h of DTP_AD_HEIGHTS_CM) {
      const r = renderDtpClassifiedSvg({ ad: base, heightCm: h, addressLines });
      expect(r.svg).toContain("8104962797 / 8104962798");
    }
  });

  it("never truncates the address", () => {
    for (const h of DTP_AD_HEIGHTS_CM) {
      const r = renderDtpClassifiedSvg({ ad: base, heightCm: h, addressLines });
      // "...Pawne MIDC," once printed as the last line of a 6x5 footer,
      // with the rest of the venue silently cut.
      expect(r.svg).toContain("Near Turbhe Railway Stn, Navi Mumbai.");
    }
  });

  it("carries the licence and the agency identity at every size", () => {
    for (const h of DTP_AD_HEIGHTS_CM) {
      const r = renderDtpClassifiedSvg({ ad: base, heightCm: h, addressLines });
      expect(r.svg).toContain("B-0101/MUM/PART/1000+/9986/2022");
      expect(r.svg).toContain("NOVARA HR");
      expect(r.svg).toContain("<image");
    }
  });

  it("leaves no dead band when the copy suits the slot", () => {
    // Asserted on largestGapRatio, not fillRatio. fillRatio measures
    // where the last baseline fell, and an earlier build scored 0.99 on
    // an advertisement that was visibly three near-empty ruled boxes.
    // This is the number that would have caught it.
    for (const h of DTP_AD_HEIGHTS_CM) {
      const ad: DtpAdvertisement = {
        ...base,
        // Copy scaled to the slot, as a booking normally is.
        positions: Array.from({ length: h - 2 }, (_, i) => ({
          title: `Technician Grade ${i + 1}`,
          detail: "Upto SR 2000 + SR 300 Food",
        })),
      };
      const r = renderDtpClassifiedSvg({ ad, heightCm: h, addressLines });
      expect(r.largestGapRatio).toBeLessThan(0.08);
    }
  });

  it("degrades gracefully when a slot is overbought, rather than clipping", () => {
    // Three trades in twelve centimetres is more space than the copy
    // needs. The renderer must not answer that by dropping facts or by
    // inflating type past the measure — it sets large, ruled blocks and
    // accepts a rest. The bound keeps that rest from becoming the 27%
    // void an uncapped lead produced.
    const r = renderDtpClassifiedSvg({ ad: base, heightCm: 12, addressLines });
    expect(r.largestGapRatio).toBeLessThan(0.16);
    for (const p of base.positions) expect(r.svg).toContain(p.title.toUpperCase());
  });

  it("spends surplus on the trades, not on gaps between sections", () => {
    // A taller booking of the SAME copy must set the trade names
    // larger. Distributing the surplus as leading instead is what
    // opened white bands through the middle of the advertisement.
    const small = renderDtpClassifiedSvg({ ad: base, heightCm: 5, addressLines });
    const large = renderDtpClassifiedSvg({ ad: base, heightCm: 9, addressLines });
    const biggest = (svg: string) =>
      Math.max(...[...svg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1])));
    expect(biggest(large.svg)).toBeGreaterThan(biggest(small.svg));
  });

  it("refuses a client logo in the tenant slot", () => {
    const bad: DtpAdvertisement = {
      ...base,
      tenant: { ...base.tenant, logo: brandAsset("CLIENT_LOGO", PNG) as never },
    };
    expect(() => renderDtpClassifiedSvg({ ad: bad, heightCm: 8, addressLines }))
      .toThrow(BrandIdentityViolationError);
  });

  it("sets a B/W booking in ink whatever accent the tenant supplies", () => {
    const r = renderDtpClassifiedSvg({
      ad: { ...base, accent: "#B3121D" }, heightCm: 8, variant: "BW", addressLines,
    });
    expect(r.svg).not.toContain("#B3121D");
  });
});

/**
 * Client identity, brand assets, and the rule that no verified fact of
 * ANY class may disappear quietly. Roles were made to fail closed
 * first; these cover everything else that could still vanish.
 */
describe("DTP classified — client identity and brand assets", () => {
  /** A real PNG, so the intrinsic-size reader has something to read. */
  async function png(w: number, h: number, colour = "#B3121D"): Promise<Buffer> {
    return sharp({ create: { width: w, height: h, channels: 3, background: colour } })
      .png().toBuffer();
  }

  const facts = {
    headline: "Kuwait",
    subhead: "Power Transmission",
    tenant: { name: "Northwind Overseas", registrationText: "B-9987/MUM/PER/1000+/7914/2007" },
    positions: [
      { title: "Lineman", count: 14 },
      { title: "Electrical Technician", count: 12 },
      { title: "Foreman", count: 5 },
    ],
    salary: "KD 180 – 250",
    benefits: ["Food", "Accommodation", "Transport", "Medical"],
    eligibility: ["Minimum 5 years Gulf experience"],
    interview: "Interview 20-21 July · Mumbai",
    contactPhone: "+91 11 4000 2020",
    contactEmail: "hire@example-agency.test",
  } satisfies DtpAdvertisement;

  it("reads a PNG's real dimensions, and rejects what is not a PNG", async () => {
    expect(pngIntrinsicSize(await png(320, 180))).toEqual({ widthPx: 320, heightPx: 180 });
    expect(pngIntrinsicSize(Buffer.from("not a png at all, but long enough"))).toBeNull();
    expect(pngIntrinsicSize(Buffer.alloc(4))).toBeNull();
  });

  it("renders a supplied client logo instead of discarding it", async () => {
    // The type accepted client.logo and the classified renderer never
    // drew it — a supplied brand asset silently dropped.
    const withLogo: DtpAdvertisement = {
      ...facts,
      client: { name: "Gulf Power Contracting", logo: brandAsset("CLIENT_LOGO", await png(320, 320)) },
    };
    const bare = renderDtpClassifiedSvg({ ad: facts, heightCm: 9 });
    const shown = renderDtpClassifiedSvg({ ad: withLogo, heightCm: 9 });
    expect(bare.svg).not.toContain("<image");
    expect(shown.svg).toContain("<image");
  });

  it("places every logo at its own aspect ratio, never a fixed box", async () => {
    const draw = (svg: string) => {
      const m = [...svg.matchAll(/<image[^>]*width="(\d+)" height="(\d+)"/g)];
      return m.map(([, w, h]) => Number(w) / Number(h));
    };
    for (const [w, h] of [[400, 100], [320, 320], [180, 360]] as const) {
      const ad: DtpAdvertisement = {
        ...facts,
        client: { name: "Gulf Power", logo: brandAsset("CLIENT_LOGO", await png(w, h)) },
      };
      const [aspect] = draw(renderDtpClassifiedSvg({ ad, heightCm: 10 }).svg);
      expect(aspect).toBeCloseTo(w / h, 1);
    }
  });

  it("refuses a corrupt brand asset rather than guessing its shape", () => {
    const ad: DtpAdvertisement = {
      ...facts,
      client: { name: "Gulf Power", logo: brandAsset("CLIENT_LOGO", Buffer.from("nonsense-not-a-png")) },
    };
    expect(() => renderDtpClassifiedSvg({ ad, heightCm: 10 })).toThrow(DtpAssetError);
  });

  it("keeps client and tenant marks in their own slots", async () => {
    const clientInTenantSlot: DtpAdvertisement = {
      ...facts,
      tenant: { ...facts.tenant, logo: brandAsset("CLIENT_LOGO", await png(300, 200)) as never },
    };
    expect(() => renderDtpClassifiedSvg({ ad: clientInTenantSlot, heightCm: 10 }))
      .toThrow(BrandIdentityViolationError);

    const tenantInClientSlot: DtpAdvertisement = {
      ...facts,
      client: { name: "Gulf Power", logo: brandAsset("TENANT_PRIMARY_LOGO", await png(300, 200)) as never },
    };
    expect(() => renderDtpClassifiedSvg({ ad: tenantInClientSlot, heightCm: 10 }))
      .toThrow(BrandIdentityViolationError);
  });

  it("prints a supplied venue at every size, or fails — never drops it", () => {
    // Gated behind the density tier once, so a venue supplied for a 6x8
    // was discarded before capacity was ever consulted.
    for (const h of DTP_AD_HEIGHTS_CM) {
      let svg: string;
      try {
        svg = renderDtpClassifiedSvg({
          ad: facts, heightCm: h, interviewVenue: "Venue: Turbhe Office, Navi Mumbai",
        }).svg;
      } catch (error) {
        expect(error).toBeInstanceOf(LayoutCapacityError);
        continue;
      }
      expect(svg).toContain("TURBHE OFFICE");
    }
  });

  it("reports benefits and eligibility it cannot place, rather than dropping them", () => {
    const overloaded: DtpAdvertisement = {
      ...facts,
      benefits: Array.from({ length: 40 }, (_, i) => `Benefit number ${i + 1}`),
      eligibility: Array.from({ length: 40 }, (_, i) => `Condition of employment number ${i + 1}`),
    };
    let thrown: unknown;
    try {
      renderDtpClassifiedSvg({ ad: overloaded, heightCm: 5 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LayoutCapacityError);
    const unplaced = (thrown as LayoutCapacityError).unplaced.join(" ");
    expect(unplaced).toMatch(/benefit|eligibility/i);
  });

  it("never sets body prose larger than the trade names above it", () => {
    // The pressure matters: this is the shape that actually inverted —
    // six trades, a salary panel, four benefits, an eligibility line, a
    // venue bar and a full identity footer, all inside 6x8. Searching
    // prose scale outermost fits everything and settles the trades at
    // the same size as the body copy; searching display scale first
    // keeps the trade names ahead of it. Strict >, so equal sizes fail.
    const dense: DtpAdvertisement = {
      headline: "Oman",
      subhead: "Facility Management",
      urgency: "Urgent requirement for leading FM co.",
      tenant: {
        name: "Harbourline Overseas",
        registrationText: "B-1487/MUM/PART/1000+/9986/2022",
        logo: brandAsset("TENANT_PRIMARY_LOGO", PNG),
      },
      positions: [
        { title: "Maintenance Supervisor", count: 4 },
        { title: "Maintenance Engineer", count: 6 },
        { title: "HVAC Supervisor", count: 4 },
        { title: "Electrical Supervisor", count: 4 },
        { title: "Plumber", count: 6 },
        { title: "Multi Technician", count: 10 },
      ],
      salary: "OMR 180 – 260 + Food",
      benefits: ["Free Accommodation", "Free Transportation", "Medical Insurance", "8 Hours Duty"],
      eligibility: ["Min. 5 years experience in facility management"],
      interview: "Client interview in Mumbai · 10-11 July",
      contactPhone: "81049 62788",
      contactEmail: "jobs@example-agency.test",
    };
    const svg = renderDtpClassifiedSvg({
      ad: dense, heightCm: 8,
      interviewVenue: "Venue: Turbhe Office, Navi Mumbai",
      established: "Estd. 1984",
      addressLines: [
        "Arihant Aura, A-601, 6th Floor,",
        "Opp. Turbhe Railway Station,",
        "Turbhe MIDC, Navi Mumbai - 400 705.",
      ],
    }).svg;

    const drawn = [...svg.matchAll(/<text[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)]
      .map(([, size, content]) => ({ size: Number(size), content }));

    const roleSize = drawn.find((t) => t.content.includes("MAINTENANCE SUPERVISOR"))?.size;
    const proseSizes = drawn
      .filter((t) => /Accommodation|experience in facility/.test(t.content))
      .map((t) => t.size);

    expect(roleSize).toBeDefined();
    expect(proseSizes.length).toBeGreaterThan(0);
    for (const prose of proseSizes) expect(roleSize as number).toBeGreaterThan(prose);
  });

  it("states a shared pay structure once, and per-role pay per role", () => {
    const shared: DtpAdvertisement = {
      ...facts,
      positions: facts.positions.map((p) => ({ ...p, detail: "KD 180 – 250" })),
      salary: "KD 180 – 250",
    };
    const distinct: DtpAdvertisement = {
      ...facts,
      positions: [
        { title: "Lineman", detail: "KD 250" },
        { title: "Foreman", detail: "KD 320" },
      ],
      salary: null,
    };
    const sharedSvg = renderDtpClassifiedSvg({ ad: shared, heightCm: 9 }).svg;
    // Once as a panel, not repeated under all three trades.
    expect([...sharedSvg.matchAll(/KD 180/g)]).toHaveLength(1);

    const distinctSvg = renderDtpClassifiedSvg({ ad: distinct, heightCm: 9 }).svg;
    expect(distinctSvg).toContain("KD 250");
    expect(distinctSvg).toContain("KD 320");
  });
});

/**
 * Multi-campaign bookings, and the rule that nothing drawn may cross
 * the trim edge.
 *
 * The 6x11 reference is one purchased advertisement carrying several
 * hiring campaigns, each with its own project heading, interview dates,
 * trades, conditions and contact number. The compositor assumed one
 * campaign per booking, so this entire shape — the ordinary form of a
 * larger classified — could not be expressed.
 */
describe("DTP classified — campaigns and the trim edge", () => {
  const multi: DtpAdvertisement = {
    headline: "Jobs in Saudi Arabia – 100% client interview",
    tenant: {
      name: "Silverline HR Consultants",
      registrationText: "B-1487/MUM/PART/1000+/9986/2022",
      logo: brandAsset("TENANT_PRIMARY_LOGO", PNG),
    },
    campaigns: [
      {
        heading: "Hiring for Masco – Amiral – Oil & Gas Project",
        interview: "Mumbai on 26th March",
        positions: [
          { title: "Foreman", qualifier: "Civil / Electrical / Mechanical" },
          { title: "WPR", qualifier: "Aramco approved" },
          { title: "Driver", qualifier: "HD / LD, Saudi licence" },
        ],
        note: "Must have experience in industrial projects, preferably Oil & Gas.",
        contactPhone: "8655960411",
      },
      {
        heading: "Hiring for Exact (Al Rashid Group)",
        interview: "Mumbai 28th · Vadodara 27th March",
        positions: [
          { title: "Pipe Welder", qualifier: "6G Multi-TIG & ARC" },
          { title: "Rigger Level 3" },
        ],
        note: "Must have GCC experience in the relevant industry.",
        contactPhone: "8655440318",
      },
    ],
    contactPhone: "8655440316",
    contactEmail: "jobs@example-agency.test",
  };

  /** Every string the compositor drew, with the size and family used. */
  function drawn(svg: string) {
    return [...svg.matchAll(
      /<text[^>]*x="(-?\d+)"[^>]*font-family="([^"]+)"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g,
    )].map(([, x, family, size, content]) => ({
      x: Number(x), family, size: Number(size), content,
    }));
  }

  /** A token sharing each family, so advances are measured correctly. */
  const TOKEN_BY_FAMILY = new Map(
    (Object.keys(DTP_TYPE) as DtpToken[]).map((t) => [dtpFamily(t), t]),
  );

  it("renders every campaign's heading, dates, trades, note and number", () => {
    const { svg } = renderDtpClassifiedSvg({ ad: multi, heightCm: 11 });
    // Joined, because a long heading may legitimately take two lines.
    const all = drawn(svg).map((r) => r.content).join(" ");
    for (const campaign of multi.campaigns ?? []) {
      for (const word of (campaign.heading ?? "").toUpperCase().split(/\s+/)) {
        expect(all).toContain(word);
      }
      expect(all).toContain(campaign.contactPhone ?? "");
      for (const p of campaign.positions) expect(all).toContain(p.title.toUpperCase());
    }
    expect(all).toContain("Must have GCC experience in the relevant industry.");
  });

  it("keeps a trade's qualification with its trade, not below it as pay", () => {
    const { svg } = renderDtpClassifiedSvg({ ad: multi, heightCm: 11 });
    const rows = drawn(svg);
    const trade = rows.find((r) => r.content.includes("WPR"));
    const qualifier = rows.find((r) => r.content.includes("Aramco approved"));
    expect(trade).toBeDefined();
    expect(qualifier).toBeDefined();
    // To the RIGHT of the trade name, continuing its line.
    expect((qualifier as { x: number }).x).toBeGreaterThan((trade as { x: number }).x);
    // And in reading weight, not the display size of the trade.
    expect((qualifier as { size: number }).size)
      .toBeLessThan((trade as { size: number }).size);
  });

  it("never sets any text past the trim edge", () => {
    // Bars were drawn at a fixed size with no fitting, so a long master
    // headline printed as "JOBS IN SAUDI ARABIA - 100% CL" and a long
    // venue as "...GAMI INDUSTRIAL PAR". Checked by measurement here
    // rather than by eye.
    const shapes: DtpAdvertisement[] = [
      multi,
      // Long everything: the shapes most likely to overrun.
      {
        headline: "Mega recruitment for overhead powerline project",
        tenant: {
          name: "Continental Overseas Manpower Consultancy",
          registrationText: "B-1487/MUM/PART/1000+/9986/2022",
          logo: brandAsset("TENANT_PRIMARY_LOGO", PNG),
        },
        positions: [
          { title: "Overhead Powerline Supervisor / Foreman", detail: "Upto SR 2200 + SR 300 Food" },
          { title: "Cathodic Protection Foreman / Technician", qualifier: "Aramco approved, Saudi licence" },
        ],
        benefits: ["Free food", "Accommodation", "Transport"],
        contactPhone: "9324995758 / 9324995763",
        contactEmail: "recruitment@example-agency.test",
      },
    ];
    const cases: { ad: DtpAdvertisement; heightCm: DtpAdHeightCm; venue?: string }[] =
      shapes.flatMap((ad) =>
        DTP_AD_HEIGHTS_CM.map((heightCm) => ({
          ad, heightCm,
          venue: "Venue for all above: SAFCO Trade Test, Gami Industrial Park, Navi Mumbai",
        })),
      );
    for (const { ad, heightCm, venue } of cases) {
      let svg: string;
      let widthPx: number;
      try {
        ({ svg, widthPx } = renderDtpClassifiedSvg({ ad, heightCm, interviewVenue: venue }));
      } catch (error) {
        // Refusing to place the content is allowed; clipping is not.
        expect(error).toBeInstanceOf(LayoutCapacityError);
        continue;
      }
      for (const row of drawn(svg)) {
        if (!row.content.trim()) continue;
        const token = TOKEN_BY_FAMILY.get(row.family);
        if (!token) continue;
        const advance = dtpTextWidth(row.content, token, widthPx)
          * row.size / dtpSize(token, widthPx);
        expect(`${row.content} @${Math.round(row.x + advance)}`)
          .toBe(`${row.content} @${Math.round(Math.min(row.x + advance, widthPx))}`);
      }
    }
  });

  it("never runs a qualification into the trade name it follows", () => {
    // Found by eye on the real-source render, not by the trim-edge
    // check: "PROCUREMENT MANAGER" and "Mech/Civil, 10-12 years"
    // printed as one word. Nothing crossed the column edge, so
    // measuring against the trim could never have caught it — this
    // measures the gap between two strings sharing a baseline.
    const ad: DtpAdvertisement = {
      headline: "Saudi Arabia",
      tenant: { name: "Northgate Overseas", registrationText: "B-0417" },
      positions: [
        { title: "Procurement Manager", count: 1, qualifier: "Mech/Civil, 10-12 years" },
        { title: "Procurement Engineer – Construction", count: 2, qualifier: "Mech/Civil, 5-6 years" },
        { title: "Time Keeper / HR Executive", count: 2, qualifier: "Graduate, 4-5 years" },
        { title: "WPR", count: 25, qualifier: "Civil Engineering, 2 years" },
      ],
      contactPhone: "8104962797",
    };
    for (const heightCm of DTP_AD_HEIGHTS_CM) {
      let svg: string;
      try {
        ({ svg } = renderDtpClassifiedSvg({ ad, heightCm }));
      } catch (error) {
        expect(error).toBeInstanceOf(LayoutCapacityError);
        continue;
      }

      const rows = [...svg.matchAll(
        /<text[^>]*x="(-?\d+)" y="(-?\d+)"[^>]*font-family="([^"]+)"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g,
      )].map(([, x, y, family, size, content]) => ({
        x: Number(x), y: Number(y), family, size: Number(size), content,
      }));

      // Group by baseline; within a baseline nothing may overlap.
      const byBaseline = new Map<number, typeof rows>();
      for (const row of rows) {
        if (!row.content.trim()) continue;
        byBaseline.set(row.y, [...(byBaseline.get(row.y) ?? []), row]);
      }
      for (const line of byBaseline.values()) {
        const placed = line
          .filter((r) => TOKEN_BY_FAMILY.has(r.family))
          .sort((a, b) => a.x - b.x);
        for (let i = 0; i + 1 < placed.length; i += 1) {
          const left = placed[i];
          const token = TOKEN_BY_FAMILY.get(left.family) as DtpToken;
          const advance = dtpTextWidth(left.content, token, 709)
            * left.size / dtpSize(token, 709);
          // Right-anchored counts are drawn from their end, so only
          // compare against left-anchored neighbours.
          if (placed[i + 1].x <= left.x) continue;
          expect(`${left.content}|${placed[i + 1].content}`)
            .toBe(placed[i].x + advance <= placed[i + 1].x
              ? `${left.content}|${placed[i + 1].content}`
              : `OVERLAP: ${left.content}|${placed[i + 1].content}`);
        }
      }
    }
  });

  it("wraps a headline too long for the measure instead of clipping it", () => {
    const long: DtpAdvertisement = {
      ...multi,
      headline: "Mega recruitment for overhead powerline project across the Kingdom",
    };
    const { svg } = renderDtpClassifiedSvg({ ad: long, heightCm: 12 });
    // Present in full, across however many lines it took.
    const headline = drawn(svg).map((r) => r.content).join(" ");
    expect(headline).toContain("MEGA RECRUITMENT");
    expect(headline).toContain("KINGDOM");
  });

  it("still renders a single-campaign booking from the flat fields", () => {
    const flat: DtpAdvertisement = {
      headline: "Qatar",
      tenant: { name: "Meridian Gulf Staffing", registrationText: "B-4410" },
      positions: [{ title: "Instrument Tech.", count: 8, detail: "QR 2200 + FAT" }],
      interview: "Interview 12-13 August · Chennai",
      contactPhone: "8291 898055",
    };
    const { svg } = renderDtpClassifiedSvg({ ad: flat, heightCm: 6 });
    expect(svg).toContain("INSTRUMENT TECH.");
    expect(svg).toContain("QR 2200 + FAT");
    // The telephone appears once, in the footer bar — not also repeated
    // as a campaign contact.
    expect([...svg.matchAll(/8291 898055/g)]).toHaveLength(1);
  });
});
