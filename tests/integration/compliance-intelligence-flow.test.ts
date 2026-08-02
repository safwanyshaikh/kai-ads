import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Compliance Intelligence — persistence, against a real PostgreSQL
 * instance (Task 004).
 *
 * Verifies the guarantees only the table can enforce, and on a
 * compliance record those matter more than anywhere else in the
 * pipeline: a legal requirement cannot be stored without naming its
 * authority, a determination cannot be stored without a reason, and a
 * confident UNKNOWN is unrepresentable — because "UNKNOWN at 90%" reads
 * as a near-certain legal finding.
 *
 * Skips automatically when DATABASE_URL isn't reachable.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kai_ads:kai_ads_dev_pw@localhost:5432/kai_ads?schema=public";

let client: Client;
let dbAvailable = false;

const agencyId = `ci-agency-${randomUUID()}`;
const userId = `ci-user-${randomUUID()}`;
let jobOrderId: string;

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM compliance_determinations LIMIT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  await client.query(
    `INSERT INTO agencies ("id","name","registrationNumber","website","officialEmail","logoUrl","status","createdAt","updatedAt")
     VALUES ($1,'CI Agency',$2,'https://example.com',$3,'https://example.com/l.png','APPROVED',NOW(),NOW())`,
    [agencyId, `RA-${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`],
  );
  await client.query(
    `INSERT INTO users ("id","email","name","role","status","agencyId","createdAt","updatedAt")
     VALUES ($1,$2,'CI Recruiter','AGENCY_ADMIN','ACTIVE',$3,NOW(),NOW())`,
    [userId, `${randomUUID()}@example.com`, agencyId],
  );

  jobOrderId = `ci-jo-${randomUUID()}`;
  await client.query(
    `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
     VALUES ($1,$2,'Welder — Saudi Arabia','Oil & Gas','Saudi Arabia',$3,NOW(),NOW())`,
    [jobOrderId, agencyId, userId],
  );
});

afterAll(async () => {
  if (!dbAvailable) return;
  await client.query("DELETE FROM agencies WHERE id = $1", [agencyId]);
  await client.end();
});

async function insert(params: {
  jobOrderId?: string;
  code: string;
  category?: string;
  status?: string;
  value?: string;
  confidencePct?: number;
  reason?: string | null;
  authority?: string | null;
  reviewStatus?: string | null;
}) {
  return client.query(
    `INSERT INTO compliance_determinations
       ("id","jobOrderId","code","category","status","value","confidencePct","source","reason","authority","citation","reviewStatus","engineVersion","computedAt")
     VALUES ($1,$2,$3,$4::"ComplianceCategory",$5::"ComplianceStatus",$6,$7,'compliance knowledge base',$8,$9,'general provision',$10::"ComplianceReviewStatus",'1.0.0',NOW())`,
    [
      `ci-det-${randomUUID()}`,
      params.jobOrderId ?? jobOrderId,
      params.code,
      params.category ?? "AGENCY_DISCLOSURE",
      params.status ?? "REQUIRED",
      params.value ?? "The recruiting agent's registration number must be displayed.",
      params.confidencePct ?? 95,
      params.reason === undefined ? "Required for India-origin recruitment." : params.reason,
      params.authority === undefined ? "Emigration Act 1983 (India)" : params.authority,
      params.reviewStatus === undefined ? "REQUIRES_LEGAL_REVIEW" : params.reviewStatus,
    ],
  );
}

