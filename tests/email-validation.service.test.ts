import { describe, expect, it } from "vitest";
import {
  assertBusinessEmail,
  extractDomain,
  isPersonalEmailDomain,
} from "@/server/services/email-validation.service";

describe("email-validation.service", () => {
  it("extracts the domain from an email address", () => {
    expect(extractDomain("Admin@YourAgency.com")).toBe("youragency.com");
  });

  it("throws on a malformed email address", () => {
    expect(() => extractDomain("not-an-email")).toThrow();
  });

  it("flags common personal email domains", () => {
    expect(isPersonalEmailDomain("someone@gmail.com")).toBe(true);
    expect(isPersonalEmailDomain("someone@yahoo.com")).toBe(true);
  });

  it("allows business domains", () => {
    expect(isPersonalEmailDomain("admin@youragency.com")).toBe(false);
  });

  it("assertBusinessEmail throws for personal domains", () => {
    expect(() => assertBusinessEmail("someone@gmail.com")).toThrow(
      /personal email/i,
    );
  });

  it("assertBusinessEmail passes for business domains", () => {
    expect(() => assertBusinessEmail("admin@youragency.com")).not.toThrow();
  });
});
