import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { FOOTER_STYLES, FOOTER_THEMES, normaliseBadges, MAX_BRAND_BADGES, footerTheme } from "@/server/generation/pipeline/footer-styles";
import { selectFooterStyle } from "@/server/generation/pipeline/footer-selection";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

const KDL_PALETTE = ["#0B1F33", "#F3EEE3", "#F3D98B", "#4A5A6C", "#C9C0AB", "#FFFFFF"];

async function art(r: number, g: number, b: number, w = 1024, h = 1024) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

describe("Footer Library", () => {
  it("offers exactly five agency-owned styles", () => {
    expect(FOOTER_STYLES).toHaveLength(5);
  });

  it("never introduces a colour outside KDL's locked palette", () => {
    for (const style of FOOTER_STYLES) {
      const t = FOOTER_THEMES[style];
      for (const [key, value] of Object.entries(t)) {
        if (typeof value !== "string" || !value.startsWith("#")) continue;
        expect(KDL_PALETTE, `${style}.${key} = ${value}`).toContain(value);
      }
    }
  });

  it("keeps the contrast law: gold never on cream or white", () => {
    for (const style of FOOTER_STYLES) {
      const t = FOOTER_THEMES[style];
      const light = ["#F3EEE3", "#FFFFFF"];
      if (t.text === "#F3D98B") expect(light).not.toContain(t.background);
      if (t.contactRowText === "#F3D98B") expect(light).not.toContain(t.contactRowBackground);
      if (t.badgeText === "#F3D98B") expect(light).not.toContain(t.badgeBackground);
    }
  });

  it("falls back to a valid theme when no style is set", () => {
    expect(footerTheme(null).label).toBeTruthy();
  });

  it("renders every style at the exact canvas size", async () => {
    for (const style of FOOTER_STYLES) {
      const png = await applyBrandingOverlay({
        imagePng: await art(30, 40, 60), widthPx: 1024, heightPx: 1024,
        agencyName: "Gulf Manpower Consultants", registrationNumber: "B-0655/MUM", footerStyle: style,
      });
      const meta = await sharp(png).metadata();
      expect(meta.width, style).toBe(1024);
      expect(meta.height, style).toBe(1024);
    }
  });
});

describe("Brand badges", () => {
  it("caps at three", () => {
    expect(normaliseBadges(["a", "b", "c", "d", "e"])).toHaveLength(MAX_BRAND_BADGES);
  });

  it("ignores non-strings and blanks rather than rendering empty pills", () => {
    expect(normaliseBadges(["Since 1984", "", "  ", 42, null])).toEqual(["Since 1984"]);
  });

  it("tolerates a malformed value from the Json column", () => {
    expect(normaliseBadges(null)).toEqual([]);
    expect(normaliseBadges("not an array")).toEqual([]);
  });

  it("changes the rendered band when badges are present", async () => {
    const base = { imagePng: await art(30, 40, 60), widthPx: 1024, heightPx: 1024, agencyName: "Gulf Manpower", registrationNumber: "B-0655" };
    const without = await applyBrandingOverlay(base);
    const withBadges = await applyBrandingOverlay({ ...base, brandBadges: ["Since 1984"] });
    expect(withBadges.equals(without)).toBe(false);
  });
});

describe("Automatic footer selection", () => {
  it("respects a saved agency preference above everything else", async () => {
    const s = await selectFooterStyle(await art(255, 255, 255), "INDUSTRIAL_PREMIUM");
    expect(s.style).toBe("INDUSTRIAL_PREMIUM");
    expect(s.fromAgencyPreference).toBe(true);
  });

  it("chooses a dark footer under dark artwork", async () => {
    const s = await selectFooterStyle(await art(12, 16, 24));
    expect(s.style).toBe("INDUSTRIAL_PREMIUM");
  });

  it("chooses the quietest footer under strongly coloured artwork", async () => {
    const s = await selectFooterStyle(await art(220, 40, 20));
    expect(s.style).toBe("MODERN_MINIMAL");
  });

  it("chooses a ruled print-style footer under very light artwork", async () => {
    const s = await selectFooterStyle(await art(250, 250, 250));
    expect(s.style).toBe("TRADITIONAL_DTP");
  });

  it("always explains its choice", async () => {
    const s = await selectFooterStyle(await art(120, 120, 120));
    expect(s.reason.length).toBeGreaterThan(10);
  });

  it("never alters the advertisement it analyses", async () => {
    const original = await art(90, 110, 130);
    const copy = Buffer.from(original);
    await selectFooterStyle(original);
    expect(original.equals(copy)).toBe(true);
  });
});
