import { describe, expect, it } from "vitest";
import {
  agencyAddressLine,
  agencyContactLine,
  applyAgencyBrand,
  buildAgencyDna,
  shade,
  type AgencyProfileRecord,
} from "@/server/generation/dna/agency-dna";
import { getDna } from "@/server/generation/dna/registry";
import { contrastRatio, FACT_CONTRAST_MIN } from "@/server/generation/dna/contrast";

function profile(over: Partial<AgencyProfileRecord> = {}): AgencyProfileRecord {
  return {
    id: "agency-1",
    name: "Al Yousuf Enterprises LLP",
    registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    logoUrl: "https://example.test/logo.png",
    officialEmail: "jobs@alyousuf.test",
    phone: "+91 86559 60415",
    whatsapp: "+91 86559 60415",
    website: "https://alyousuf.test",
    officeAddress: "Andheri East, Mumbai",
    brandBadges: ["Since 1984", "ISO Certified"],
    footerStyle: "INDUSTRIAL_PREMIUM",
    ...over,
  };
}

describe("Agency DNA — resolved from the verified profile, never invented", () => {
  it("carries every profile field through verbatim", () => {
    const dna = buildAgencyDna(profile());
    expect(dna.name).toBe("Al Yousuf Enterprises LLP");
    expect(dna.registrationNumber).toBe("B-0655/MUM/PER/1000+/4-1/4/7914/2007");
    expect(dna.compactRegistrationId).toBeTruthy();
    expect(dna.badges).toEqual(["Since 1984", "ISO Certified"]);
    expect(dna.footerStyle).toBe("INDUSTRIAL_PREMIUM");
    expect(dna.contact.officeAddress).toBe("Andheri East, Mumbai");
  });

  it("reports an unfilled profile as absent rather than substituting a plausible value", () => {
    const dna = buildAgencyDna(
      profile({ phone: null, whatsapp: null, website: null, officeAddress: null, brandBadges: null }),
    );
    expect(dna.contact.phone).toBeNull();
    expect(dna.contact.website).toBeNull();
    expect(dna.contact.officeAddress).toBeNull();
    expect(dna.badges).toEqual([]);
    expect(agencyAddressLine(dna)).toBeNull();
  });

  it("caps permanent branding claims at three", () => {
    const dna = buildAgencyDna(profile({ brandBadges: ["a", "b", "c", "d", "e"] }));
    expect(dna.badges).toHaveLength(3);
  });

  it("drops a malformed brand colour instead of guessing at it", () => {
    const dna = buildAgencyDna(profile({ brandColours: { primary: "navy blue", secondary: "#ZZZZZZ" } }));
    expect(dna.brand.primary).toBeNull();
    expect(dna.brand.secondary).toBeNull();
  });
});

describe("Agency branding never costs legibility", () => {
  const dna = getDna("PS-01");

  it("applies a brand primary that can carry factual text", () => {
    const agency = buildAgencyDna(profile({ brandColours: { primary: "#1A2B4C" } }));
    const { palette, notes } = applyAgencyBrand(dna, agency);
    expect(palette.ink).toBe("#1A2B4C");
    expect(contrastRatio(palette.ink, palette.surface)).toBeGreaterThanOrEqual(FACT_CONTRAST_MIN);
    expect(contrastRatio(palette.reversed, palette.ink)).toBeGreaterThanOrEqual(FACT_CONTRAST_MIN);
    expect(notes.join(" ")).toMatch(/applied/i);
  });

  it("declines a brand primary that cannot, and says why", () => {
    // Pale yellow as heading ink would put factual text at roughly 1.1:1
    // against a light body surface — unreadable on a phone in daylight.
    const agency = buildAgencyDna(profile({ brandColours: { primary: "#FFF6B0" } }));
    const { palette, notes } = applyAgencyBrand(dna, agency);
    expect(palette.ink).toBe(dna.palette.ink);
    expect(notes.join(" ")).toMatch(/was not applied/i);
    expect(notes.join(" ")).toMatch(/4\.5:1/);
  });

  it("keeps text on the accent readable when a brand secondary is applied", () => {
    const agency = buildAgencyDna(profile({ brandColours: { secondary: "#C62828" } }));
    const { palette } = applyAgencyBrand(dna, agency);
    expect(contrastRatio(palette.accentText, palette.accent)).toBeGreaterThanOrEqual(FACT_CONTRAST_MIN);
  });

  it("leaves the design untouched when the agency has no brand colours", () => {
    const { palette, notes } = applyAgencyBrand(dna, buildAgencyDna(profile()));
    expect(palette).toEqual(dna.palette);
    expect(notes).toEqual([]);
  });
});

describe("Trust-strip lines", () => {
  it("lets a per-campaign contact override the profile default", () => {
    const agency = buildAgencyDna(profile());
    expect(agencyContactLine(agency, { phone: "+971 50 000 0000" })).toContain("+971 50 000 0000");
    expect(agencyContactLine(agency, null)).toContain("+91 86559 60415");
  });

  it("omits what is absent rather than printing a blank", () => {
    const agency = buildAgencyDna(profile({ phone: null, whatsapp: null, officialEmail: null }));
    expect(agencyContactLine(agency, null)).toBeNull();
  });

  it("shades a colour deterministically in both directions", () => {
    expect(shade("#808080", 0)).toBe("#808080");
    expect(shade("#000000", 1)).toBe("#FFFFFF");
    expect(shade("#FFFFFF", -1)).toBe("#000000");
  });
});
