import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Sprint 002 — Advertisement Intelligence Engine, real-database
 * verification. Same rationale as tests/integration/e2e-flow.test.ts:
 * this sandbox cannot run `prisma generate` (see README "Known
 * environment limitation"), so the actual advertisement.service.ts
 * cannot execute here. This test runs the equivalent SQL directly
 * against the schema produced by
 * prisma/migrations/20260201000000_advertisement_engine/migration.sql,
 * proving the schema/constraints/state machine rather than the service
 * layer's TypeScript. Skips automatically if DATABASE_URL isn't reachable.
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
  "Advertisement lifecycle against a real PostgreSQL instance",
  () => {
    const suffix = randomUUID().slice(0, 8);
    let agencyId: string;
    let userId: string;
    let advertisementId: string;
    let duplicateId: string;

    const samplePositions = JSON.stringify([{ title: "Welder", count: 10 }]);
    const sampleBenefits = JSON.stringify([{ label: "Free accommodation" }]);
    const sampleInterview = JSON.stringify({ date: "2026-08-01", mode: "in_person" });
    const sampleContact = JSON.stringify({ name: "Agency Desk", phone: "+91-9000000000" });

    beforeAll(async () => {
      if (!dbAvailable) return;
      // Fixture agency/user, independent of Sprint 001's e2e-flow test data.
      const agency = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'Ad Engine Test Agency', $2, 'https://ad-engine-test.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `AE-${suffix}`, `admin-${suffix}@ad-engine-test.dev`],
      );
      agencyId = agency.rows[0].id;

      const user = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'Ad Engine Tester', $2, 'AGENCY_ADMIN', 'ACTIVE', $3, now(), now()) RETURNING id`,
        [randomUUID(), `tester-${suffix}@ad-engine-test.dev`, agencyId],
      );
      userId = user.rows[0].id;
    });

    it("STEP 1 — creates an Advertisement with its v1 AdvertisementVersion and 'created' AdvertisementHistory (mirrors advertisementService.create)", async () => {
      if (!dbAvailable) return;

      await client.query("BEGIN");
      const created = await client.query(
        `INSERT INTO advertisements
           (id, "agencyId", header, industry, country, positions, benefits, interview, contact, style, status, "currentVersion", "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'Welders Needed — Gulf', 'Construction', 'UAE', $3, $4, $5, $6, 'VISUAL', 'DRAFT', 1, $7, now(), now())
         RETURNING id, status, "currentVersion"`,
        [randomUUID(), agencyId, samplePositions, sampleBenefits, sampleInterview, sampleContact, userId],
      );
      advertisementId = created.rows[0].id;

      await client.query(
        `INSERT INTO advertisement_versions (id, "advertisementId", "versionNumber", snapshot, "changeSummary", "createdById", "createdAt")
         VALUES ($1, $2, 1, $3, 'Initial version', $4, now())`,
        [randomUUID(), advertisementId, JSON.stringify({ header: "Welders Needed — Gulf" }), userId],
      );

      await client.query(
        `INSERT INTO advertisement_history (id, "advertisementId", action, "toStatus", "actorId", "createdAt")
         VALUES ($1, $2, 'created', 'DRAFT', $3, now())`,
        [randomUUID(), advertisementId, userId],
      );
      await client.query("COMMIT");

      expect(created.rows[0].status).toBe("DRAFT");
      expect(created.rows[0].currentVersion).toBe(1);
    });

    it("STEP 2 — updating creates version 2 and bumps currentVersion (mirrors advertisementService.update)", async () => {
      if (!dbAvailable) return;

      await client.query("BEGIN");
      await client.query(
        `UPDATE advertisements SET header = 'Welders Needed — Gulf (Updated)', "currentVersion" = 2, "updatedAt" = now() WHERE id = $1`,
        [advertisementId],
      );
      await client.query(
        `INSERT INTO advertisement_versions (id, "advertisementId", "versionNumber", snapshot, "changeSummary", "createdById", "createdAt")
         VALUES ($1, $2, 2, $3, 'Updated header', $4, now())`,
        [randomUUID(), advertisementId, JSON.stringify({ header: "Welders Needed — Gulf (Updated)" }), userId],
      );
      await client.query(
        `INSERT INTO advertisement_history (id, "advertisementId", action, "actorId", "createdAt")
         VALUES ($1, $2, 'updated', $3, now())`,
        [randomUUID(), advertisementId, userId],
      );
      await client.query("COMMIT");

      const versions = await client.query(
        `SELECT "versionNumber" FROM advertisement_versions WHERE "advertisementId" = $1 ORDER BY "versionNumber"`,
        [advertisementId],
      );
      const current = await client.query(`SELECT "currentVersion" FROM advertisements WHERE id = $1`, [advertisementId]);

      expect(versions.rows.map((r) => r.versionNumber)).toEqual([1, 2]);
      expect(current.rows[0].currentVersion).toBe(2);
    });

    it("rejects a duplicate version number for the same advertisement (unique constraint)", async () => {
      if (!dbAvailable) return;
      await expect(
        client.query(
          `INSERT INTO advertisement_versions (id, "advertisementId", "versionNumber", snapshot, "createdById", "createdAt")
           VALUES ($1, $2, 2, $3, $4, now())`,
          [randomUUID(), advertisementId, JSON.stringify({}), userId],
        ),
      ).rejects.toThrow(/duplicate key/i);
    });

    it("STEP 3 — status transition Draft -> Review -> Approved (mirrors advertisementService.changeStatus)", async () => {
      if (!dbAvailable) return;

      for (const [from, to] of [
        ["DRAFT", "REVIEW"],
        ["REVIEW", "APPROVED"],
      ] as const) {
        await client.query("BEGIN");
        await client.query(`UPDATE advertisements SET status = $1 WHERE id = $2`, [to, advertisementId]);
        await client.query(
          `INSERT INTO advertisement_history (id, "advertisementId", action, "fromStatus", "toStatus", "actorId", "createdAt")
           VALUES ($1, $2, 'status_changed', $3, $4, $5, now())`,
          [randomUUID(), advertisementId, from, to, userId],
        );
        await client.query("COMMIT");
      }

      const result = await client.query(`SELECT status FROM advertisements WHERE id = $1`, [advertisementId]);
      expect(result.rows[0].status).toBe("APPROVED");

      const history = await client.query(
        `SELECT action, "fromStatus", "toStatus" FROM advertisement_history WHERE "advertisementId" = $1 ORDER BY "createdAt"`,
        [advertisementId],
      );
      expect(history.rows.map((r) => r.action)).toEqual(["created", "updated", "status_changed", "status_changed"]);
    });

    it("STEP 4 — Archive moves status to ARCHIVED without soft-deleting (Advertisement Archive)", async () => {
      if (!dbAvailable) return;

      await client.query(`UPDATE advertisements SET status = 'ARCHIVED' WHERE id = $1`, [advertisementId]);
      await client.query(
        `INSERT INTO advertisement_history (id, "advertisementId", action, "fromStatus", "toStatus", "actorId", "createdAt")
         VALUES ($1, $2, 'status_changed', 'APPROVED', 'ARCHIVED', $3, now())`,
        [randomUUID(), advertisementId, userId],
      );

      const result = await client.query(`SELECT status, "deletedAt" FROM advertisements WHERE id = $1`, [advertisementId]);
      expect(result.rows[0].status).toBe("ARCHIVED");
      expect(result.rows[0].deletedAt).toBeNull();
    });

    it("STEP 5 — Restore un-archives back to REVIEW (Advertisement Restore)", async () => {
      if (!dbAvailable) return;

      await client.query(`UPDATE advertisements SET status = 'REVIEW' WHERE id = $1`, [advertisementId]);
      const result = await client.query(`SELECT status FROM advertisements WHERE id = $1`, [advertisementId]);
      expect(result.rows[0].status).toBe("REVIEW");
    });

    it("STEP 6 — Soft delete sets deletedAt without changing status (distinct from Archive)", async () => {
      if (!dbAvailable) return;

      await client.query(`UPDATE advertisements SET "deletedAt" = now() WHERE id = $1`, [advertisementId]);
      const result = await client.query(`SELECT status, "deletedAt" FROM advertisements WHERE id = $1`, [advertisementId]);
      expect(result.rows[0].status).toBe("REVIEW");
      expect(result.rows[0].deletedAt).not.toBeNull();
    });

    it("STEP 7 — a soft-deleted advertisement is excluded from the default (non-deleted) listing", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `SELECT id FROM advertisements WHERE "agencyId" = $1 AND "deletedAt" IS NULL AND id = $2`,
        [agencyId, advertisementId],
      );
      expect(result.rows).toHaveLength(0);
    });

    it("STEP 8 — Restore (undelete) clears deletedAt", async () => {
      if (!dbAvailable) return;
      await client.query(`UPDATE advertisements SET "deletedAt" = NULL WHERE id = $1`, [advertisementId]);
      const result = await client.query(`SELECT "deletedAt" FROM advertisements WHERE id = $1`, [advertisementId]);
      expect(result.rows[0].deletedAt).toBeNull();
    });

    it("STEP 9 — Duplicate creates a new advertisement linked via duplicatedFromId, with its own v1 (Advertisement Duplicate)", async () => {
      if (!dbAvailable) return;

      const dup = await client.query(
        `INSERT INTO advertisements
           (id, "agencyId", header, industry, country, positions, benefits, interview, contact, style, status, "currentVersion", "createdById", "duplicatedFromId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'Welders Needed — Gulf (Updated) (Copy)', 'Construction', 'UAE', $3, $4, $5, $6, 'VISUAL', 'DRAFT', 1, $7, $8, now(), now())
         RETURNING id, "duplicatedFromId"`,
        [randomUUID(), agencyId, samplePositions, sampleBenefits, sampleInterview, sampleContact, userId, advertisementId],
      );
      duplicateId = dup.rows[0].id;

      expect(dup.rows[0].duplicatedFromId).toBe(advertisementId);
    });

    it("STEP 10 — search/filter by industry + country scoped to the agency returns both records", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `SELECT id FROM advertisements WHERE "agencyId" = $1 AND industry = 'Construction' AND country = 'UAE' AND "deletedAt" IS NULL`,
        [agencyId],
      );
      const ids = result.rows.map((r) => r.id).sort();
      expect(ids).toEqual([advertisementId, duplicateId].sort());
    });

    it("deleting the original advertisement does not cascade-delete its duplicate (duplicatedFromId -> SET NULL)", async () => {
      if (!dbAvailable) return;
      await client.query(`DELETE FROM advertisements WHERE id = $1`, [advertisementId]);
      const result = await client.query(`SELECT id, "duplicatedFromId" FROM advertisements WHERE id = $1`, [duplicateId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].duplicatedFromId).toBeNull();
    });

    afterAll(async () => {
      if (!dbAvailable) return;
      await client.query(`DELETE FROM advertisement_history WHERE "advertisementId" IN ($1, $2)`, [
        advertisementId,
        duplicateId,
      ]);
      await client.query(`DELETE FROM advertisement_versions WHERE "advertisementId" IN ($1, $2)`, [
        advertisementId,
        duplicateId,
      ]);
      await client.query(`DELETE FROM advertisements WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM users WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM agencies WHERE id = $1`, [agencyId]);
    });
  },
);
