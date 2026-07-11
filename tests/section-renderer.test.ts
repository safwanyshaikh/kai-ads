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
    expect(svg.toLowerCase()).not.toContain("n/a");
    expect(svg.toLowerCase()).not.toContain("not available");
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
});
