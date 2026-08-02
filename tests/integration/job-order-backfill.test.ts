import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Permanent business domain (Task 001) — real-database verification of
 * the backfill.
 *
 * The claim this migration makes is "zero data loss": every existing
 * advertisement keeps working AND gains exactly one JobOrder, every
 * position line becomes a queryable vacancy, and employer spellings
 * collapse to one record per agency. That claim is only worth anything
 * if it is executed against a real PostgreSQL instance, so this test
 * runs the migration's OWN backfill SQL — read from the migration file
 * rather than copied into the test — against legacy-shaped rows it
 * inserts itself.
 *
 * Skips automatically when DATABASE_URL isn't reachable, matching every
 * other integration test in this suite.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kai_ads:kai_ads_dev_pw@localhost:5432/kai_ads?schema=public";

const MIGRATION_SQL = path.join(
  process.cwd(),
  "prisma/migrations/20260802000000_job_order_domain/migration.sql",
);

/**
 * The backfill half of the migration, verbatim. Taking it from the file
 * means this test cannot drift from what actually ships — if someone
 * edits the migration, this test exercises the edit.
 */
function backfillSql(): string {
  const full = readFileSync(MIGRATION_SQL, "utf8");
  const marker = "-- 2. Backfill";
  const index = full.indexOf(marker);
  if (index === -1) throw new Error("Backfill section not found in migration.sql");
  return full.slice(index);
}

let client: Client;
let dbAvailable = false;

const agencyId = `test-agency-${randomUUID()}`;
const userId = `test-user-${randomUUID()}`;

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM advertisements LIMIT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  await client.query(
    `INSERT INTO agencies ("id","name","registrationNumber","website","officialEmail","logoUrl","status","createdAt","updatedAt")
     VALUES ($1,'Test Agency',$2,'https://example.com',$3,'https://example.com/logo.png','APPROVED',NOW(),NOW())`,
    [agencyId, `RA-${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`],
  );
  await client.query(
    `INSERT INTO users ("id","email","name","role","status","agencyId","createdAt","updatedAt")
     VALUES ($1,$2,'Test Recruiter','AGENCY_ADMIN','ACTIVE',$3,NOW(),NOW())`,
    [userId, `${randomUUID()}@example.com`, agencyId],
  );
});

afterAll(async () => {
  if (!dbAvailable) return;
  // positions and job_orders cascade from the agency; advertisements too.
  await client.query("DELETE FROM agencies WHERE id = $1", [agencyId]);
  await client.end();
});

/** Inserts an advertisement in its pre-migration shape: no job order attached. */
async function insertLegacyAdvertisement(params: {
  header: string;
  employer: string | null;
  positions: unknown[];
  industry?: string;
  country?: string;
}): Promise<string> {
  const id = `ad-${randomUUID()}`;
  await client.query(
    `INSERT INTO advertisements
       ("id","agencyId","header","industry","country","employer","positions","benefits","interview","contact",
        "style","status","currentVersion","createdById","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,
             'VISUAL','DRAFT',1,$8,NOW(),NOW())`,
    [
      id,
      agencyId,
      params.header,
      params.industry ?? "Construction",
      params.country ?? "Saudi Arabia",
      params.employer,
      JSON.stringify(params.positions),
      userId,
    ],
  );
  return id;
}

