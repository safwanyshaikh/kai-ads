import { describe, expect, it } from "vitest";
import { renderSectionComposition } from "@/server/generation/section-renderer";
import { buildFallbackBackgroundSvgFragment } from "@/server/generation/fallback-background";
import { getThemeAccentColor } from "@/server/generation/theme-recommendation.service";
import { getPlatformFormat } from "@/lib/platform-formats";

const baseInput = {
  platformFormat: getPlatformFormat("generic_square"),
  header: "Pipe Fitters Needed — Gulf",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: null,
  positions: [{ title: "Pipe Fitter", count: 8 }],
  benefits: [],
  interview: [],
  contact: { phone: "+966-500000000" },
  footer: "RA-1234",
  agencyName: "Al Noor Overseas Recruitment",
  raLicenseId: "RA-1234-2024",
  qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
  badge: { shape: "rounded_square" as const, size: "standard" as const },
};

describe("renderSectionComposition — VISUAL style", () => {
  it("embeds a provided AI background image as a full-canvas layer", () => {
    const svg = renderSectionComposition({
      ...baseInput,
      style: "VISUAL",
      backgroundImageDataUri: "data:image/png;base64,fakeaidata==",
    });
    expect(svg).toContain('href="data:image/png;base64,fakeaidata=="');
  });

  it("falls back to a deterministic industry-themed gradient when no AI background is available — Visual must never fail to produce output", () => {
    const svg = renderSectionComposition({ ...baseInput, style: "VISUAL", backgroundImageDataUri: null });
    expect(svg).toContain("linearGradient");
    expect(svg).not.toContain("data:image/png;base64,fakeaidata");
  });

  it("still preserves exact recruitment text over a photo background (never baked into the image itself)", () => {
    const svg = renderSectionComposition({
      ...baseInput,
      style: "VISUAL",
      backgroundImageDataUri: "data:image/png;base64,fakeaidata==",
    });
    expect(svg).toContain("Pipe Fitters Needed \u2014 Gulf");
    expect(svg).toContain("Pipe Fitter (8)");
    expect(svg).toContain("+966-500000000");
    expect(svg).toContain("RA-1234-2024");
  });

  it("embeds the agency logo when provided", () => {
    const svg = renderSectionComposition({
      ...baseInput,
      style: "VISUAL",
      agencyLogoDataUri: "data:image/png;base64,logodata==",
    });
    expect(svg).toContain('href="data:image/png;base64,logodata=="');
  });

  it("applies the theme accent color to the badge border", () => {
    const svg = renderSectionComposition({ ...baseInput, style: "TYPOGRAPHY", accentColor: "#b91c1c" });
    expect(svg).toContain('stroke="#b91c1c"');
  });
});

describe("buildFallbackBackgroundSvgFragment", () => {
  it("returns a distinct palette for a known industry", () => {
    const oilGas = buildFallbackBackgroundSvgFragment({ widthPx: 100, heightPx: 100, industry: "Oil & Gas" });
    const healthcare = buildFallbackBackgroundSvgFragment({ widthPx: 100, heightPx: 100, industry: "Healthcare" });
    expect(oilGas).not.toBe(healthcare);
  });

  it("is case-insensitive when matching the industry", () => {
    const lower = buildFallbackBackgroundSvgFragment({ widthPx: 100, heightPx: 100, industry: "oil & gas" });
    const proper = buildFallbackBackgroundSvgFragment({ widthPx: 100, heightPx: 100, industry: "Oil & Gas" });
    expect(lower).toBe(proper);
  });

  it("falls back to a default palette for an unrecognized industry rather than erroring", () => {
    expect(() =>
      buildFallbackBackgroundSvgFragment({ widthPx: 100, heightPx: 100, industry: "Underwater Basket Weaving" }),
    ).not.toThrow();
  });
});

describe("getThemeAccentColor", () => {
  it("returns a distinct color per known theme", () => {
    expect(getThemeAccentColor("urgent_hiring")).not.toBe(getThemeAccentColor("premium"));
  });

  it("returns the default color for an unknown or missing theme", () => {
    expect(getThemeAccentColor(null)).toBeTruthy();
    expect(getThemeAccentColor("not_a_real_theme")).toBeTruthy();
  });
});
