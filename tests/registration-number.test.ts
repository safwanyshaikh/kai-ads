import { describe, expect, it } from "vitest";
import { deriveCompactRegistrationNumber } from "@/lib/registration-number";
import { registerAgencySchema } from "@/lib/validations/agency";

describe("deriveCompactRegistrationNumber — Decision 1 (full official RC number support)", () => {
  it("derives the core RC number from the real full official format", () => {
    expect(deriveCompactRegistrationNumber("RC-B1487/MUM/PART/1000+/9986/2022")).toBe("9986");
  });

  it("passes an already-compact value through unchanged (backward compatibility)", () => {
    expect(deriveCompactRegistrationNumber("9986")).toBe("9986");
  });

  it("passes through any value with no '/' separators unchanged", () => {
    expect(deriveCompactRegistrationNumber("RA-1234-2024")).toBe("RA-1234-2024");
  });
});

describe("registerAgencySchema.registrationNumber — accepts the full official RC format", () => {
  it("accepts the real full official RC number, including its '+' character", () => {
    const result = registerAgencySchema.shape.registrationNumber.safeParse("RC-B1487/MUM/PART/1000+/9986/2022");
    expect(result.success).toBe(true);
  });

  it("still accepts the existing compact format (backward compatibility)", () => {
    const result = registerAgencySchema.shape.registrationNumber.safeParse("9986");
    expect(result.success).toBe(true);
  });

  it("still rejects genuinely invalid characters (e.g. spaces, symbols outside the allow-list)", () => {
    const result = registerAgencySchema.shape.registrationNumber.safeParse("RC 9986 <script>");
    expect(result.success).toBe(false);
  });
});
