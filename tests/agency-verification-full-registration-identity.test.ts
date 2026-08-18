import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { verifyAgencySchema } from "@/lib/validations/agency-verification";

/**
 * Full verified registration identity (see VerifiedAgencyProfile in
 * src/server/generation/pipeline/types.ts) is admin-controlled, set
 * through the SAME Super Admin verification action as
 * officialVerificationUrl — never self-service (see
 * src/app/api/agencies/profile/route.ts's own comment: "Name, MEA
 * licence, verification status and QR destination are not accepted
 * here at all — they are admin-controlled").
 */
describe("verifyAgencySchema — full registration identity", () => {
  it("accepts the optional identity fields alongside officialVerificationUrl", () => {
    const parsed = verifyAgencySchema.parse({
      officialVerificationUrl: "https://verify.example.com/kai/abc123",
      fullRegistrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
      meaRegistrationText: "MEA Registered",
      isoCertification: "ISO 9001:2015",
    });
    expect(parsed.fullRegistrationNumber).toBe("B-1487/MUM/PART/1000+/9986/2022");
    expect(parsed.meaRegistrationText).toBe("MEA Registered");
    expect(parsed.isoCertification).toBe("ISO 9001:2015");
  });

  it("still works with none of the identity fields supplied — re-verifying doesn't force re-entry", () => {
    const parsed = verifyAgencySchema.parse({
      officialVerificationUrl: "https://verify.example.com/kai/abc123",
    });
    expect(parsed.fullRegistrationNumber).toBeUndefined();
  });
});

describe("agencyVerificationService.verify — wires identity fields to the Agency record", () => {
  const service = readFileSync("src/server/services/agency-verification.service.ts", "utf8");

  it("only writes the fields that were actually supplied — never fabricates the others", () => {
    expect(service).toContain("agencyRepository.updateRegistrationIdentity");
    expect(service).toMatch(/if\s*\(input\.fullRegistrationNumber\)/);
  });

  it("never touches registrationNumber itself — only the new full-identity fields", () => {
    const start = service.indexOf("const identityUpdate");
    const end = service.indexOf("agencyRepository.updateRegistrationIdentity(agencyId, identityUpdate)");
    const block = service.slice(start, end);
    expect(block).not.toMatch(/identityUpdate\.registrationNumber/);
  });
});
