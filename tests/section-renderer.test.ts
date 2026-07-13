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
  interview: [{ date: "1 Aug 2026", location: "Mumbai" }],
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
    const svg = renderSectionComposition({ ...baseInput, interview: [] });
    expect(svg).not.toContain("Interview:");
  });

  it("omits the benefits block entirely when there are no benefits", () => {
    const svg = renderSectionComposition({ ...baseInput, benefits: [] });
    expect(svg).not.toContain("Benefits");
  });

  it("never renders literal 'N/A' or 'Not Available' placeholders", () => {
    const svg = renderSectionComposition({ ...baseInput, employer: null, interview: [], benefits: [] });
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

  it("shrinks a long, realistic header instead of clipping it off-canvas (FIX-012 — found by rendering the real 'Hiring for Bilfinger Shutdown Project, Saudi Arabia' header, which clipped at the original fixed font size)", () => {
    const shortHeaderSvg = renderSectionComposition({ ...baseInput, header: "Welders Needed" });
    const longHeaderSvg = renderSectionComposition({
      ...baseInput,
      header: "Hiring for Bilfinger Shutdown Project, Saudi Arabia",
    });
    const fontSizeOf = (svg: string) => {
      const match = svg.match(/font-size="(\d+)" font-weight="700" fill="#111111">Hiring|font-size="(\d+)" font-weight="700" fill="#111111">Welders/);
      return match ? Number(match[1] ?? match[2]) : null;
    };
    const shortSize = fontSizeOf(shortHeaderSvg);
    const longSize = fontSizeOf(longHeaderSvg);
    expect(shortSize).not.toBeNull();
    expect(longSize).not.toBeNull();
    // The longer header must use a smaller (or equal) font size than the
    // short one — never the same fixed size regardless of string length.
    expect(longSize!).toBeLessThan(shortSize!);
    // Full text content must still be present (shrunk to fit, not truncated).
    expect(longHeaderSvg).toContain("Hiring for Bilfinger Shutdown Project, Saudi Arabia");
  });

  it("shrinks the RA badge text to fit a long official registration number instead of overflowing the badge (FIX-012 — found by rendering the real 'RC-B1487/MUM/PART/1000+/9986/2022' full RC format)", () => {
    const shortRcSvg = renderSectionComposition({ ...baseInput, raLicenseId: "9986" });
    const longRcSvg = renderSectionComposition({ ...baseInput, raLicenseId: "RC-B1487/MUM/PART/1000+/9986/2022" });
    const raFontSizeOf = (svg: string) => {
      const match = svg.match(/font-size="(\d+)" text-anchor="middle" fill="#333333">RA /);
      return match ? Number(match[1]) : null;
    };
    const shortSize = raFontSizeOf(shortRcSvg);
    const longSize = raFontSizeOf(longRcSvg);
    expect(shortSize).not.toBeNull();
    expect(longSize).not.toBeNull();
    expect(longSize!).toBeLessThan(shortSize!);
    // The full RC number (including its "+" character) must still be
    // present verbatim, never truncated or altered.
    expect(longRcSvg).toContain("RC-B1487/MUM/PART/1000+/9986/2022");
  });

  it("renders 'VERIFY AGENCY' in a color that stays legible against the Visual style's dark background (previously a fixed dark gray, invisible against a dark backdrop)", () => {
    const visualSvg = renderSectionComposition({ ...baseInput, style: "VISUAL" });
    const typographySvg = renderSectionComposition({ ...baseInput, style: "TYPOGRAPHY" });
    const verifyColorOf = (svg: string) => {
      const match = svg.match(/font-size="\d+" text-anchor="middle" fill="(#[0-9a-fA-F]{6})">VERIFY AGENCY/);
      return match ? match[1] : null;
    };
    expect(verifyColorOf(visualSvg)).toBe("#ffffff");
    expect(verifyColorOf(typographySvg)).toBe("#111111");
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

  it("renders a single interview event in the original one-line format (backward-compatible visual output)", () => {
    const svg = renderSectionComposition({ ...baseInput, interview: [{ date: "1 Aug 2026", location: "Mumbai" }] });
    expect(svg).toContain("Interview: Mumbai — 1 Aug 2026");
  });

  it("renders two distinct interview events on separate lines, never concatenated into one ambiguous string (Decision 3 — the real Baroda/Mumbai case)", () => {
    const svg = renderSectionComposition({
      ...baseInput,
      interview: [
        { date: "14th & 15th July", location: "Baroda" },
        { date: "18th July", location: "Mumbai" },
      ],
    });
    expect(svg).toContain(">Interview<"); // bold header, no trailing colon/date for the multi-event case
    expect(svg).toContain("Baroda — 14th &amp; 15th July");
    expect(svg).toContain("Mumbai — 18th July");
    // The two events must never be concatenated into a single string.
    expect(svg).not.toContain("Baroda — 14th &amp; 15th July, Mumbai — 18th July");
  });

  describe("landscape composition (Decision 4 — dedicated two-column layout)", () => {
    const landscapeFormat = getPlatformFormat("generic_landscape"); // 1600x900, 16:9
    const landscapeInput = {
      ...baseInput,
      platformFormat: landscapeFormat,
      interview: [
        { date: "14th & 15th July", location: "Baroda" },
        { date: "18th July", location: "Mumbai" },
      ],
    };

    it("uses a genuinely different two-column composition, not a re-scaled single-column template", () => {
      const landscapeSvg = renderSectionComposition(landscapeInput);
      const portraitSvg = renderSectionComposition({
        ...landscapeInput,
        platformFormat: getPlatformFormat("generic_portrait"),
      });
      // The column divider line is unique to the landscape composition.
      const dividerCount = (svg: string) => (svg.match(/<line x1="\d+" y1="\d+" x2="\d+" y2="\d+"/g) ?? []).length;
      expect(dividerCount(landscapeSvg)).toBeGreaterThan(0);
      expect(landscapeSvg).not.toBe(portraitSvg);
    });

    it("preserves every piece of required content — header, positions, benefits, both interview events, contact, badge", () => {
      const svg = renderSectionComposition(landscapeInput);
      expect(svg).toContain("Welders Needed — Gulf");
      expect(svg).toContain("6G Welder (10)");
      expect(svg).toContain("Pipe Fitter (5)");
      expect(svg).toContain("Free accommodation");
      expect(svg).toContain("Baroda — 14th &amp; 15th July");
      expect(svg).toContain("Mumbai — 18th July");
      expect(svg).toContain("+91-9000000000");
      expect(svg).toContain("MEA REGISTERED");
      expect(svg).toContain("VERIFY AGENCY");
      expect(svg).toContain(baseInput.qrDataUri);
    });

    it("matches the exact platform dimensions", () => {
      const svg = renderSectionComposition(landscapeInput);
      expect(svg).toContain(`width="${landscapeFormat.widthPx}"`);
      expect(svg).toContain(`height="${landscapeFormat.heightPx}"`);
    });

    it("does not clip the header even when a long, realistic header is combined with the two-column layout's narrower left column", () => {
      const svg = renderSectionComposition({
        ...landscapeInput,
        header: "Hiring for Bilfinger Shutdown Project, Saudi Arabia",
      });
      expect(svg).toContain("Hiring for Bilfinger Shutdown Project, Saudi Arabia");
    });

    it("still shrinks the RA badge text to fit the full official RC number in landscape too", () => {
      const svg = renderSectionComposition({
        ...landscapeInput,
        raLicenseId: "RC-B1487/MUM/PART/1000+/9986/2022",
      });
      expect(svg).toContain("RC-B1487/MUM/PART/1000+/9986/2022");
    });

    it("only applies the landscape composition to genuinely wide formats — square and portrait formats keep the single-column template", () => {
      const squareSvg = renderSectionComposition({ ...baseInput, platformFormat: getPlatformFormat("generic_square") });
      const portraitSvg = renderSectionComposition({ ...baseInput, platformFormat: getPlatformFormat("generic_portrait") });
      // Neither should contain the landscape column-divider line.
      const hasVerticalDivider = (svg: string, fmt: { widthPx: number; heightPx: number }) => {
        const dividerX = Math.round(fmt.widthPx * 0.4);
        return svg.includes(`x1="${dividerX}"`) && svg.includes(`x2="${dividerX}"`);
      };
      expect(hasVerticalDivider(squareSvg, getPlatformFormat("generic_square"))).toBe(false);
      expect(hasVerticalDivider(portraitSvg, getPlatformFormat("generic_portrait"))).toBe(false);
    });
  });
});
