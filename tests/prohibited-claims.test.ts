import { describe, expect, it } from "vitest";
import { detectProhibitedClaims } from "@/server/generation/prohibited-claims.service";

describe("detectProhibitedClaims — Critical Legal Language", () => {
  it("flags every explicitly prohibited phrase from the brief", () => {
    const prohibited = [
      "Government Approved by KAI",
      "MEA Approved Advertisement",
      "Government Certified Advertisement",
      "Official MEA QR",
      "Official Government QR",
      "Meta Approved",
      "Facebook Approved",
      "WhatsApp Approved",
      "LinkedIn Approved",
      "Platform Safe",
      "Ban Proof",
      "Guaranteed Reach",
      "Guaranteed Social Media Approval",
    ];
    for (const phrase of prohibited) {
      const result = detectProhibitedClaims([phrase]);
      expect(result.clean).toBe(false);
    }
  });

  it("flags unauthorized government branding references", () => {
    expect(detectProhibitedClaims(["Ashoka Emblem displayed"]).clean).toBe(false);
    expect(detectProhibitedClaims(["Official MEA Seal included"]).clean).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(detectProhibitedClaims(["GOVERNMENT APPROVED"]).clean).toBe(false);
    expect(detectProhibitedClaims(["government approved"]).clean).toBe(false);
  });

  it("allows every explicitly permitted phrase from the brief", () => {
    const allowed = [
      "MEA REGISTERED AGENCY",
      "RA LICENSE ID: 12345",
      "VERIFY AGENCY",
      "Scan to verify agency details on the official Government of India source.",
      "Designed for recruitment transparency.",
      "Advertisement generated with structured agency identity and verification signals.",
    ];
    for (const phrase of allowed) {
      expect(detectProhibitedClaims([phrase]).clean).toBe(true);
    }
  });

  it("ignores null/undefined entries safely", () => {
    expect(detectProhibitedClaims([null, undefined, "MEA REGISTERED AGENCY"]).clean).toBe(true);
  });

  it("returns a specific violation message naming the offending phrase", () => {
    const result = detectProhibitedClaims(["This is Ban Proof advertising"]);
    expect(result.violations[0]).toContain("ban proof");
  });
});
