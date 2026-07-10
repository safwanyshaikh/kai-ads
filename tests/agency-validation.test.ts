import { describe, expect, it } from "vitest";
import { registerAgencySchema } from "@/lib/validations/agency";

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
