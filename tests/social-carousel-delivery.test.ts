import { describe, expect, it, vi } from "vitest";
import {
  buildRecruitmentCampaign,
  compressPresentation,
} from "@/server/generation/pipeline/content-intelligence";
import {
  decideSocialProductForFacts,
  assertSlidePlanIntegrity,
  factsForSlide,
} from "@/server/generation/pipeline/social-product-decision";
import {
  renderSocialCarousel,
  assertCarouselIntegrity,
} from "@/server/generation/pipeline/social-carousel";
import { socialFeedMaxHeightPx } from "@/lib/platform-formats";
import { MANPOWER_VACANT_POSITION_2 } from "./fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "@/server/generation/pipeline/types";

/**
 * SOCIAL CAROUSEL — REAL OUTPUT (Final Commercial Delivery Directive
 * §3, §6, §7, §8, §18).
 *
 * The decision layer was already tested for deciding correctly. These
 * tests cover the part that turns that decision into rendered slides,
 * and the factual-integrity properties that must hold across a product
 * made of more than one canvas.
 */

const agencyProfile: VerifiedAgencyProfile = {
  agencyName: "Sample Overseas Recruitment Agency LLP",
  rcNumber: "PLACEHOLDER-RC-0000",
  fullRegistrationNumber: "PLACEHOLDER-RC-0000/EXAMPLE/0000+/0-0/0/0000/0000",
  registeredAddress: "Placeholder Address Line, Example City, Example Country",
  officialPhone: "+00 000 000 0000 (placeholder)",
  officialEmail: "placeholder@example-agency.invalid",
  website: "www.example-agency.invalid",
  verificationStatus: "VERIFIED",
  approvedBadges: [],
};

function realSourceFacts(): AdvertisementFacts {
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
    benefits: [{ label: "Free Food & Accommodation" }, { label: "Free Air Ticket" }],
    interview: [{ date: "5th September 2026", location: "Mumbai" }],
    contact: { phone: "+91 98765 43210", email: "recruitment@example-agency.invalid" },
    agencyProfile,
  };
}

describe("JD compression law (§6)", () => {
  it("shortens presentation to an exact equivalent, never changing the fact", () => {
    expect(compressPresentation("minimum of 15 years")).toBe("15+ yrs");
    expect(compressPresentation("8 to 10 years")).toBe("8-10 yrs");
    expect(compressPresentation("10 years")).toBe("10 yrs");
    expect(compressPresentation("Bachelor's degree in Engineering")).toBe("Bachelor's in Engg.");
  });

  it("never invents, drops or rounds a number", () => {
    for (const source of ["minimum of 15 years", "8 to 10 years", "5 to 8 years", "10 years"]) {
      const digitsIn = source.match(/\d+/g) ?? [];
      const digitsOut = compressPresentation(source).match(/\d+/g) ?? [];
      expect(digitsOut).toEqual(digitsIn);
    }
  });

  it("leaves text it has no rule for exactly as verified", () => {
    expect(compressPresentation("NMR 601")).toBe("NMR 601");
    expect(compressPresentation("Trade Certificate")).toBe("Trade Certificate");
  });
});

describe("Carousel counts are campaign facts, not canvas facts", () => {
  it("states the TRUE campaign total on a cover that shows only hook roles", async () => {
    const facts = realSourceFacts();
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const decision = await decideSocialProductForFacts(facts, campaign, 1080, 1350);
    expect(decision.product).toBe("CAROUSEL");

    const cover = decision.slides!.find((s) => s.kind === "COVER")!;
    const coverFacts = factsForSlide(facts, cover, 4);

    // The cover draws a SELECTION...
    expect(coverFacts.positions.length).toBeLessThan(facts.positions.length);
    // ...but reports the whole campaign.
    expect(coverFacts.campaignTotals).toEqual({
      vacancies: campaign.vacancySummary.totalVacancies,
      roles: campaign.positions.length,
    });
  });

  it("never lets a family slide inherit the campaign total for its own list", async () => {
    const facts = realSourceFacts();
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const decision = await decideSocialProductForFacts(facts, campaign, 1080, 1350);

    for (const slide of decision.slides!.filter((s) => s.kind === "ROLE_FAMILY")) {
      const slideFacts = factsForSlide(facts, slide);
      expect(slideFacts.campaignTotals ?? null).toBeNull();
      expect(slideFacts.positions.length).toBe(slide.positionIndexes.length);
    }
  });

  it("gives the trust slide the campaign total rather than a count of nothing", async () => {
    const facts = realSourceFacts();
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const decision = await decideSocialProductForFacts(facts, campaign, 1080, 1350);

    const trust = decision.slides!.find((s) => s.kind === "TRUST_CTA")!;
    const trustFacts = factsForSlide(facts, trust);
    expect(trustFacts.positions).toHaveLength(0);
    expect(trustFacts.campaignTotals?.vacancies).toBe(campaign.vacancySummary.totalVacancies);
  });
});

