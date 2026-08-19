import { describe, expect, it } from "vitest";
import { buildRecruitmentCampaign, campaignFromAdvertisementFacts } from "@/server/generation/pipeline/content-intelligence";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import { decideSocialProductForFacts, assertSlidePlanIntegrity, factsForSlide } from "@/server/generation/pipeline/social-product-decision";
import { socialFeedMaxHeightPx, SOCIAL_FEED_PRIMARY } from "@/lib/platform-formats";
import { isApprovedDtpWidthPx } from "@/lib/dtp-format-law";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "@/server/generation/pipeline/types";
import {
  MANPOWER_REAL,
  MANPOWER_REAL_FACTS_POSITIONS,
  MANPOWER_REAL_EXPECTED,
  MANPOWER_REAL_TOTAL_POSITIONS,
  MANPOWER_REAL_TOTAL_VACANCIES,
} from "./fixtures/manpower-vacant-position-real";

/**
 * FINAL REAL-SOURCE ACCEPTANCE — the actual uploaded "Manpower Vacant
 * Position" PDF, 19 roles / 127 vacancies, not the synthetic
 * manpower-vacant-position-2 stress fixture.
 */

const FEED_W = SOCIAL_FEED_PRIMARY.widthPx;
const FEED_H = SOCIAL_FEED_PRIMARY.heightPx;
const CEILING = socialFeedMaxHeightPx("SOCIAL_FEED", FEED_W)!;

const agencyProfile: VerifiedAgencyProfile = {
  agencyName: "Al Yousuf Enterprises LLP",
  rcNumber: "B-0655/MUM/PER",
  fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  registeredAddress: "Registered Office, Mumbai, Maharashtra, India",
  officialPhone: "+91 86559 60414",
  officialEmail: "jobs@alyousufent.com",
  website: "https://www.alyousufent.com",
  verificationStatus: "VERIFIED",
};

function realFacts(over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    // Raw CRM-style header, deliberately: the reconstruction must replace it.
    header: "Operation Manager + 18 more roles — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    // The source names Saudi Aramco only inside experience/approval
    // criteria — never as the employer. Must stay null.
    employer: null,
    positions: MANPOWER_REAL_FACTS_POSITIONS,
    benefits: [],
    interview: [],
    // The PDF is marked "Urgent" and "Imporatant and need to start Preparation".
    urgent: true,
    contact: { phone: "+91 86559 60414", email: "jobs@alyousufent.com" },
    agencyProfile,
    ...over,
  };
}

const campaign = buildRecruitmentCampaign(MANPOWER_REAL);

/* ── STEP 2 — FACTUAL ACCEPTANCE ─────────────────────────────────── */

describe("STEP 2 — 19 roles / 127 vacancies survive exactly", () => {
  it("the fixture itself matches the source table role-for-role", () => {
    expect(MANPOWER_REAL_EXPECTED).toHaveLength(MANPOWER_REAL_TOTAL_POSITIONS);
    const total = MANPOWER_REAL_EXPECTED.reduce((n, [, c]) => n + c, 0);
    expect(total).toBe(MANPOWER_REAL_TOTAL_VACANCIES);
  });

  it("page subtotals match the source pages (page 1 is 47, not 45)", () => {
    const sum = (rows: [string, number][]) => rows.reduce((n, [, c]) => n + c, 0);
    expect(sum(MANPOWER_REAL_EXPECTED.slice(0, 10))).toBe(47);
    expect(sum(MANPOWER_REAL_EXPECTED.slice(10, 15))).toBe(60);
    expect(sum(MANPOWER_REAL_EXPECTED.slice(15, 19))).toBe(20);
  });

  it("Content Intelligence preserves every role and recomputes the exact total", () => {
    expect(campaign.vacancySummary.totalPositions).toBe(MANPOWER_REAL_TOTAL_POSITIONS);
    expect(campaign.vacancySummary.totalVacancies).toBe(MANPOWER_REAL_TOTAL_VACANCIES);
    for (const [title, count] of MANPOWER_REAL_EXPECTED) {
      const p = campaign.positions.find((x) => x.title === title);
      expect(p, `missing role: ${title}`).toBeDefined();
      expect(p!.count, `wrong count for ${title}`).toBe(count);
    }
  });

  it("every role and its exact count reaches the canvas", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: FEED_W, heightPx: FEED_H * 3 });
    const svg = r.svgMarkup.toUpperCase();
    for (const [title, count] of MANPOWER_REAL_EXPECTED) {
      // displayTitle normalises source defects for DISPLAY only.
      const shown = title.replace(/Adminstator/i, "Administrator").replace(/Qualality/i, "Quality");
      expect(svg, `missing role on canvas: ${title}`).toContain(shown.toUpperCase());
      expect(svg, `missing count for ${title}`).toContain(`(${count} NOS)`);
    }
  }, 120_000);
});

/* ── STEP 3 — SOURCE-SPECIFIC CONTENT INTELLIGENCE ───────────────── */

