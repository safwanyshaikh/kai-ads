import { describe, expect, it } from "vitest";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { getPlatformFormat } from "@/lib/platform-formats";

describe("selectBadgeConfig — the recruiter never manually designs the badge", () => {
  it("NEWSPAPER style always gets a compact badge — dense layouts need the badge out of the way", () => {
    const badge = selectBadgeConfig({
      style: "NEWSPAPER",
      density: "MEDIUM",
      positionCount: 5,
      platformFormat: getPlatformFormat("generic_square"),
    });
    expect(badge.size).toBe("compact");
  });

  it("HIGH density always gets a compact badge regardless of style", () => {
    const badge = selectBadgeConfig({
      style: "TYPOGRAPHY",
      density: "HIGH",
      positionCount: 25,
      platformFormat: getPlatformFormat("generic_square"),
    });
    expect(badge.size).toBe("compact");
  });

  it("a single low-density critical requirement gets a more prominent badge", () => {
    const badge = selectBadgeConfig({
      style: "VISUAL",
      density: "LOW",
      positionCount: 1,
      platformFormat: getPlatformFormat("generic_square"),
    });
    expect(badge.size).toBe("standard");
  });

  it("narrow (9:16) formats never get a circular badge — too little horizontal room", () => {
    const badge = selectBadgeConfig({
      style: "TYPOGRAPHY",
      density: "MEDIUM",
      positionCount: 4,
      platformFormat: getPlatformFormat("instagram_story"),
    });
    expect(badge.shape).not.toBe("circular");
  });

  it("always returns a valid shape and size", () => {
    const validShapes = ["circular", "rounded_square", "compact_rectangle"];
    const validSizes = ["compact", "standard", "large"];
    const badge = selectBadgeConfig({
      style: "VISUAL",
      density: "MEDIUM",
      positionCount: 3,
      platformFormat: getPlatformFormat("facebook_post"),
    });
    expect(validShapes).toContain(badge.shape);
    expect(validSizes).toContain(badge.size);
  });
});
