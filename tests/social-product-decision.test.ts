import { describe, expect, it } from "vitest";
import { buildRecruitmentCampaign, type PositionSourceRecord } from "@/server/generation/pipeline/content-intelligence";
import {
  decideSocialProduct,
  measureContentMass,
  availableBodyHeight,
  assertSlidePlanIntegrity,
} from "@/server/generation/pipeline/social-product-decision";
import { MANPOWER_VACANT_POSITION_2 } from "./fixtures/manpower-vacant-position-2";

/**
 * SOCIAL PRODUCT DECISION (Final Production Lock §10A) — the layer that
 * decides whether a requirement is a single image or a carousel, from
 * MEASURED information mass rather than a crude role count.
 */
describe("Content mass measurement", () => {
  it("reports every signal the lock requires, not just a role count", () => {
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const mass = measureContentMass(campaign, 1080);
    expect(mass.roleCount).toBe(19);
    expect(mass.familyCount).toBeGreaterThan(1);
    expect(mass.visibleRoleLines).toBeGreaterThan(mass.roleCount); // headings + detail lines
    expect(mass.totalMeasuredTextHeight).toBeGreaterThan(0);
    for (const key of [
      "sharedRequirementCount",
      "uniqueRequirementCount",
      "qualificationMass",
      "certificationMass",
      "benefitMass",
      "interviewMass",
    ] as const) {
      expect(typeof mass[key]).toBe("number");
    }
  });

  it("grows with information density, not merely with role count", () => {
    const bare: PositionSourceRecord[] = Array.from({ length: 12 }, (_, i) => ({
      title: `Welder Grade ${i + 1}`,
      count: 2,
    }));
    const detailed: PositionSourceRecord[] = bare.map((p) => ({
      ...p,
      experience: "5 to 8 years of Gulf refinery experience",
      qualification: "ITI / Diploma in Mechanical Engineering with trade certification",
      certifications: ["NMR 601", "NMR 602"],
    }));
    const bareMass = measureContentMass(buildRecruitmentCampaign(bare), 1080);
    const detailedMass = measureContentMass(buildRecruitmentCampaign(detailed), 1080);
    expect(bareMass.roleCount).toBe(detailedMass.roleCount);
    expect(detailedMass.totalMeasuredTextHeight).toBeGreaterThan(bareMass.totalMeasuredTextHeight);
  });
});

describe("Single image vs carousel", () => {
  it("keeps a small requirement as a single image", () => {
    const campaign = buildRecruitmentCampaign([
      { title: "HVAC Technician", count: 10 },
      { title: "Electrician", count: 8 },
      { title: "Welder", count: 5 },
    ]);
    const d = decideSocialProduct(campaign, 1080);
    expect(d.product).toBe("SINGLE_IMAGE");
    expect(d.slides).toBeUndefined();
    expect(d.reason).toMatch(/Fits one image/);
  });

  it("recommends a carousel for the real 19-role / 127-vacancy requirement, and says why", () => {
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const d = decideSocialProduct(campaign, 1080);
    expect(d.product).toBe("CAROUSEL");
    // The lock requires the system to report WHY, with real numbers.
    expect(d.reason).toMatch(/Single-image capacity exceeded after family grouping/);
    expect(d.reason).toMatch(/19 positions/);
    expect(d.reason).toMatch(/slide carousel/);
    expect(d.requiredBodyHeightPx).toBeGreaterThan(d.availableBodyHeightPx);
  });

  it("is not a role-count threshold — many bare roles can still be one image", () => {
    // 16 roles with no qualifications/certifications at all. A crude
    // `roles > 15 -> carousel` rule (explicitly rejected by the lock)
    // would split this; measured mass should not.
    const bare = Array.from({ length: 16 }, (_, i) => ({ title: `Fitter ${i + 1}`, count: 1 }));
    const mass = measureContentMass(buildRecruitmentCampaign(bare), 1080);
    const available = availableBodyHeight(1080, 1440);
    // Assert the decision follows the measurement, whichever way it lands.
    const d = decideSocialProduct(buildRecruitmentCampaign(bare), 1080);
    expect(d.product).toBe(mass.totalMeasuredTextHeight <= available ? "SINGLE_IMAGE" : "CAROUSEL");
  });
});

describe("Carousel slide plan — factual integrity", () => {
  const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
  const decision = decideSocialProduct(campaign, 1080);

  it("opens with a cover that is not a dump of all roles, and closes with trust/CTA", () => {
    const slides = decision.slides!;
    expect(slides[0].kind).toBe("COVER");
    expect(slides[0].positionIndexes).toHaveLength(0);
    expect(slides[slides.length - 1].kind).toBe("TRUST_CTA");
    expect(slides[slides.length - 1].positionIndexes).toHaveLength(0);
    expect(slides.some((s) => s.kind === "ROLE_FAMILY")).toBe(true);
  });

  it("places every position on exactly one slide — none dropped, none duplicated", () => {
    const slides = decision.slides!;
    expect(() => assertSlidePlanIntegrity(campaign, slides)).not.toThrow();
    const placed = slides.flatMap((s) => s.positionIndexes);
    expect(placed).toHaveLength(campaign.positions.length);
    expect(new Set(placed).size).toBe(campaign.positions.length);
  });

  it("preserves the exact 127-vacancy total across the whole carousel", () => {
    const slides = decision.slides!;
    const total = slides
      .flatMap((s) => s.positionIndexes)
      .reduce((sum, i) => sum + (campaign.positions[i].count ?? 0), 0);
    expect(total).toBe(127);
    expect(total).toBe(campaign.vacancySummary.totalVacancies);
  });

  it("detects a dropped position rather than shipping an incomplete carousel", () => {
    const broken = decision.slides!.map((s) => ({ ...s, positionIndexes: s.positionIndexes.slice(1) }));
    expect(() => assertSlidePlanIntegrity(campaign, broken)).toThrow(/drops \d+ position/);
  });

  it("detects a duplicated position rather than shipping a repeated role", () => {
    const slides = decision.slides!;
    const roleSlides = slides.filter((s) => s.kind === "ROLE_FAMILY");
    const dup = slides.map((s) =>
      s.index === roleSlides[1].index
        ? { ...s, positionIndexes: [...s.positionIndexes, roleSlides[0].positionIndexes[0]] }
        : s,
    );
    expect(() => assertSlidePlanIntegrity(campaign, dup)).toThrow(/duplicates position/);
  });
});
