import { describe, expect, it } from "vitest";
import { renderFactLayer, LayoutCapacityError } from "@/server/generation/pipeline/fact-layer";
import { socialFeedMaxHeightPx, PLATFORM_FORMATS } from "@/lib/platform-formats";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * SOCIAL FORMAT LAW (LOCKED, 2026-08):
 *
 * SOCIAL_FEED: canonical 1080x1350 (4:5), hard ceiling 1080x1440 (3:4).
 * A dense recruitment requirement must never solve itself by growing the
 * canvas past the ceiling — it fails closed via the existing
 * LayoutCapacityError mechanism, exactly like the print fillSlot path
 * already does for a booked physical slot.
 *
 * SOCIAL_STORY (1080x1920) is a separate, fixed-shape family — never
 * used as Feed overflow.
 *
 * DTP/print is governed by its own physical-slot law and must never be
 * subject to the 1080px Social rule.
 */
function facts(count: number, over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Halliburton",
    projectType: "Major Oil & Gas Project",
    positions: Array.from({ length: count }, (_, i) => ({ title: `Field Professional Level ${i + 1}` })),
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    ...over,
  };
}

describe("platform-formats — Social Format Law", () => {
  it("computes the exact 1080x1440 ceiling for the canonical SOCIAL_FEED width", () => {
    expect(socialFeedMaxHeightPx("SOCIAL_FEED", 1080)).toBe(1440);
  });

  it("returns null (unconstrained) for SOCIAL_STORY and SOCIAL_OTHER", () => {
    expect(socialFeedMaxHeightPx("SOCIAL_STORY", 1080)).toBeNull();
    expect(socialFeedMaxHeightPx("SOCIAL_OTHER", 1600)).toBeNull();
  });

  it("scales the same 3:4 ceiling ratio to a non-1080 SOCIAL_FEED base width", () => {
    expect(socialFeedMaxHeightPx("SOCIAL_FEED", 1200)).toBe(1600);
  });

  it("classifies every registered platform format into exactly one family", () => {
    expect(PLATFORM_FORMATS.generic_portrait.family).toBe("SOCIAL_FEED");
    expect(PLATFORM_FORMATS.instagram_post.family).toBe("SOCIAL_FEED");
    expect(PLATFORM_FORMATS.whatsapp_status.family).toBe("SOCIAL_STORY");
    expect(PLATFORM_FORMATS.instagram_story.family).toBe("SOCIAL_STORY");
    expect(PLATFORM_FORMATS.generic_landscape.family).toBe("SOCIAL_OTHER");
  });

  it("the canonical generic_portrait format IS exactly 1080x1350, the law's own NORMAL size", () => {
    expect(PLATFORM_FORMATS.generic_portrait.widthPx).toBe(1080);
    expect(PLATFORM_FORMATS.generic_portrait.heightPx).toBe(1350);
  });
});

describe("fact-layer — Social Feed hard ceiling", () => {
  it("fails closed with LayoutCapacityError(reason: social-feed-exceeds-max-height) instead of growing past 1440px", async () => {
    // A genuinely dense requirement (60 roles) at the canonical 1080
    // width — without the ceiling this would grow well past 1440px
    // (canvas-grows-to-fit is otherwise unbounded up to MAX_ASPECT*W).
    let caught: unknown;
    try {
      await renderFactLayer({
        facts: facts(60),
        widthPx: 1080,
        heightPx: 1350,
        socialFeedMaxHeightPx: 1440,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityError);
    expect((caught as LayoutCapacityError).reason).toBe("social-feed-exceeds-max-height");
  });

  it("renders normally, within the ceiling, for a requirement that genuinely fits", async () => {
    const r = await renderFactLayer({
      facts: facts(5),
      widthPx: 1080,
      heightPx: 1350,
      socialFeedMaxHeightPx: 1440,
    });
    expect(r.heightPx).toBeLessThanOrEqual(1440);
  });

  it("without socialFeedMaxHeightPx (Story/DTP/other), the ceiling never applies — unaffected by this law", async () => {
    // Same dense 60-role requirement, no ceiling supplied — must NOT
    // throw the social-feed-specific error (may still hit the generic
    // MAX_ASPECT bound at a much higher height, which is unrelated,
    // pre-existing behaviour this law does not change).
    let caught: unknown;
    try {
      await renderFactLayer({ facts: facts(60), widthPx: 1080, heightPx: 1350 });
    } catch (e) {
      caught = e;
    }
    if (caught instanceof LayoutCapacityError) {
      expect(caught.reason).not.toBe("social-feed-exceeds-max-height");
    }
  });

  it("DTP/print (fillSlot) is never subject to the Social Feed ceiling, even if one is supplied by mistake", async () => {
    // The physical-slot law governs print; this proves the two systems
    // stay structurally separate even under a defensive misconfiguration.
    // 1500px @ 300dpi = 12.7cm — an approved DTP column width (4 columns).
    const r = await renderFactLayer({
      facts: facts(10),
      widthPx: 1500,
      heightPx: 1200,
      printOrNewspaper: true,
      socialFeedMaxHeightPx: 200, // absurdly small — would always trip if not correctly bypassed
    });
    expect(r.heightPx).toBe(1200); // print fills its booked slot exactly
  });
});
