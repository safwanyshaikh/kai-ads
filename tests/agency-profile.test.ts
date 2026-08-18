import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { updateAgencyProfileSchema } from "@/lib/validations/agency";

/**
 * The Agency Profile is the single source of truth for branding. A
 * recruiter fills it in once; every advertisement pulls from it.
 */
describe("Agency Profile — agency-editable fields", () => {
  it("accepts the fields an agency owns", () => {
    const parsed = updateAgencyProfileSchema.parse({
      contactPerson: "Rahim Khan",
      phone: "+91 22 6666 5353",
      whatsapp: "+91 98765 43210",
      officialEmail: "jobs@agency.example",
      website: "www.agency.example",
      officeAddress: "Andheri East, Mumbai",
    });
    expect(parsed.phone).toBe("+91 22 6666 5353");
    expect(parsed.officeAddress).toBe("Andheri East, Mumbai");
  });

  it("never accepts admin-controlled identity or verification fields", () => {
    // An agency that could edit its own licence number or QR destination
    // could publish a false one under a verified badge.
    const parsed = updateAgencyProfileSchema.parse({
      phone: "+91 1",
      name: "Someone Else Ltd",
      registrationNumber: "FAKE-LICENCE",
      officialVerificationUrl: "https://attacker.example",
      status: "APPROVED",
      totalQuota: 9999,
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("name");
    expect(parsed).not.toHaveProperty("registrationNumber");
    expect(parsed).not.toHaveProperty("officialVerificationUrl");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("totalQuota");
  });

  it("rejects an invalid email rather than shipping it onto artwork", () => {
    expect(() => updateAgencyProfileSchema.parse({ officialEmail: "not-an-email" })).toThrow();
  });
});

describe("Branding Engine reads the Agency Profile", () => {
  const service = readFileSync("src/server/services/advertisement-generation.service.ts", "utf8");

  it("falls back to the agency profile for the contact line", () => {
    expect(service).toMatch(/agency\.phone/);
    expect(service).toMatch(/agency\.officialEmail/);
  });

  it("lets a per-campaign contact override the profile", () => {
    // Advertisement value first, profile second — an override, not the
    // default. Whitespace is tolerant of the codebase's own formatting
    // (each `??` operand on its own line), not just a single-line style.
    expect(service).toMatch(/contact\.phone\s*\?\?\s*agency\.phone/);
    expect(service).toMatch(/contact\.email\s*\?\?\s*agency\.officialEmail/);
  });

  it("prints office address from the profile", () => {
    expect(service).toContain("buildAddressLine");
    expect(service).toMatch(/agency\.officeAddress/);
  });

  it("never falls back the Registered Address line to the website — a real bug found via a live render", () => {
    // A real generated advertisement showed "Registered Address:
    // https://www.example.com" — buildAddressLine used to join
    // officeAddress and website together (or fall back to website alone
    // when officeAddress was empty), mislabelling the website URL as a
    // physical address. The footer already has its own separate
    // "Website:" line — Registered Address must only ever come from
    // officeAddress, or be omitted.
    const buildAddressLineSource = service.slice(
      service.indexOf("function buildAddressLine"),
      service.indexOf("function buildAddressLine") + 500,
    );
    expect(buildAddressLineSource).not.toMatch(/agency\.website/);
  });

  it("counts profile contact details when checking the ad has a contact", () => {
    // Otherwise an agency with a complete profile is flagged for a missing
    // contact on an advertisement that does display one.
    expect(service).toMatch(/contactPresent:[\s\S]{0,220}agency\.phone/);
  });
});

describe("Agency Profile API scoping", () => {
  const route = readFileSync("src/app/api/agencies/profile/route.ts", "utf8");

  it("always scopes the update to the caller's own agency", () => {
    expect(route).toContain("user.agencyId");
    // Never an agency id taken from the request body.
    expect(route).not.toMatch(/body\.agencyId|input\.agencyId/);
  });

  it("requires the manage-own permission", () => {
    expect(route).toContain('assertPermission(user, "agency:manage_own")');
  });
});