describe("STEP 3 — role-specific facts remain intact and distinct", () => {
  it("WPR's Gulf/Aramco experience stays NOT MANDATORY, never a hard requirement", async () => {
    const wpr = MANPOWER_REAL.find((p) => p.title === "WPR")!;
    expect(wpr.experience).toBe("2 Years");
    expect(wpr.gulfExperience).toBe("Not Mandatory");

    const r = await renderFactLayer({
      facts: realFacts({ positions: MANPOWER_REAL_FACTS_POSITIONS.filter((p) => p.title === "WPR") }),
      widthPx: FEED_W,
      heightPx: FEED_H,
    });
    expect(r.svgMarkup).toMatch(/Not Mandatory/i);
    // Never rewritten into a positive requirement.
    expect(r.svgMarkup).not.toMatch(/\bMandatory\b(?!\s*$)(?<!Not Mandatory)/);
  }, 60_000);

  it("PQCS keeps 'preferred but not mandatory' as an ELIGIBILITY statement, never compressed away", () => {
    const pqcs = campaign.positions.find((p) => p.title === "PQCS")!;
    expect(pqcs.count).toBe(5);
    const elig = pqcs.statements.find((s) => s.tag === "ELIGIBILITY");
    expect(elig?.text).toMatch(/preferred but not mandatory/i);
    expect(elig?.compressionEligible).toBe(false);
    // NMR tickets survive as a certification statement.
    expect(pqcs.statements.some((s) => s.tag === "CERTIFICATION" && /NMR/.test(s.text))).toBe(true);
  });

  it("total experience and Gulf experience remain two distinct facts, never merged", () => {
    const cases: [string, string, string | undefined][] = [
      ["Time Keeper/ HR Executive", "4-5 Years", "2-3 Years"],
      ["Procurement Manager", "10-12 Years", "03-04 Years"],
      ["Planning Engineer Lead", "7-8 Years", "2 Years"],
      ["Project Manager", "15 Years", "5 Years"],
      ["PQCS", "10 Years", "5 Years"],
      // Trade roles the source gives NO Gulf figure for — never invented.
      ["Electrician", "5 Years", undefined],
      ["HVAC Technician", "5 Years", undefined],
      ["Tile Mason", "5 Years", undefined],
    ];
    for (const [title, exp, gulf] of cases) {
      const p = MANPOWER_REAL.find((x) => x.title === title)!;
      expect(p.experience, title).toBe(exp);
      expect(p.gulfExperience ?? undefined, title).toBe(gulf);
    }
  });

  it("Operation Manager receives no invented experience — the source states none", () => {
    const om = MANPOWER_REAL.find((p) => p.title === "Operation Manager")!;
    expect(om.experience ?? null).toBeNull();
    expect(om.gulfExperience ?? null).toBeNull();
    expect(campaign.positions.find((p) => p.title === "Operation Manager")!.statements.some((s) => s.tag === "EXPERIENCE")).toBe(false);
  });

  it("certification differences between Project/Quality/HSE/PQCS are not flattened", () => {
    const find = (t: string) => MANPOWER_REAL.find((p) => p.title === t)!.remarks ?? "";
    expect(find("Project Manager")).toMatch(/PMP/);
    expect(find("Qualality Manager")).toMatch(/ISO certification Lead Auditor/i);
    expect(find("HSE Manager")).toMatch(/NeBosch/i);
    expect(find("HSE Manager")).toMatch(/Train the trainer/i);
    expect(find("PQCS")).toMatch(/NMR 601,602,603/);
    // HSE is the only one of the four with NEBOSH; Quality the only one with ISO.
    expect(find("Project Manager")).not.toMatch(/NeBosch|ISO certification/i);
    expect(find("PQCS")).not.toMatch(/NeBosch|ISO certification/i);
  });
});

/* ── STEP 6 — HEADLINE / EMPLOYER ────────────────────────────────── */

describe("STEP 6 — candidate-facing headline, no invented employer", () => {
  it("never claims Saudi Aramco as the employer — the source uses it only as a criterion", async () => {
    const facts = realFacts();
    expect(facts.employer).toBeNull();
    const r = await renderFactLayer({ facts, widthPx: FEED_W, heightPx: FEED_H * 3 });
    // Aramco may legitimately appear inside a role's own criteria text,
    // but never as the campaign's employer line.
    expect(r.svgMarkup).not.toMatch(/employer/i);
  }, 60_000);

  it("never typesets the raw CRM header", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: FEED_W, heightPx: FEED_H * 3 });
    expect(r.svgMarkup).not.toMatch(/\+\s*18\s*more\s*roles/i);
  }, 60_000);
});

/* ── STEP 8 — SINGLE vs CAROUSEL, measured ───────────────────────── */

describe("STEP 8 — capacity decision is measured, and every slide obeys the format law", () => {
  it("routes the real requirement through the measured decision with full integrity", async () => {
    const facts = realFacts();
    const bridged = campaignFromAdvertisementFacts(facts);
    const decision = await decideSocialProductForFacts(facts, bridged, FEED_W, FEED_H);

    if (decision.product === "SINGLE_IMAGE") {
      const r = await renderFactLayer({ facts, widthPx: FEED_W, heightPx: FEED_H });
      expect(r.heightPx).toBeLessThanOrEqual(CEILING);
      return;
    }

    expect(() => assertSlidePlanIntegrity(bridged, decision.slides!)).not.toThrow();

    // Every role on exactly one slide; totals exact.
    const carried = decision.slides!.flatMap((s) => s.positionIndexes);
    expect(new Set(carried).size).toBe(carried.length);
    expect(carried.length).toBe(MANPOWER_REAL_TOTAL_POSITIONS);
    const vacancies = carried.reduce((n, i) => n + (bridged.positions[i].count ?? 0), 0);
    expect(vacancies).toBe(MANPOWER_REAL_TOTAL_VACANCIES);

    // Format law: no slide may exceed the Social Feed ceiling, and no
    // slide width may collide with an approved DTP column slot.
    for (const slide of decision.slides!) {
      const measured = await renderFactLayer({
        facts: factsForSlide(facts, slide),
        widthPx: FEED_W,
        heightPx: FEED_H,
        measureOnly: true,
      });
      expect(measured.heightPx, `slide ${slide.index} exceeds ceiling`).toBeLessThanOrEqual(CEILING);
    }
    expect(isApprovedDtpWidthPx(FEED_W)).toBe(false); // never a DTP conversion
  }, 300_000);
});
