import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { QuotaExceededError } from "@/server/services/generation-quota.service";

/**
 * Closed Beta: 20 agencies, 50 complimentary advertisements each.
 */
describe("Closed Beta allocation", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("grants 50 complimentary generations by default", () => {
    // The bootstrap default of 10 would have stopped every beta agency a
    // fifth of the way through their allocation.
    expect(schema).toMatch(/totalQuota\s+Int @default\(50\)/);
  });

  it("ships a migration so existing agencies move to the beta allocation", () => {
    const migration = readFileSync(
      "prisma/migrations/20260729000000_closed_beta_50_credits/migration.sql",
      "utf8",
    );
    expect(migration).toMatch(/SET DEFAULT 50/);
    expect(migration).toMatch(/UPDATE "agency_generation_quotas"/);
  });

  it("completes the allocation with a thank-you, not a paywall", () => {
    const message = new QuotaExceededError().message;
    expect(message).toContain("complimentary beta allocation");
    expect(message).toContain("next phase");
    // "Contact support to continue" read like a charge for something free.
    expect(message).not.toMatch(/contact support|upgrade|pay|billing/i);
  });

  it("does not suspend or block the agency account", () => {
    const service = readFileSync("src/server/services/generation-quota.service.ts", "utf8");
    expect(service).not.toMatch(/status:\s*"SUSPENDED"/);
  });
});

describe("Closed Beta admin metrics", () => {
  const service = readFileSync("src/server/services/beta-metrics.service.ts", "utf8");

  it("uses the real AgencyStatus values", () => {
    // A guessed "ACTIVE" silently counted zero approved agencies.
    expect(service).toContain('count("APPROVED")');
    expect(service).not.toContain('count("ACTIVE")');
  });

  it("counts failed generations from the recorded success flag", () => {
    expect(service).toContain('by: ["success"]');
    expect(service).toContain('operationType: "FULL_AD_GENERATION"');
  });

  it("reports every figure the beta needs to be run", () => {
    for (const field of ["pending", "approved", "suspended", "exhausted", "averageGenerationMs", "mostActive"]) {
      expect(service, field).toContain(field);
    }
  });
});
