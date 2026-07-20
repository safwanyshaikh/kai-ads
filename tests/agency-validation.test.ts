import { describe, expect, it } from "vitest";
import { registerAgencySchema, grantGenerationQuotaSchema } from "@/lib/validations/agency";

const validInput = {
  name: "Al Noor Overseas Recruitment",
  registrationNumber: "RA-1234-2024",
  website: "https://alnoor-recruitment.com",
  officialEmail: "admin@alnoor-recruitment.com",
  logoUrl: "https://storage.example.com/logo.png",
};

describe("registerAgencySchema", () => {
  it("accepts a fully valid registration payload", () => {
    const result = registerAgencySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing agency name", () => {
    const result = registerAgencySchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid website URL", () => {
    const result = registerAgencySchema.safeParse({
      ...validInput,
      website: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid official email", () => {
    const result = registerAgencySchema.safeParse({
      ...validInput,
      officialEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing logo", () => {
    const result = registerAgencySchema.safeParse({ ...validInput, logoUrl: "" });
    expect(result.success).toBe(false);
  });

  it("allows an optional secondary logo to be omitted", () => {
    const result = registerAgencySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});

describe("grantGenerationQuotaSchema", () => {
  it("accepts a positive whole-number grant", () => {
    const result = grantGenerationQuotaSchema.safeParse({ agencyId: "a1", amount: 100 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(100);
  });

  it("coerces a numeric string amount (form input)", () => {
    const result = grantGenerationQuotaSchema.safeParse({ agencyId: "a1", amount: "100" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(100);
  });

  it("rejects zero or negative amounts — this can only add generations, never revoke them", () => {
    expect(grantGenerationQuotaSchema.safeParse({ agencyId: "a1", amount: 0 }).success).toBe(false);
    expect(grantGenerationQuotaSchema.safeParse({ agencyId: "a1", amount: -5 }).success).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(grantGenerationQuotaSchema.safeParse({ agencyId: "a1", amount: 2.5 }).success).toBe(false);
  });

  it("rejects an absurdly large amount", () => {
    expect(grantGenerationQuotaSchema.safeParse({ agencyId: "a1", amount: 10_000_000 }).success).toBe(false);
  });

  it("requires an agencyId", () => {
    expect(grantGenerationQuotaSchema.safeParse({ amount: 10 }).success).toBe(false);
  });
});
