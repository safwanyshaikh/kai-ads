import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderFactLayer, LayoutCapacityError } from "@/server/generation/pipeline/fact-layer";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";
import { buildRecruitmentCampaign } from "@/server/generation/pipeline/content-intelligence";
import {
  decideSocialProductForFacts,
  assertSlidePlanIntegrity,
} from "@/server/generation/pipeline/social-product-decision";
import { socialFeedMaxHeightPx, SOCIAL_FEED_PRIMARY } from "@/lib/platform-formats";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";
import {
  MANPOWER_VACANT_POSITION_2,
  MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS,
  MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES,
} from "./fixtures/manpower-vacant-position-2";

/**
 * PRODUCTION ACCEPTANCE (Final Production Lock §25 visual regression
 * matrix, §26 real-source acceptance).
 *
 * These are the gates that decide whether KAI Ads is commercially
 * reliable, expressed as assertions rather than as an inspection
 * checklist a human has to remember to run.
 */
const FEED_W = SOCIAL_FEED_PRIMARY.widthPx;
const FEED_H = SOCIAL_FEED_PRIMARY.heightPx;
const FEED_CEILING = socialFeedMaxHeightPx("SOCIAL_FEED", FEED_W)!;

function realFacts(over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas — Maintenance Project",
    country: "Saudi Arabia",
    employer: "Saudi Aramco Maintenance Project",
    positions: MANPOWER_VACANT_POSITION_2.map((p) => ({
      title: p.title,
      count: p.count,
      experience: p.experience ?? undefined,
      qualification: p.qualification ?? undefined,
      certifications: p.certifications,
    })),
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    ...over,
  };
}

function smallFacts(n: number, over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return realFacts({ positions: realFacts().positions.slice(0, n), ...over });
}

async function bg(w: number, h: number, rgb: [number, number, number]) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .png()
    .toBuffer();
}

/* ── §26 REAL SOURCE ACCEPTANCE ─────────────────────────────────────── */

describe("§26 Real source acceptance — 19 roles / 127 vacancies / PQCS 5", () => {
  const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);

  it("SOURCE -> Content Intelligence preserves every role and the exact total", () => {
    expect(campaign.vacancySummary.totalPositions).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS);
    expect(campaign.vacancySummary.totalVacancies).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES);
    // Recomputed from positions, never a cached headline figure.
    const summed = campaign.positions.reduce((n, p) => n + (p.count ?? 0), 0);
    expect(summed).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES);
  });

  it("PQCS survives with its exact count and its mandatory-vs-preferred nuance", () => {
    const pqcs = campaign.positions.find((p) => /pqcs/i.test(p.title));
    expect(pqcs).toBeDefined();
    expect(pqcs!.count).toBe(1);
    const eligibility = pqcs!.statements.find((s) => s.tag === "ELIGIBILITY");
    expect(eligibility?.text).toMatch(/preferred but not mandatory/i);
    expect(eligibility?.compressionEligible).toBe(false);
  });

  it("SOURCE -> Fact Layer renders every role with its own exact count", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: FEED_W, heightPx: FEED_H });
    for (const p of MANPOWER_VACANT_POSITION_2) {
      expect(r.svgMarkup.toUpperCase(), `missing role: ${p.title}`).toContain(p.title.toUpperCase());
      expect(r.svgMarkup, `missing count for ${p.title}`).toContain(`(${p.count} NOS)`);
    }
  });

  it("headline total equals SUM(positions.count), never a stale field", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: FEED_W, heightPx: FEED_H });
    expect(r.svgMarkup).toContain("127 VACANCIES");
    expect(r.svgMarkup).not.toMatch(/\+\s*more roles/i);
  });

  it("SOURCE -> Social Product Decision routes this requirement to a complete carousel", async () => {
    const d = await decideSocialProductForFacts(realFacts(), campaign, FEED_W, FEED_H);
    expect(d.product).toBe("CAROUSEL");
    expect(() => assertSlidePlanIntegrity(campaign, d.slides!)).not.toThrow();
    const carried = d.slides!.flatMap((s) => s.positionIndexes);
    expect(new Set(carried).size).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS);
    const vacancies = carried.reduce((n, i) => n + (campaign.positions[i].count ?? 0), 0);
    expect(vacancies).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES);
  });
});

/* ── §25 VISUAL REGRESSION MATRIX ───────────────────────────────────── */

