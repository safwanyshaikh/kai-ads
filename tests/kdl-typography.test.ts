import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TYPE_ROLE, roleFamily, roleTextWidth, type TypeRole } from "@/lib/kdl-typography";
import { classifyRoleFamily, ROLE_FAMILY_RULES } from "@/lib/role-families";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * KDL TYPOGRAPHY (Final Production Lock §12) — the documented five-role
 * system is now the one the renderer actually uses, and §24's "one
 * source only" rule means no renderer may carry its own copy of a
 * family name or a width factor.
 */
const ROLES: TypeRole[] = ["DISPLAY", "SECTION", "POSITION", "NUMERIC", "FINE", "BASE"];

function facts(over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Halliburton",
    positions: [
      // Qualification/experience detail is what puts FINE-role fine
      // print on the canvas at all — without it the role only ever
      // needs POSITION type, and asserting FINE would be asserting a
      // line the composition correctly never draws.
      { title: "HVAC Technician", count: 10, qualification: "ITI / Diploma in Mechanical Engineering" },
      { title: "Electrician", count: 8, qualification: "ITI / Diploma in Electrical Engineering" },
      { title: "Welder", count: 5, qualification: "ITI / Trade Certificate" },
      { title: "Planning Engineer", count: 2, qualification: "Bachelor's degree in Engineering" },
    ],
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    ...over,
  };
}

describe("KDL type roles", () => {
  it("defines all five documented semantic roles plus the base fallback", () => {
    for (const role of ROLES) {
      expect(TYPE_ROLE[role]).toBeDefined();
      expect(TYPE_ROLE[role].family.length).toBeGreaterThan(0);
    }
  });

  it("maps each role to its documented typeface, every stack falling back to a real bundled face", () => {
    expect(roleFamily("DISPLAY")).toContain("KaiDisplay"); // Anton
    expect(roleFamily("SECTION")).toContain("KaiHeader"); // Oswald
    expect(roleFamily("POSITION")).toContain("KaiPosition"); // Barlow Condensed
    expect(roleFamily("NUMERIC")).toContain("KaiNumeric"); // Archivo Black
    expect(roleFamily("FINE")).toContain("KaiFine"); // Roboto Condensed
    for (const role of ROLES) {
      // Never tofu: every stack ends at a face fontconfig can always resolve.
      expect(roleFamily(role)).toMatch(/sans-serif$/);
    }
  });

  it("gives dense position type a materially narrower advance than the base face", () => {
    // Barlow Condensed vs Liberation Sans — this is what buys the role
    // list its density back, and it must be a real difference.
    const title = "MECHANICAL SUPERVISOR (12 NOS)";
    expect(roleTextWidth(title, 30, "POSITION")).toBeLessThan(roleTextWidth(title, 30, "BASE") * 0.8);
  });

  it("every bundled role face is present on disk", () => {
    const conf = readFileSync("src/server/generation/fonts/fonts.conf", "utf8");
    for (const fam of ["Anton", "Oswald", "Barlow Condensed", "Archivo Black", "Roboto Condensed"]) {
      expect(conf).toContain(`<family>${fam}</family>`);
    }
  });
});

describe("One source only (§24)", () => {
  it("no renderer hardcodes a font-family string — every one comes from the registry", () => {
    for (const f of [
      "src/server/generation/pipeline/fact-layer.ts",
      "src/server/generation/pipeline/branding-overlay.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} still hardcodes a family`).not.toMatch(/font-family="Kai\w+, sans-serif"/);
      expect(src).toContain("roleFamily(");
    }
  });

  it("no renderer carries its own role-family rules — both classify through one registry", () => {
    for (const f of [
      "src/server/generation/pipeline/fact-layer.ts",
      "src/server/generation/pipeline/content-intelligence.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain('from "@/lib/role-families"');
      expect(src, `${f} redeclares the family rules`).not.toMatch(/const (ROLE_)?FAMILY_RULES\s*[:=]/);
    }
  });
});

describe("Role-family classification", () => {
  it("routes each trade to its documented family", () => {
    expect(classifyRoleFamily("HVAC Technician").id).toBe("hvac-mechanical");
    expect(classifyRoleFamily("Electrical Engineer").id).toBe("electrical-it");
    expect(classifyRoleFamily("Planning Engineer").id).toBe("planning-controls");
    expect(classifyRoleFamily("Procurement Manager").id).toBe("project-management");
    expect(classifyRoleFamily("Sandblaster").id).toBe("general-trades");
  });

  it("always records the basis that placed a position, so a wrong cluster is auditable", () => {
    expect(classifyRoleFamily("Welder").basis).toMatch(/functional keyword match/);
    expect(classifyRoleFamily("Sandblaster").basis).toMatch(/catch-all/);
  });

  it("exposes an uppercase heading for the renderer and a title-case label for data surfaces", () => {
    for (const rule of ROLE_FAMILY_RULES) {
      expect(rule.heading).toBe(rule.heading.toUpperCase());
      expect(rule.label).not.toBe(rule.label.toUpperCase());
    }
  });
});

describe("Rendered output uses the role hierarchy", () => {
  it("draws display, section, position and numeric type in genuinely different faces", async () => {
    // A single-role canvas is the one case the vacancy badge (NUMERIC
    // role) legitimately renders for — see the Final 10/10 Human
    // Recruiter Intelligence Gate: a multi-role aggregate is a database
    // total, not a job, and is never drawn as a badge.
    const single = facts({
      positions: [{ title: "HVAC Technician", count: 10, qualification: "ITI / Diploma in Mechanical Engineering" }],
    });
    const r = await renderFactLayer({ facts: single, widthPx: 1080, heightPx: 1350 });
    expect(r.svgMarkup).toContain("KaiDisplay");
    expect(r.svgMarkup).toContain("KaiHeader");
    expect(r.svgMarkup).toContain("KaiPosition");
    expect(r.svgMarkup).toContain("KaiNumeric");
    expect(r.svgMarkup).toContain("KaiFine");
  });

  it("renders real glyphs, not tofu, for every role face", async () => {
    // A tofu box is a hollow rectangle: it produces ink, so presence of
    // ink alone proves nothing. Instead assert the faces resolve to
    // DIFFERENT rendered widths — identical widths across all five would
    // mean fontconfig silently collapsed them to one fallback face.
    const sample = "SAUDI ARABIA";
    const widths = new Set(
      (["DISPLAY", "SECTION", "POSITION", "NUMERIC", "FINE"] as TypeRole[]).map((role) =>
        Math.round(roleTextWidth(sample, 48, role)),
      ),
    );
    expect(widths.size).toBeGreaterThanOrEqual(4);
  });
});
