import { describe, expect, it } from "vitest";
import { runTrustCheck } from "@/server/generation/trust-validation.service";

const baseInput = {
  agencyName: "Al Noor Overseas Recruitment",
  raLicenseId: "RA-1234-2024",
  qrDecodable: true,
  contactPresent: true,
  advertisementTexts: ["Welders Needed — Gulf", "MEA REGISTERED AGENCY"],
};

describe("runTrustCheck", () => {
  it("everything present and clean -> TRUST_READY", () => {
    const result = runTrustCheck(baseInput);
    expect(result.status).toBe("TRUST_READY");
    expect(result.warnings).toHaveLength(0);
  });

  it("undecodable QR -> BLOCKED, per 'If KAI cannot decode its own generated QR: BLOCK READY STATUS'", () => {
    const result = runTrustCheck({ ...baseInput, qrDecodable: false });
    expect(result.status).toBe("BLOCKED");
  });

  it("a prohibited claim in the advertisement text -> BLOCKED", () => {
    const result = runTrustCheck({
      ...baseInput,
      advertisementTexts: [...baseInput.advertisementTexts, "Government Approved Advertisement"],
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("missing agency name -> REVIEW_RECOMMENDED, not BLOCKED (missing identity is a warning, not a deception risk)", () => {
    const result = runTrustCheck({ ...baseInput, agencyName: null });
    expect(result.status).toBe("REVIEW_RECOMMENDED");
  });

  it("missing RA license -> REVIEW_RECOMMENDED", () => {
    const result = runTrustCheck({ ...baseInput, raLicenseId: null });
    expect(result.status).toBe("REVIEW_RECOMMENDED");
  });

  it("missing contact info -> REVIEW_RECOMMENDED", () => {
    const result = runTrustCheck({ ...baseInput, contactPresent: false });
    expect(result.status).toBe("REVIEW_RECOMMENDED");
  });

  it("BLOCKED takes priority over other missing data (a prohibited claim + missing contact is still BLOCKED)", () => {
    const result = runTrustCheck({
      ...baseInput,
      contactPresent: false,
      advertisementTexts: ["Ban Proof advertising guaranteed"],
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("never called Facebook/WhatsApp/Meta/LinkedIn Approved even in a warning message", () => {
    const result = runTrustCheck({ ...baseInput, agencyName: null, raLicenseId: null, contactPresent: false });
    const allText = result.warnings.join(" ").toLowerCase();
    expect(allText).not.toMatch(/facebook approved|whatsapp approved|meta approved|linkedin approved/);
  });
});
