import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * JobOrder Intelligence — persistence, against a real PostgreSQL
 * instance (Task 003).
 *
 * Verifies the guarantees only the table can enforce: that a
 * determination cannot be stored without a reason, that a confident
 * UNKNOWN is unrepresentable, that a requirement cannot hold two
 * conclusions for one attribute, and that the understanding is removed
 * with the requirement it describes.
 *
 * Skips automatically when DATABASE_URL isn't reachable, matching every
 * other integration test in this suite.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kai_ads:kai_ads_dev_pw@localhost:5432/kai_ads?schema=public";

let client: Client;
let dbAvailable = false;

const agencyId = `joi-agency-${randomUUID()}`;
const userId = `joi-user-${randomUUID()}`;
let jobOrderId: string;

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM job_order_determinations LIMIT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  await client.query(
    `INSERT INTO agencies ("id","name","registrationNumber","website","officialEmail","logoUrl","status","createdAt","updatedAt")
     VALUES ($1,'JOI Agency',$2,'https://example.com',$3,'https://example.com/l.png','APPROVED',NOW(),NOW())`,
    [agencyId, `RA-${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`],
  );
  await client.query(
    `INSERT INTO users ("id","email","name","role","status","agencyId","createdAt","updatedAt")
     VALUES ($1,$2,'JOI Recruiter','AGENCY_ADMIN','ACTIVE',$3,NOW(),NOW())`,
    [userId, `${randomUUID()}@example.com`, agencyId],
  );

  jobOrderId = `joi-jo-${randomUUID()}`;
  await client.query(
    `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
     VALUES ($1,$2,'Instrument Technician — Saudi Arabia','Oil & Gas','Saudi Arabia',$3,NOW(),NOW())`,
    [jobOrderId, agencyId, userId],
  );
});

afterAll(async () => {
  if (!dbAvailable) return;
  await client.query("DELETE FROM agencies WHERE id = $1", [agencyId]);
  await client.end();
});

async function insertDetermination(params: {
  jobOrderId?: string;
  attribute: string;
  value: string;
  confidencePct?: number;
  reason?: string | null;
  signals?: string[];
}) {
  return client.query(
    `INSERT INTO job_order_determinations
       ("id","jobOrderId","attribute","value","confidencePct","source","reason","signals","engineVersion","computedAt")
     VALUES ($1,$2,$3,$4,$5,'position title',$6,$7::jsonb,'1.0.0',NOW())`,
    [
      `joi-det-${randomUUID()}`,
      params.jobOrderId ?? jobOrderId,
      params.attribute,
      params.value,
      params.confidencePct ?? 98,
      params.reason === undefined ? "Detected from: Analyzer Technician, Process Operator" : params.reason,
      JSON.stringify(params.signals ?? ["Analyzer Technician"]),
    ],
  );
}