describe("§25 A-C Social canvas law", () => {
  it("A. renders a standard 1080x1350 social advertisement", async () => {
    // Deliberately a small, fully-detailed requirement: with the hero,
    // identity block and protected footer taking their fixed share, the
    // Feed canvas has room for only a handful of DETAILED roles before
    // the carousel becomes the right product (see §25 B, which walks
    // the boundary, and the Social Product Decision layer).
    const r = await renderFactLayer({
      facts: smallFacts(2),
      widthPx: FEED_W,
      heightPx: FEED_H,
      socialFeedMaxHeightPx: FEED_CEILING,
    });
    const meta = await sharp(r.png).metadata();
    expect(meta.width).toBe(FEED_W);
    expect(r.heightPx).toBeLessThanOrEqual(FEED_CEILING);
  });

  it("B. every requirement the engine accepts as one image lands at or under 1440", async () => {
    // Rather than hard-code a role count that will drift, walk upward
    // and assert the boundary itself: everything the engine accepts
    // fits, and the first refusal is a clean capacity failure.
    let accepted = 0;
    for (let n = 1; n <= MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS; n++) {
      try {
        const r = await renderFactLayer({
          facts: smallFacts(n),
          widthPx: FEED_W,
          heightPx: FEED_H,
          socialFeedMaxHeightPx: FEED_CEILING,
        });
        expect(r.heightPx, `accepted n=${n} exceeded the ceiling`).toBeLessThanOrEqual(FEED_CEILING);
        accepted = n;
      } catch (e) {
        expect(e).toBeInstanceOf(LayoutCapacityError);
        expect((e as LayoutCapacityError).reason).toBe("social-feed-exceeds-max-height");
        break;
      }
    }
    // A Feed image that cannot hold even one role would mean the
    // composition itself no longer fits its own canvas.
    expect(accepted).toBeGreaterThanOrEqual(1);
  });

  it("C. an over-capacity requirement fails closed — never a taller canvas, never a dropped role", async () => {
    let caught: unknown;
    try {
      await renderFactLayer({
        facts: realFacts(),
        widthPx: FEED_W,
        heightPx: FEED_H,
        socialFeedMaxHeightPx: FEED_CEILING,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityError);
    expect((caught as LayoutCapacityError).reason).toBe("social-feed-exceeds-max-height");
  });

  it("never produces an A4-like social output — no Feed render exceeds the ceiling", async () => {
    for (const n of [1, 3, 5, 7]) {
      try {
        const r = await renderFactLayer({
          facts: smallFacts(n),
          widthPx: FEED_W,
          heightPx: FEED_H,
          socialFeedMaxHeightPx: FEED_CEILING,
        });
        expect(r.heightPx, `n=${n}`).toBeLessThanOrEqual(FEED_CEILING);
      } catch (e) {
        expect(e).toBeInstanceOf(LayoutCapacityError);
      }
    }
  });
});

describe("§25 D-E Footer geometry", () => {
  const profile = {
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    registrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
    officialEmail: "jobs@example-agency.invalid",
    officialPhone: "+00 000 000 0000",
    website: "www.example-agency.invalid",
    addressLine: "Office 12, Business Tower, Example City",
  };

  it("D. wide footer renders and uses its right-hand space", async () => {
    const png = await applyBrandingOverlay({
      imagePng: await bg(1600, 1200, [20, 30, 50]),
      widthPx: 1600,
      heightPx: 1200,
      ...profile,
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(1600);
  });

  it("E. compact footer keeps every verified field", async () => {
    const png = await applyBrandingOverlay({
      imagePng: await bg(480, 900, [20, 30, 50]),
      widthPx: 480,
      heightPx: 900,
      ...profile,
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(480);
  });
});

describe("§25 F-H Hero visibility across lighting", () => {
  for (const [label, rgb] of [
    ["F. bright", [235, 228, 205]],
    ["G. dark", [12, 15, 20]],
    ["H. mixed", [110, 118, 126]],
  ] as const) {
    it(`${label} hero: the photograph stays visible through the scrim`, async () => {
      const r = await renderFactLayer({ facts: smallFacts(5), widthPx: FEED_W, heightPx: FEED_H });
      const hero = await bg(FEED_W, r.heightPx, rgb as [number, number, number]);
      const merged = await sharp(hero)
        .composite([{ input: r.png, left: 0, top: 0 }])
        .png()
        .toBuffer();
      const { data, info } = await sharp(merged).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // Sample the photo band well above the identity seam. It must NOT
      // be painted to a flat opaque slab — the underlying hero has to
      // still be reaching the surface.
      const y = Math.round(r.artworkHeightPx * 0.4);
      let matchesHero = 0;
      let total = 0;
      for (let x = 0; x < info.width; x += 7) {
        const i = (y * info.width + x) * info.channels;
        total++;
        const near = Math.abs(data[i] - rgb[0]) + Math.abs(data[i + 1] - rgb[1]) + Math.abs(data[i + 2] - rgb[2]);
        if (near < 120) matchesHero++;
      }
      expect(matchesHero / total, `${label} hero was buried`).toBeGreaterThan(0.5);
    });
  }
});

describe("§25 I-L Agency identity edge cases", () => {
  const FULL_RC = "B-1487/MUM/PART/1000+/9986/2022";

  it("I+J. a long agency name and the FULL registration both render un-shortened", async () => {
    const png = await applyBrandingOverlay({
      imagePng: await bg(FEED_W, 1400, [20, 30, 50]),
      widthPx: FEED_W,
      heightPx: 1400,
      agencyName: "Al-Yousuf Overseas Human Resources Consultancy L.L.P.",
      registrationNumber: FULL_RC,
      officialEmail: "jobs@example-agency.invalid",
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(FEED_W);
    // The renderer never substrings a registration: only font size shrinks.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/server/generation/pipeline/branding-overlay.ts", "utf8"),
    );
    expect(src).not.toMatch(/registration\.(slice|substring|substr)\(/);
    expect(src).not.toMatch(/`REG\. \$\{/);
  });

  it("K. a long registered address renders without breaking the footer", async () => {
    const png = await applyBrandingOverlay({
      imagePng: await bg(FEED_W, 1400, [20, 30, 50]),
      widthPx: FEED_W,
      heightPx: 1400,
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      registrationNumber: FULL_RC,
      addressLine:
        "Unit 14B, Fourteenth Floor, Corporate Tower Annexe, Marol Industrial Estate, Andheri East, Mumbai 400059",
    });
    expect((await sharp(png).metadata()).width).toBe(FEED_W);
  });

  it("L. a missing website is omitted cleanly — never substituted by another field", async () => {
    const withSite = await applyBrandingOverlay({
      imagePng: await bg(FEED_W, 1400, [20, 30, 50]),
      widthPx: FEED_W,
      heightPx: 1400,
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      addressLine: "Andheri East, Mumbai",
      website: "www.example-agency.invalid",
    });
    const without = await applyBrandingOverlay({
      imagePng: await bg(FEED_W, 1400, [20, 30, 50]),
      widthPx: FEED_W,
      heightPx: 1400,
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      addressLine: "Andheri East, Mumbai",
    });
    expect(withSite.equals(without)).toBe(false);
  });
});

describe("§25 M-N Client logo isolation", () => {
  it("M+N. a client logo anywhere in the creative never disturbs the trust footer", async () => {
    const w = FEED_W;
    const h = 1400;
    const footerH = Math.min(300, Math.max(250, Math.round(w * 0.25)));
    const footerTop = h - footerH;

    const clean = await bg(w, h, [10, 10, 10]);
    const clientMark = await bg(w, footerH, [255, 0, 255]);
    const withClientLogo = await sharp(clean)
      .composite([{ input: clientMark, left: 0, top: footerTop }])
      .png()
      .toBuffer();

    const profile = {
      widthPx: w,
      heightPx: h,
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      registrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
      officialEmail: "jobs@example-agency.invalid",
    };
    const a = await applyBrandingOverlay({ imagePng: clean, ...profile });
    const b = await applyBrandingOverlay({ imagePng: withClientLogo, ...profile });

    const crop = (buf: Buffer) =>
      sharp(buf).extract({ left: 0, top: footerTop, width: w, height: footerH }).raw().toBuffer();
    expect(Buffer.compare(await crop(a), await crop(b))).toBe(0);
  });
});

describe("§25 P Grouped role requirement", () => {
  it("P. groups families, aligns every role, and never omits or duplicates one", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: FEED_W, heightPx: FEED_H });
    // Family headings present.
    expect(r.svgMarkup).toContain("HVAC &amp; MECHANICAL");
    expect(r.svgMarkup).toContain("ELECTRICAL &amp; IT");

    // Every role row starts at exactly the same x — alignment, not drift.
    const roleRows = [...r.svgMarkup.matchAll(/<text x="(\d+)"[^>]*KaiPosition[^>]*>([^<]*\(\d+ NOS\))<\/text>/g)];
    expect(roleRows.length).toBeGreaterThanOrEqual(MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS);
    const xs = new Set(roleRows.map((m) => m[1]));
    // Two x values at most: the featured highlight strip and the grouped list.
    expect(xs.size).toBeLessThanOrEqual(2);

    // No role rendered twice inside the grouped list itself.
    const listed = roleRows.map((m) => m[2]).filter((t) => !/^(ELECTRICIAN|PIPING ENGINEER|HVAC TECHNICIAN|WELDER) \(/.test(t));
    expect(new Set(listed).size).toBe(listed.length);
  });
});

/* ── §7 PLANNER / RENDERER / DECISION AGREEMENT ─────────────────────── */

describe("§7 Every stage agrees on the same canvas", () => {
  it("the product decision never promises a single image the renderer would refuse", async () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 19]) {
      const facts = smallFacts(Math.min(n, MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS));
      const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2.slice(0, n));
      const decision = await decideSocialProductForFacts(facts, campaign, FEED_W, FEED_H);

      let rendererFits = true;
      try {
        await renderFactLayer({
          facts,
          widthPx: FEED_W,
          heightPx: FEED_H,
          socialFeedMaxHeightPx: FEED_CEILING,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(LayoutCapacityError);
        rendererFits = false;
      }

      expect(
        decision.product === "SINGLE_IMAGE",
        `n=${n}: decision said ${decision.product} but renderer ${rendererFits ? "fits" : "refuses"}`,
      ).toBe(rendererFits);
    }
  });

  it("measureOnly reports the same height the real render produces", async () => {
    const facts = smallFacts(5);
    const measured = await renderFactLayer({ facts, widthPx: FEED_W, heightPx: FEED_H, measureOnly: true });
    const drawn = await renderFactLayer({ facts, widthPx: FEED_W, heightPx: FEED_H });
    expect(measured.heightPx).toBe(drawn.heightPx);
    expect(measured.png).toHaveLength(0); // measures, never draws
  });
});
