import { describe, expect, it } from "vitest";
import { renderSectionComposition } from "@/server/generation/section-renderer";
import { getPlatformFormat } from "@/lib/platform-formats";

const baseInput = {
  platformFormat: getPlatformFormat("generic_square"),
  header: "Welders Needed — Gulf",
  industry: "Construction",
  country: "UAE",
  employer: null,
  positions: [
    { title: "6G Welder", count: 10, experience: "5 years" },
    { title: "Pipe Fitter", count: 5 },
  ],
  benefits: [{ label: "Free accommodation" }],
  interview: { date: "1 Aug 2026", location: "Mumbai" },
  contact: { name: "Agency Desk", phone: "+91-9000000000" },
  footer: "Reg. No. RA-1234",
  agencyName: "Al Noor Overseas Recruitment",
  raLicenseId: "RA-1234-2024",
  qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
  badge: { shape: "rounded_square" as const, size: "standard" as const },
  style: "TYPOGRAPHY" as const,
};

describe("renderSectionComposition — deterministic text, no AI dependency", () => {
  it("produces well-formed, parseable SVG", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg.trim().startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("preserves the exact header text — never paraphrased or altered", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain("Welders Needed \u2014 Gulf");
  });

  it("preserves every position's exact title and count", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain("6G Welder (10)");
    expect(svg).toContain("Pipe Fitter (5)");
  });

  it("preserves the exact contact phone number", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain("+91-9000000000");
  });

  it("preserves the exact RA license ID", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain("RA-1234-2024");
  });

  it("embeds the QR image via the provided data URI", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain(baseInput.qrDataUri);
  });

  it("includes the unified badge text — MEA REGISTERED and VERIFY AGENCY", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain("MEA REGISTERED");
    expect(svg).toContain("VERIFY AGENCY");
  });

  it("escapes XML special characters in user-supplied text (prevents malformed SVG / injection)", () => {
    const svg = renderSectionComposition({
      ...baseInput,
      header: 'Urgent <hire> & "apply now"',
    });
    expect(svg).not.toContain("<hire>");
    expect(svg).toContain("&lt;hire&gt;");
    expect(svg).toContain("&amp;");
  });

  it("omits the interview block entirely when no interview data is present (optional data disappears cleanly)", () => {
    const svg = renderSectionComposition({ ...baseInput, interview: {} });
    expect(svg).not.toContain("Interview:");
  });

  it("omits the benefits block entirely when there are no benefits", () => {
    const svg = renderSectionComposition({ ...baseInput, benefits: [] });
    expect(svg).not.toContain("Benefits");
  });

  it("never renders literal 'N/A' or 'Not Available' placeholders", () => {
    const svg = renderSectionComposition({ ...baseInput, employer: null, interview: {}, benefits: [] });
    // Excludes the embedded-font <style> block: its base64 font data is
    // effectively random bytes and can coincidentally contain "n/a" as a
    // substring — this check is about recruiter-facing content, not font data.
    const content = svg.replace(/<style>[\s\S]*?<\/style>/, "");
    expect(content.toLowerCase()).not.toContain("n/a");
    expect(content.toLowerCase()).not.toContain("not available");
  });

  it("renders differently for NEWSPAPER vs TYPOGRAPHY (a real, distinguishable layout difference)", () => {
    const typography = renderSectionComposition({ ...baseInput, style: "TYPOGRAPHY" });
    const newspaper = renderSectionComposition({ ...baseInput, style: "NEWSPAPER" });
    expect(typography).not.toBe(newspaper);
    expect(newspaper).toContain("<line"); // the DTP column rule
  });

  it("matches the exact platform dimensions from the centralized registry", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain(`width="${baseInput.platformFormat.widthPx}"`);
    expect(svg).toContain(`height="${baseInput.platformFormat.heightPx}"`);
  });

  it("embeds fonts as self-contained @font-face data instead of referencing system font names (FIX-009 — sharp's SVG rasterizer has no fonts installed on Vercel's serverless runtime)", () => {
    const svg = renderSectionComposition(baseInput);
    expect(svg).toContain("@font-face");
    expect(svg).toContain("base64");
    expect(svg).not.toContain("Arial");
    expect(svg).not.toContain("Helvetica");
    expect(svg).not.toContain("Georgia");
    expect(svg).not.toContain("Times New Roman");
  });

  it("scales the logo, badge, and text block proportionally with canvas height instead of using fixed pixel values (FIX-010 — a tall format like WhatsApp Status/Instagram Story otherwise clusters all content near the top and strands the QR badge far below it)", () => {
    const shortFormat = getPlatformFormat("generic_square"); // 1080x1080
    const tallFormat = getPlatformFormat("whatsapp_status"); // 1080x1920 — the tallest supported format

    const shortSvg = renderSectionComposition({ ...baseInput, platformFormat: shortFormat });
    const tallSvg = renderSectionComposition({ ...baseInput, platformFormat: tallFormat });

    const logoWidthOf = (svg: string) => {
      const match = svg.match(/<image x="\d+" y="-?\d+" width="(\d+)" height="\d+" href="data:image\/png/);
      return match ? Number(match[1]) : null;
    };
    const shortLogoWidth = logoWidthOf(shortSvg);
    const tallLogoWidth = logoWidthOf(tallSvg);
    expect(shortLogoWidth).not.toBeNull();
    expect(tallLogoWidth).not.toBeNull();
    // Taller canvas -> proportionally larger logo, never the same fixed 64px on both.
    expect(tallLogoWidth! / tallFormat.heightPx).toBeCloseTo(shortLogoWidth! / shortFormat.heightPx, 3);
    expect(tallLogoWidth).toBeGreaterThan(shortLogoWidth!);

    // The badge's own size scales the same way — never the same fixed
    // pixel size regardless of canvas height.
    const badgeSizeOf = (svg: string) => {
      const match = svg.match(/<rect x="\d+" y="-?\d+" width="(\d+)" height="\d+" rx="\d+" fill="#ffffff"/);
      return match ? Number(match[1]) : null;
    };
    const shortBadgeSize = badgeSizeOf(shortSvg);
    const tallBadgeSize = badgeSizeOf(tallSvg);
    expect(shortBadgeSize).not.toBeNull();
    expect(tallBadgeSize).not.toBeNull();
    expect(tallBadgeSize! / tallFormat.heightPx).toBeCloseTo(shortBadgeSize! / shortFormat.heightPx, 3);
  });
});