describe("Slide identity (§8)", () => {
  it("numbers a role family that had to be split across slides", async () => {
    const facts = realSourceFacts();
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const decision = await decideSocialProductForFacts(facts, campaign, 1080, 1350);

    const labels = decision
      .slides!.filter((s) => s.kind === "ROLE_FAMILY")
      .flatMap((s) => s.familyLabels);

    // No two role slides may be indistinguishable from each other.
    expect(new Set(labels).size).toBe(labels.length);

    // A split family is numbered "(n of m)" rather than repeated bare.
    const numbered = labels.filter((l) => /\(\d+ of \d+\)$/.test(l));
    expect(numbered.length).toBeGreaterThan(0);
  });
});

describe("Rendered carousel — real 19-role / 127-vacancy source", () => {
  it("renders every slide within the Social Feed ceiling, losing no verified fact", async () => {
    const facts = realSourceFacts();
    const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
    const decision = await decideSocialProductForFacts(facts, campaign, 1080, 1350);
    expect(decision.product).toBe("CAROUSEL");
    assertSlidePlanIntegrity(campaign, decision.slides!);

    const rendered = await renderSocialCarousel({
      facts,
      campaign,
      slides: decision.slides!,
      agencyProfile,
    });

    // Format law: every slide is a real Social Feed canvas.
    const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", 1080)!;
    for (const slide of rendered) {
      expect(slide.widthPx).toBe(1080);
      expect(slide.heightPx).toBeLessThanOrEqual(ceiling);
      expect(slide.png.byteLength).toBeGreaterThan(0);
    }

    // Structure: one cover, one trust slide, role slides between them.
    expect(rendered[0].kind).toBe("COVER");
    expect(rendered[rendered.length - 1].kind).toBe("TRUST_CTA");

    // Factual integrity across the whole product.
    expect(() => assertCarouselIntegrity(campaign, rendered)).not.toThrow();
  }, 120_000);
});

/**
 * The directive's core claim: the carousel decision must be REAL
 * PIPELINE OUTPUT, not a recommendation attached to a single image.
 * This drives the production entry point end-to-end with a stub image
 * provider and asserts the pipeline hands back rendered slides.
 */
describe("Pipeline delivers the carousel (§3)", () => {
  it("returns rendered slides for a requirement too dense for one Social Feed canvas", async () => {
    const artwork = await (await import("sharp")).default({
      create: { width: 1080, height: 1350, channels: 3, background: { r: 60, g: 70, b: 80 } },
    })
      .png()
      .toBuffer();

    vi.doMock("@/server/ai/image", () => ({
      getImageGenerationProvider: () => ({
        generate: async () => ({
          output: { imageBase64: artwork.toString("base64") },
          usage: { model: "stub", latencyMs: 1, estimatedCostUsd: 0 },
        }),
      }),
    }));
    // The Creative Brief is a text-model call; this test is about
    // delivery, not brief quality, so the brief is stubbed rather than
    // requiring a text provider.
    vi.doMock("@/server/generation/pipeline/creative-brief", () => ({
      buildCreativeBrief: async () => ({
        brief: "stub creative brief",
        usage: { model: "stub", latencyMs: 1, estimatedCostUsd: 0 },
      }),
    }));

    const { generateAdvertisement } = await import("@/server/generation/pipeline/generate");

    const result = await generateAdvertisement({
      facts: realSourceFacts(),
      widthPx: 1080,
      heightPx: 1350,
      socialFeedMaxHeightPx: socialFeedMaxHeightPx("SOCIAL_FEED", 1080),
      agencyProfile,
    });

    expect(result.socialProduct.product).toBe("CAROUSEL");
    expect(result.carousel).not.toBeNull();
    expect(result.carousel!.length).toBeGreaterThan(1);
    expect(result.carousel![0].kind).toBe("COVER");
    expect(result.carousel![result.carousel!.length - 1].kind).toBe("TRUST_CTA");

    // Every slide is a real rendered PNG within the format ceiling.
    const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", 1080)!;
    for (const slide of result.carousel!) {
      expect(slide.png.byteLength).toBeGreaterThan(0);
      expect(slide.heightPx).toBeLessThanOrEqual(ceiling);
    }

    // imagePng stays a real advertisement for single-image callers.
    expect(result.imagePng.byteLength).toBeGreaterThan(0);
  }, 180_000);
});
