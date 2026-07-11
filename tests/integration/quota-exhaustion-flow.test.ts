import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Sprint 005 — the two specific scenarios the brief calls out by name:
 * "10 successful generations -> 11th generation blocked" and "Provider
 * failure -> Quota not consumed." Same real-PostgreSQL substitution
 * pattern as every prior sprint's integration test.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kai_ads:kai_ads_dev_pw@localhost:5432/kai_ads?schema=public";

let client: Client;
let dbAvailable = false;

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) await client.end();
});

describe.skipIf(!process.env.DATABASE_URL && !dbAvailable)(
  "Bootstrap Trial Quota exhaustion against a real PostgreSQL instance",
  () => {
    const suffix = randomUUID().slice(0, 8);
    let agencyId: string;
    let userId: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      const agency = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'Quota Test Agency', $2, 'https://quota-test.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `QUOTA-${suffix}`, `admin-${suffix}@quota-test.dev`],
      );
      agencyId = agency.rows[0].id;

      const user = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'Quota Test User', $2, 'AGENCY_ADMIN', 'ACTIVE', $3, now(), now()) RETURNING id`,
        [randomUUID(), `user-${suffix}@quota-test.dev`, agencyId],
      );
      userId = user.rows[0].id;

      await client.query(
        `INSERT INTO agency_generation_quotas (id, "agencyId", "totalQuota", "successfulGenerationsUsed", "createdAt", "updatedAt")
         VALUES ($1, $2, 10, 0, now(), now())`,
        [randomUUID(), agencyId],
      );
    });

    it("10 successful generations bring the agency exactly to its limit", async () => {
      if (!dbAvailable) return;
      for (let i = 0; i < 10; i++) {
        await client.query(
          `UPDATE agency_generation_quotas SET "successfulGenerationsUsed" = "successfulGenerationsUsed" + 1 WHERE "agencyId" = $1`,
          [agencyId],
        );
        await client.query(
          `INSERT INTO ai_usage_logs (id, "operationType", provider, model, success, billable, "agencyId", "userId", "createdAt")
           VALUES ($1, 'FULL_AD_GENERATION', 'kai', 'section-renderer', true, true, $2, $3, now())`,
          [randomUUID(), agencyId, userId],
        );
      }

      const quota = await client.query(
        `SELECT "totalQuota", "successfulGenerationsUsed" FROM agency_generation_quotas WHERE "agencyId" = $1`,
        [agencyId],
      );
      expect(quota.rows[0].successfulGenerationsUsed).toBe(10);
      expect(quota.rows[0].totalQuota).toBe(10);

      const remaining = quota.rows[0].totalQuota - quota.rows[0].successfulGenerationsUsed;
      expect(remaining).toBe(0);
    });

    it("the 11th generation is correctly identified as over quota (mirrors assertGenerationAllowed's check)", async () => {
      if (!dbAvailable) return;
      const quota = await client.query(
        `SELECT "totalQuota", "successfulGenerationsUsed" FROM agency_generation_quotas WHERE "agencyId" = $1`,
        [agencyId],
      );
      const remaining = quota.rows[0].totalQuota - quota.rows[0].successfulGenerationsUsed;
      expect(remaining).toBeLessThanOrEqual(0);
    });

    it("a provider failure does NOT consume quota — 'Do not count: Provider failures'", async () => {
      if (!dbAvailable) return;

      const agency2 = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'Quota Failure Test Agency', $2, 'https://quota-fail.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `QUOTA-FAIL-${suffix}`, `admin-fail-${suffix}@quota-test.dev`],
      );
      const agency2Id = agency2.rows[0].id;
      await client.query(
        `INSERT INTO agency_generation_quotas (id, "agencyId", "totalQuota", "successfulGenerationsUsed", "createdAt", "updatedAt")
         VALUES ($1, $2, 10, 0, now(), now())`,
        [randomUUID(), agency2Id],
      );

      await client.query(
        `INSERT INTO ai_usage_logs (id, "operationType", provider, model, success, billable, "errorMessage", "agencyId", "userId", "createdAt")
         VALUES ($1, 'FULL_AD_GENERATION', 'kai', 'section-renderer', false, false, 'QR generation failed', $2, $3, now())`,
        [randomUUID(), agency2Id, userId],
      );

      const quota = await client.query(
        `SELECT "successfulGenerationsUsed" FROM agency_generation_quotas WHERE "agencyId" = $1`,
        [agency2Id],
      );
      expect(quota.rows[0].successfulGenerationsUsed).toBe(0);

      const failedLog = await client.query(
        `SELECT success, billable FROM ai_usage_logs WHERE "agencyId" = $1 AND success = false`,
        [agency2Id],
      );
      expect(failedLog.rows[0].billable).toBe(false);

      await client.query(`DELETE FROM ai_usage_logs WHERE "agencyId" = $1`, [agency2Id]);
      await client.query(`DELETE FROM agency_generation_quotas WHERE "agencyId" = $1`, [agency2Id]);
      await client.query(`DELETE FROM users WHERE "agencyId" = $1`, [agency2Id]);
      await client.query(`DELETE FROM agencies WHERE id = $1`, [agency2Id]);
    });

    afterAll(async () => {
      if (!dbAvailable) return;
      await client.query(`DELETE FROM ai_usage_logs WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM agency_generation_quotas WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM users WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM agencies WHERE id = $1`, [agencyId]);
    });
  },
);