describe.skipIf(!process.env.DATABASE_URL && !dbAvailable)(
  "JobOrder domain backfill against a real PostgreSQL instance",
  () => {
    it("gives every legacy advertisement exactly one JobOrder", async () => {
      if (!dbAvailable) return;

      const adIds = await Promise.all([
        insertLegacyAdvertisement({
          header: "Saudi Construction Drive",
          employer: "ABC Contracting",
          positions: [{ title: "Scaffolder", count: 20 }],
        }),
        insertLegacyAdvertisement({
          header: "Qatar Hospitality",
          employer: null,
          positions: [{ title: "Waiter", count: 5 }],
        }),
      ]);

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT "id","jobOrderId" FROM advertisements WHERE "id" = ANY($1)`,
        [adIds],
      );
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.jobOrderId).not.toBeNull();
      }
      // 1:1 — no two advertisements share a requirement.
      expect(new Set(rows.map((r) => r.jobOrderId)).size).toBe(2);
    });

    it("pairs 1:1 even when two advertisements are field-for-field identical", async () => {
      if (!dbAvailable) return;

      // The exact case a content-match backfill would get wrong.
      const first = await insertLegacyAdvertisement({
        header: "Identical Requirement",
        employer: "Twin Employer",
        positions: [{ title: "Welder", count: 10 }],
      });
      const second = await insertLegacyAdvertisement({
        header: "Identical Requirement",
        employer: "Twin Employer",
        positions: [{ title: "Welder", count: 10 }],
      });

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT "id","jobOrderId" FROM advertisements WHERE "id" IN ($1,$2)`,
        [first, second],
      );
      const jobOrderIds = rows.map((r) => r.jobOrderId);
      expect(jobOrderIds.every(Boolean)).toBe(true);
      expect(new Set(jobOrderIds).size).toBe(2);
    });

    it("collapses employer spelling variants into one Employer record", async () => {
      if (!dbAvailable) return;

      const spelling = `Varied Employer ${randomUUID().slice(0, 6)}`;
      await insertLegacyAdvertisement({
        header: "Variant A",
        employer: spelling,
        positions: [{ title: "Fitter", count: 3 }],
      });
      await insertLegacyAdvertisement({
        header: "Variant B",
        employer: `  ${spelling.toUpperCase()}  `,
        positions: [{ title: "Fitter", count: 4 }],
      });
      await insertLegacyAdvertisement({
        header: "Variant C",
        employer: spelling.replace(" ", "   "),
        positions: [{ title: "Fitter", count: 5 }],
      });

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT "id","name" FROM employers WHERE "agencyId" = $1 AND "normalizedName" = $2`,
        [agencyId, spelling.replace(/\s+/g, " ").trim().toLowerCase()],
      );
      expect(rows).toHaveLength(1);
      // Display name keeps the earliest spelling, not the shouted one.
      expect(rows[0].name).toBe(spelling);
    });

    it("links a JobOrder to no employer when the advertisement named none", async () => {
      if (!dbAvailable) return;

      const adId = await insertLegacyAdvertisement({
        header: "No Employer Named",
        employer: "   ",
        positions: [{ title: "Helper", count: 2 }],
      });

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT jo."employerId" FROM advertisements a
         JOIN job_orders jo ON jo."id" = a."jobOrderId" WHERE a."id" = $1`,
        [adId],
      );
      expect(rows[0].employerId).toBeNull();
      // And no employer named "" was created.
      const empty = await client.query(
        `SELECT 1 FROM employers WHERE "agencyId" = $1 AND "normalizedName" = ''`,
        [agencyId],
      );
      expect(empty.rows).toHaveLength(0);
    });

    it("explodes every position into a vacancy row, in source order, losing none", async () => {
      if (!dbAvailable) return;

      const adId = await insertLegacyAdvertisement({
        header: "Bulk Requirement",
        employer: "Bulk Employer",
        positions: [
          { title: "Scaffolder", count: 18, salary: "SAR 1,800", experience: "3 years" },
          { title: "Rigger", count: 7, qualifications: ["ITI", "Rigging Level 2"] },
          { title: "QC Inspector", count: 4, ageRange: "25-45", language: "English" },
        ],
      });

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT p."title", p."normalizedTitle", p."count", p."salary", p."experience",
                p."ageRange", p."language", p."qualifications", p."sortOrder"
         FROM positions p
         JOIN advertisements a ON a."jobOrderId" = p."jobOrderId"
         WHERE a."id" = $1 ORDER BY p."sortOrder"`,
        [adId],
      );

      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.title)).toEqual(["Scaffolder", "Rigger", "QC Inspector"]);
      expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
      expect(rows.map((r) => r.count)).toEqual([18, 7, 4]);
      expect(rows[0].normalizedTitle).toBe("scaffolder");
      expect(rows[0].salary).toBe("SAR 1,800");
      expect(rows[0].experience).toBe("3 years");
      expect(rows[1].qualifications).toEqual(["ITI", "Rigging Level 2"]);
      expect(rows[2].ageRange).toBe("25-45");
      expect(rows[2].language).toBe("English");
    });

    it("preserves total stated demand exactly across a large bulk requirement", async () => {
      if (!dbAvailable) return;

      const positions = Array.from({ length: 60 }, (_, i) => ({
        title: `Trade ${i}`,
        count: i + 1,
      }));
      const adId = await insertLegacyAdvertisement({
        header: "60-Line Requirement",
        employer: "Mega Project",
        positions,
      });

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS lines, COALESCE(SUM(p."count"),0)::int AS total
         FROM positions p
         JOIN advertisements a ON a."jobOrderId" = p."jobOrderId"
         WHERE a."id" = $1`,
        [adId],
      );
      expect(rows[0].lines).toBe(60);
      expect(rows[0].total).toBe(1830); // 1+2+...+60
    });

    it("keeps a position whose count is missing or non-numeric, recording no headcount", async () => {
      if (!dbAvailable) return;

      const adId = await insertLegacyAdvertisement({
        header: "Odd Counts",
        employer: "Odd Employer",
        positions: [
          { title: "Foreman" },
          { title: "Storekeeper", count: "many" },
          { title: "Driver", count: null },
        ],
      });

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT p."title", p."count" FROM positions p
         JOIN advertisements a ON a."jobOrderId" = p."jobOrderId"
         WHERE a."id" = $1 ORDER BY p."sortOrder"`,
        [adId],
      );
      // All three vacancies survive — a malformed count never deletes a role.
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.count)).toEqual([null, null, null]);
    });

    it("backfills soft-deleted and archived advertisements — history keeps its requirement", async () => {
      if (!dbAvailable) return;

      const deletedId = await insertLegacyAdvertisement({
        header: "Deleted Ad",
        employer: "Past Employer",
        positions: [{ title: "Mason", count: 6 }],
      });
      const archivedId = await insertLegacyAdvertisement({
        header: "Archived Ad",
        employer: "Past Employer",
        positions: [{ title: "Painter", count: 3 }],
      });
      await client.query(`UPDATE advertisements SET "deletedAt" = NOW() WHERE "id" = $1`, [deletedId]);
      await client.query(`UPDATE advertisements SET "status" = 'ARCHIVED' WHERE "id" = $1`, [archivedId]);

      await client.query(backfillSql());

      const { rows } = await client.query(
        `SELECT "jobOrderId" FROM advertisements WHERE "id" IN ($1,$2)`,
        [deletedId, archivedId],
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.jobOrderId !== null)).toBe(true);
    });

    it("is idempotent — re-running duplicates no employer, requirement or vacancy", async () => {
      if (!dbAvailable) return;

      await insertLegacyAdvertisement({
        header: "Idempotency Check",
        employer: "Repeat Employer",
        positions: [{ title: "Electrician", count: 12 }],
      });

      await client.query(backfillSql());

      const snapshot = async () => {
        const { rows } = await client.query(
          `SELECT
             (SELECT COUNT(*)::int FROM employers  WHERE "agencyId" = $1) AS employers,
             (SELECT COUNT(*)::int FROM job_orders WHERE "agencyId" = $1) AS job_orders,
             (SELECT COUNT(*)::int FROM positions p
                JOIN job_orders jo ON jo."id" = p."jobOrderId"
               WHERE jo."agencyId" = $1) AS positions`,
          [agencyId],
        );
        return rows[0];
      };

      const before = await snapshot();
      await client.query(backfillSql());
      await client.query(backfillSql());
      const after = await snapshot();

      expect(after).toEqual(before);
    });

    it("never destroys advertisement history when a requirement is removed", async () => {
      if (!dbAvailable) return;

      const adId = await insertLegacyAdvertisement({
        header: "Survives Its Requirement",
        employer: "Transient Employer",
        positions: [{ title: "Carpenter", count: 8 }],
      });
      await client.query(backfillSql());

      const { rows: linked } = await client.query(
        `SELECT "jobOrderId" FROM advertisements WHERE "id" = $1`,
        [adId],
      );
      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [linked[0].jobOrderId]);

      const { rows } = await client.query(
        `SELECT "id","jobOrderId","header" FROM advertisements WHERE "id" = $1`,
        [adId],
      );
      // The advertisement is a historical record: it survives, detached.
      expect(rows).toHaveLength(1);
      expect(rows[0].jobOrderId).toBeNull();
      expect(rows[0].header).toBe("Survives Its Requirement");
    });

    it("keeps requirement history when an employer record is removed", async () => {
      if (!dbAvailable) return;

      const adId = await insertLegacyAdvertisement({
        header: "Employer Removed",
        employer: `Doomed Employer ${randomUUID().slice(0, 6)}`,
        positions: [{ title: "Plumber", count: 2 }],
      });
      await client.query(backfillSql());

      const { rows: before } = await client.query(
        `SELECT jo."id" AS job_order_id, jo."employerId"
         FROM advertisements a JOIN job_orders jo ON jo."id" = a."jobOrderId"
         WHERE a."id" = $1`,
        [adId],
      );
      await client.query(`DELETE FROM employers WHERE "id" = $1`, [before[0].employerId]);

      const { rows } = await client.query(`SELECT "employerId" FROM job_orders WHERE "id" = $1`, [
        before[0].job_order_id,
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].employerId).toBeNull();
    });

    it("removes a requirement's vacancies with it — a position has no life of its own", async () => {
      if (!dbAvailable) return;

      const adId = await insertLegacyAdvertisement({
        header: "Cascade Check",
        employer: "Cascade Employer",
        positions: [{ title: "Welder", count: 4 }],
      });
      await client.query(backfillSql());

      const { rows: linked } = await client.query(
        `SELECT "jobOrderId" FROM advertisements WHERE "id" = $1`,
        [adId],
      );
      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [linked[0].jobOrderId]);

      const { rows } = await client.query(`SELECT 1 FROM positions WHERE "jobOrderId" = $1`, [
        linked[0].jobOrderId,
      ]);
      expect(rows).toHaveLength(0);
    });

    it("enforces one employer per agency per normalized name", async () => {
      if (!dbAvailable) return;

      const normalized = `dup-check-${randomUUID().slice(0, 8)}`;
      await client.query(
        `INSERT INTO employers ("id","agencyId","name","normalizedName","createdAt","updatedAt")
         VALUES ($1,$2,'Dup Check',$3,NOW(),NOW())`,
        [`emp-${randomUUID()}`, agencyId, normalized],
      );

      await expect(
        client.query(
          `INSERT INTO employers ("id","agencyId","name","normalizedName","createdAt","updatedAt")
           VALUES ($1,$2,'Dup Check Again',$3,NOW(),NOW())`,
          [`emp-${randomUUID()}`, agencyId, normalized],
        ),
      ).rejects.toThrow();
    });
  },
);
