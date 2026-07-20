import { describe, expect, it } from "vitest";
import { can, roleHasPermission, assertPermission, ForbiddenError } from "@/lib/rbac";

describe("rbac", () => {
  it("KAI_SUPER_ADMIN can approve agencies", () => {
    expect(roleHasPermission("KAI_SUPER_ADMIN", "agency:approve")).toBe(true);
  });

  it("AGENCY_ADMIN cannot approve agencies", () => {
    expect(roleHasPermission("AGENCY_ADMIN", "agency:approve")).toBe(false);
  });

  it("AGENCY_ADMIN can review join requests", () => {
    expect(roleHasPermission("AGENCY_ADMIN", "join_request:review")).toBe(true);
  });

  it("AGENCY_USER cannot review join requests", () => {
    expect(roleHasPermission("AGENCY_USER", "join_request:review")).toBe(false);
  });

  it("can() denies PENDING users regardless of role", () => {
    expect(
      can(
        { role: "KAI_SUPER_ADMIN", status: "PENDING", agencyId: null },
        "agency:approve",
      ),
    ).toBe(false);
  });

  it("can() denies SUSPENDED users", () => {
    expect(
      can(
        { role: "AGENCY_ADMIN", status: "SUSPENDED", agencyId: "a1" },
        "join_request:review",
      ),
    ).toBe(false);
  });

  it("assertPermission throws ForbiddenError when denied", () => {
    expect(() =>
      assertPermission(
        { role: "AGENCY_USER", status: "ACTIVE", agencyId: "a1" },
        "agency:approve",
      ),
    ).toThrow(ForbiddenError);
  });

  it("KAI_SUPER_ADMIN can manage generation quota", () => {
    expect(roleHasPermission("KAI_SUPER_ADMIN", "agency:manage_quota")).toBe(true);
  });

  it("AGENCY_ADMIN cannot manage generation quota", () => {
    expect(roleHasPermission("AGENCY_ADMIN", "agency:manage_quota")).toBe(false);
  });

  it("AGENCY_USER cannot manage generation quota", () => {
    expect(roleHasPermission("AGENCY_USER", "agency:manage_quota")).toBe(false);
  });
});