describe.skipIf(!process.env.DATABASE_URL && !dbAvailable)(
  "JobOrder Intelligence persistence against a real PostgreSQL instance",
  () => {
    it("attaches a determination with its source, confidence and reason", async () => {
      if (!dbAvailable) return;
      await insertDetermination({ attribute: "industry", value: "Oil & Gas" });

      const { rows } = await client.query(
        `SELECT "attribute","value","confidencePct","source","reason","signals","engineVersion"
         FROM job_order_determinations WHERE "jobOrderId" = $1 AND "attribute" = 'industry'`,
        [jobOrderId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("Oil & Gas");
      expect(rows[0].confidencePct).toBe(98);
      expect(rows[0].reason).toContain("Detected from:");
      expect(rows[0].signals).toEqual(["Analyzer Technician"]);
      expect(rows[0].engineVersion).toBe("1.0.0");
    });

    it("refuses to store a determination with no reason", async () => {
      if (!dbAvailable) return;
      // The engine may return UNKNOWN, but it may never return a value
      // it cannot explain. Enforced by the schema, not by convention.
      await expect(
        insertDetermination({ attribute: "sector", value: "Energy", reason: null }),
      ).rejects.toThrow();
    });

    it("stores UNKNOWN as a row rather than as a missing row", async () => {
      if (!dbAvailable) return;
      await insertDetermination({
        attribute: "plantType",
        value: "UNKNOWN",
        confidencePct: 0,
        reason: "No plant type could be determined — the requirement names no recognisable facility.",
      });

      const { rows } = await client.query(
        `SELECT "value","confidencePct","reason" FROM job_order_determinations
         WHERE "jobOrderId" = $1 AND "attribute" = 'plantType'`,
        [jobOrderId],
      );
      // "We looked and could not tell" stays distinguishable from
      // "this was never assessed".
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("UNKNOWN");
      expect(rows[0].confidencePct).toBe(0);
      expect(rows[0].reason.length).toBeGreaterThan(0);
    });

    it("makes a confident UNKNOWN unrepresentable", async () => {
      if (!dbAvailable) return;
      // "UNKNOWN at 90%" is meaningless and must not be storable.
      await expect(
        insertDetermination({ attribute: "plantStatus", value: "UNKNOWN", confidencePct: 90 }),
      ).rejects.toThrow();
    });

    it.each([-1, 101, 250])("rejects a confidence of %i", async (confidencePct) => {
      if (!dbAvailable) return;
      await expect(
        insertDetermination({ attribute: `urgency-${confidencePct}`, value: "Normal", confidencePct }),
      ).rejects.toThrow();
    });

    it("permits only one conclusion per attribute per requirement", async () => {
      if (!dbAvailable) return;
      await insertDetermination({ attribute: "hiringPattern", value: "Bulk Mobilization" });

      // Two industries for one requirement would mean the engine reached
      // two conclusions — which is exactly what it reports as UNKNOWN.
      await expect(
        insertDetermination({ attribute: "hiringPattern", value: "Specialist Hiring" }),
      ).rejects.toThrow();
    });

    it("supports the question this engine exists to make answerable", async () => {
      if (!dbAvailable) return;
      await insertDetermination({ attribute: "plantStatus", value: "Shutdown" });

      // "Show me every refinery shutdown we have run."
      const { rows } = await client.query(
        `SELECT jo."id" FROM job_orders jo
         JOIN job_order_determinations d ON d."jobOrderId" = jo."id"
         WHERE jo."agencyId" = $1 AND d."attribute" = 'plantStatus' AND d."value" = 'Shutdown'`,
        [agencyId],
      );
      expect(rows.map((r) => r.id)).toContain(jobOrderId);
    });

    it("removes the understanding with the requirement it describes", async () => {
      if (!dbAvailable) return;
      const throwaway = `joi-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Temp','Construction','Qatar',$3,NOW(),NOW())`,
        [throwaway, agencyId, userId],
      );
      await insertDetermination({ jobOrderId: throwaway, attribute: "industry", value: "Construction" });

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwaway]);

      const { rows } = await client.query(
        `SELECT 1 FROM job_order_determinations WHERE "jobOrderId" = $1`,
        [throwaway],
      );
      expect(rows).toHaveLength(0);
    });

    it("leaves Task 001 and Task 002 records untouched", async () => {
      if (!dbAvailable) return;
      // This engine only attaches understanding; it must never modify the
      // requirement it is understanding.
      const { rows } = await client.query(
        `SELECT "title","industry","country" FROM job_orders WHERE "id" = $1`,
        [jobOrderId],
      );
      expect(rows[0]).toEqual({
        title: "Instrument Technician — Saudi Arabia",
        industry: "Oil & Gas",
        country: "Saudi Arabia",
      });
    });

    it("replaces a determination set wholesale on reassessment", async () => {
      if (!dbAvailable) return;
      const throwaway = `joi-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Reassess','Construction','Oman',$3,NOW(),NOW())`,
        [throwaway, agencyId, userId],
      );
      await insertDetermination({ jobOrderId: throwaway, attribute: "industry", value: "Construction" });

      // What the service does on re-run: delete then insert, so a
      // requirement is never half old understanding and half new.
      await client.query(`DELETE FROM job_order_determinations WHERE "jobOrderId" = $1`, [throwaway]);
      await insertDetermination({ jobOrderId: throwaway, attribute: "industry", value: "Oil & Gas" });

      const { rows } = await client.query(
        `SELECT "value" FROM job_order_determinations WHERE "jobOrderId" = $1 AND "attribute" = 'industry'`,
        [throwaway],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("Oil & Gas");

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwaway]);
    });
  },
);