describe.skipIf(!process.env.DATABASE_URL && !dbAvailable)(
  "Compliance Intelligence persistence against a real PostgreSQL instance",
  () => {
    it("attaches a determination with its authority, confidence and reason", async () => {
      if (!dbAvailable) return;
      await insert({ code: "IN-EMIG-RA-NUMBER" });

      const { rows } = await client.query(
        `SELECT "code","status","authority","citation","reason","confidencePct","reviewStatus","engineVersion"
         FROM compliance_determinations WHERE "jobOrderId" = $1 AND "code" = 'IN-EMIG-RA-NUMBER'`,
        [jobOrderId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].authority).toContain("Emigration Act");
      expect(rows[0].reason.length).toBeGreaterThan(0);
      expect(rows[0].reviewStatus).toBe("REQUIRES_LEGAL_REVIEW");
      expect(rows[0].engineVersion).toBe("1.0.0");
    });

    it("refuses to store a determination with no reason", async () => {
      if (!dbAvailable) return;
      await expect(insert({ code: "NO-REASON", reason: null })).rejects.toThrow();
    });

    it("refuses to assert a legal requirement without naming its authority", async () => {
      if (!dbAvailable) return;
      // A requirement nobody can trace to an instrument is exactly the
      // invented rule this engine must never produce.
      await expect(
        insert({ code: "IN-EMIG-NO-AUTHORITY", status: "REQUIRED", authority: null }),
      ).rejects.toThrow();
    });

    it("allows a record-gap row to have no authority, since it asserts no law", async () => {
      if (!dbAvailable) return;
      await expect(
        insert({ code: "MISSING:RA-NUMBER", status: "REQUIRED", authority: null }),
      ).resolves.toBeDefined();
    });

    it("allows the readiness summary to have no authority", async () => {
      if (!dbAvailable) return;
      await expect(
        insert({ code: "COMPLIANCE_READINESS", status: "REQUIRED", authority: null, value: "ACTION_REQUIRED" }),
      ).resolves.toBeDefined();
    });

    it("makes a confident UNKNOWN unrepresentable", async () => {
      if (!dbAvailable) return;
      // On a compliance record, "UNKNOWN at 90%" reads as a near-certain
      // legal finding. It must not be storable.
      await expect(
        insert({ code: "UNKNOWN-CONFIDENT", status: "UNKNOWN", confidencePct: 90, authority: null }),
      ).rejects.toThrow();
    });

    it("stores UNKNOWN as a row rather than as absence", async () => {
      if (!dbAvailable) return;
      await insert({
        code: "COUNTRY_RULE:summary",
        category: "COUNTRY_RULE",
        status: "UNKNOWN",
        value: "UNKNOWN",
        confidencePct: 0,
        authority: null,
        reviewStatus: null,
        reason: "The knowledge base holds no country rules for this destination. NOT a finding that no requirements apply.",
      });

      const { rows } = await client.query(
        `SELECT "status","value","confidencePct","reason" FROM compliance_determinations
         WHERE "jobOrderId" = $1 AND "code" = 'COUNTRY_RULE:summary'`,
        [jobOrderId],
      );
      // An empty list would have read as a clean bill.
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("UNKNOWN");
      expect(rows[0].confidencePct).toBe(0);
      expect(rows[0].reason).toContain("NOT a finding");
    });

    it.each([-1, 101])("rejects a confidence of %i", async (confidencePct) => {
      if (!dbAvailable) return;
      await expect(insert({ code: `RANGE-${confidencePct}`, confidencePct })).rejects.toThrow();
    });

    it("permits only one verdict per code per requirement", async () => {
      if (!dbAvailable) return;
      await insert({ code: "IN-EMIG-NO-GUARANTEE", category: "FORBIDDEN_CLAIM" });
      await expect(
        insert({ code: "IN-EMIG-NO-GUARANTEE", category: "FORBIDDEN_CLAIM" }),
      ).rejects.toThrow();
    });

    it("answers the owner's question: what cannot go out yet", async () => {
      if (!dbAvailable) return;
      await insert({ code: "FORBIDDEN_CLAIM:free-visa", category: "FORBIDDEN_CLAIM", status: "VIOLATED" });

      const { rows } = await client.query(
        `SELECT DISTINCT jo."id" FROM job_orders jo
         JOIN compliance_determinations d ON d."jobOrderId" = jo."id"
         WHERE jo."agencyId" = $1 AND d."status" IN ('VIOLATED','REQUIRED')`,
        [agencyId],
      );
      expect(rows.map((r) => r.id)).toContain(jobOrderId);
    });

    it("preserves whether a rule was legally reviewed or merely encoded", async () => {
      if (!dbAvailable) return;
      await insert({ code: "KAI-TRUST-VERIFICATION-QR", category: "TRUST_ELEMENT", reviewStatus: "REVIEWED" });

      const { rows } = await client.query(
        `SELECT "reviewStatus" FROM compliance_determinations
         WHERE "jobOrderId" = $1 AND "code" = 'KAI-TRUST-VERIFICATION-QR'`,
        [jobOrderId],
      );
      // The distinction must survive the write, not be lost on it.
      expect(rows[0].reviewStatus).toBe("REVIEWED");
    });

    it("removes the assessment with the requirement it assessed", async () => {
      if (!dbAvailable) return;
      const throwaway = `ci-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Temp','Construction','Qatar',$3,NOW(),NOW())`,
        [throwaway, agencyId, userId],
      );
      await insert({ jobOrderId: throwaway, code: "IN-EMIG-RA-NUMBER" });

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwaway]);

      const { rows } = await client.query(
        `SELECT 1 FROM compliance_determinations WHERE "jobOrderId" = $1`,
        [throwaway],
      );
      expect(rows).toHaveLength(0);
    });

    it("leaves the requirement it assessed untouched", async () => {
      if (!dbAvailable) return;
      const { rows } = await client.query(
        `SELECT "title","industry","country" FROM job_orders WHERE "id" = $1`,
        [jobOrderId],
      );
      expect(rows[0]).toEqual({
        title: "Welder — Saudi Arabia",
        industry: "Oil & Gas",
        country: "Saudi Arabia",
      });
    });
  },
);
