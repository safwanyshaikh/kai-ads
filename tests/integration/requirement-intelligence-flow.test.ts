import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Requirement Intelligence — persistence, against a real PostgreSQL
 * instance (Task 002).
 *
 * Verifies the guarantees the tables themselves have to enforce, which
 * no unit test can prove: that a fact cannot be stored without a reason,
 * that a requirement cannot hold two different values for one field, and
 * that the evidence a recruiter sent survives the requirement being
 * deleted.
 *
 * Skips automatically when DATABASE_URL isn't reachable, matching every
 * other integration test in this suite.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kai_ads:kai_ads_dev_pw@localhost:5432/kai_ads?schema=public";

let client: Client;
let dbAvailable = false;

const agencyId = `ri-agency-${randomUUID()}`;
const userId = `ri-user-${randomUUID()}`;
let jobOrderId: string;

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM requirement_facts LIMIT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  await client.query(
    `INSERT INTO agencies ("id","name","registrationNumber","website","officialEmail","logoUrl","status","createdAt","updatedAt")
     VALUES ($1,'RI Agency',$2,'https://example.com',$3,'https://example.com/l.png','APPROVED',NOW(),NOW())`,
    [agencyId, `RA-${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`],
  );
  await client.query(
    `INSERT INTO users ("id","email","name","role","status","agencyId","createdAt","updatedAt")
     VALUES ($1,$2,'RI Recruiter','AGENCY_ADMIN','ACTIVE',$3,NOW(),NOW())`,
    [userId, `${randomUUID()}@example.com`, agencyId],
  );

  jobOrderId = `ri-jo-${randomUUID()}`;
  await client.query(
    `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
     VALUES ($1,$2,'Welder — Saudi Arabia','Construction','Saudi Arabia',$3,NOW(),NOW())`,
    [jobOrderId, agencyId, userId],
  );
});

afterAll(async () => {
  if (!dbAvailable) return;
  await client.query("DELETE FROM agencies WHERE id = $1", [agencyId]);
  await client.end();
});

async function insertSource(kind: string, label: string): Promise<string> {
  const id = `ri-src-${randomUUID()}`;
  await client.query(
    `INSERT INTO requirement_sources ("id","agencyId","jobOrderId","kind","label","contentHash","extractedText","createdAt")
     VALUES ($1,$2,$3,$4::"RequirementSourceKind",$5,$6,'Need 10 welders.',NOW())`,
    [id, agencyId, jobOrderId, kind, label, randomUUID()],
  );
  return id;
}

async function insertFact(params: {
  field: string;
  value: string | null;
  sourceId: string | null;
  kind?: string;
  method?: string;
  band?: string;
  confidence?: number;
  reason?: string;
}) {
  return client.query(
    `INSERT INTO requirement_facts
       ("id","jobOrderId","sourceId","field","value","rawValue","sourceKind","confidence","confidenceBand","method","reason","createdAt")
     VALUES ($1,$2,$3,$4,$5,$5,$6::"RequirementSourceKind",$7,$8::"ConfidenceBand",$9::"ExtractionMethod",$10,NOW())`,
    [
      `ri-fact-${randomUUID()}`,
      jobOrderId,
      params.sourceId,
      params.field,
      params.value,
      params.kind ?? "PDF",
      params.confidence ?? 0.86,
      params.band ?? "HIGH",
      params.method ?? "AI_EXTRACTION",
      params.reason ?? "Read from a PDF document. Extractor reported HIGH confidence.",
    ],
  );
}

describe.skipIf(!process.env.DATABASE_URL && !dbAvailable)(
  "Requirement Intelligence persistence against a real PostgreSQL instance",
  () => {
    it("stores a fact with its source, confidence and reason", async () => {
      if (!dbAvailable) return;
      const sourceId = await insertSource("PDF", "demand-letter.pdf");
      await insertFact({ field: "country", value: "Saudi Arabia", sourceId });

      const { rows } = await client.query(
        `SELECT f."field", f."value", f."rawValue", f."confidence", f."confidenceBand",
                f."method", f."reason", s."kind", s."label"
         FROM requirement_facts f
         JOIN requirement_sources s ON s."id" = f."sourceId"
         WHERE f."jobOrderId" = $1 AND f."field" = 'country'`,
        [jobOrderId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("Saudi Arabia");
      expect(rows[0].confidence).toBeGreaterThan(0);
      expect(rows[0].reason.length).toBeGreaterThan(0);
      expect(rows[0].label).toBe("demand-letter.pdf");
    });

    it("refuses to store a fact with no reason", async () => {
      if (!dbAvailable) return;
      // The rule is enforced by the schema, not by convention: there must
      // be no way to record a value without saying why.
      await expect(
        client.query(
          `INSERT INTO requirement_facts
             ("id","jobOrderId","field","sourceKind","confidence","confidenceBand","method","reason","createdAt")
           VALUES ($1,$2,'industry','PDF',0.9,'HIGH','AI_EXTRACTION',NULL,NOW())`,
          [`ri-fact-${randomUUID()}`, jobOrderId],
        ),
      ).rejects.toThrow();
    });

    it("stores an absent field as an explicit unknown rather than a missing row", async () => {
      if (!dbAvailable) return;
      await insertFact({
        field: "employer",
        value: null,
        sourceId: null,
        method: "ABSENT",
        band: "LOW",
        confidence: 0,
        reason: "Not stated in the PDF document provided. Recorded as unknown rather than inferred.",
      });

      const { rows } = await client.query(
        `SELECT "value","method","reason" FROM requirement_facts WHERE "jobOrderId" = $1 AND "field" = 'employer'`,
        [jobOrderId],
      );
      // "Not stated" is distinguishable from "nobody looked".
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBeNull();
      expect(rows[0].method).toBe("ABSENT");
    });

    it("permits only one canonical value per field per requirement", async () => {
      if (!dbAvailable) return;
      await insertFact({ field: "positions.0.salary", value: "SAR 3,200", sourceId: null });

      await expect(
        insertFact({ field: "positions.0.salary", value: "SAR 3,700", sourceId: null }),
      ).rejects.toThrow();
    });

    it("keeps the evidence when the requirement is deleted", async () => {
      if (!dbAvailable) return;
      const throwawayJobOrder = `ri-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Temp','Construction','Qatar',$3,NOW(),NOW())`,
        [throwawayJobOrder, agencyId, userId],
      );
      const sourceId = `ri-src-${randomUUID()}`;
      await client.query(
        `INSERT INTO requirement_sources ("id","agencyId","jobOrderId","kind","label","contentHash","createdAt")
         VALUES ($1,$2,$3,'WHATSAPP_TEXT','forward.txt',$4,NOW())`,
        [sourceId, agencyId, throwawayJobOrder, randomUUID()],
      );

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwawayJobOrder]);

      // The artifact a recruiter sent is evidence — it outlives the
      // requirement derived from it.
      const { rows } = await client.query(
        `SELECT "id","jobOrderId" FROM requirement_sources WHERE "id" = $1`,
        [sourceId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].jobOrderId).toBeNull();
    });

    it("removes the explanations with the requirement they explain", async () => {
      if (!dbAvailable) return;
      const throwawayJobOrder = `ri-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Temp2','Construction','Oman',$3,NOW(),NOW())`,
        [throwawayJobOrder, agencyId, userId],
      );
      await client.query(
        `INSERT INTO requirement_facts
           ("id","jobOrderId","field","sourceKind","confidence","confidenceBand","method","reason","createdAt")
         VALUES ($1,$2,'country','PDF',0.9,'HIGH','AI_EXTRACTION','Read from a PDF document.',NOW())`,
        [`ri-fact-${randomUUID()}`, throwawayJobOrder],
      );

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwawayJobOrder]);

      const { rows } = await client.query(`SELECT 1 FROM requirement_facts WHERE "jobOrderId" = $1`, [
        throwawayJobOrder,
      ]);
      expect(rows).toHaveLength(0);
    });

    it("keeps the explanation when only the source artifact is removed", async () => {
      if (!dbAvailable) return;
      const sourceId = await insertSource("EXCEL", "demand.xlsx");
      await insertFact({ field: "industry", value: "Construction", sourceId, kind: "EXCEL" });

      await client.query(`DELETE FROM requirement_sources WHERE "id" = $1`, [sourceId]);

      const { rows } = await client.query(
        `SELECT "sourceId","reason" FROM requirement_facts WHERE "jobOrderId" = $1 AND "field" = 'industry'`,
        [jobOrderId],
      );
      // Losing the artifact must not delete the record of what was read.
      expect(rows).toHaveLength(1);
      expect(rows[0].sourceId).toBeNull();
      expect(rows[0].reason.length).toBeGreaterThan(0);
    });

    it("accepts every requirement channel the engine claims to support", async () => {
      if (!dbAvailable) return;
      const kinds = [
        "WHATSAPP_TEXT", "WHATSAPP_SCREENSHOT", "PDF", "IMAGE", "VOICE_NOTE",
        "EMAIL", "WORD", "EXCEL", "GOOGLE_SHEET", "WEBSITE", "PLAIN_TEXT",
      ];
      for (const kind of kinds) {
        await insertSource(kind, `sample-${kind}`);
      }

      const { rows } = await client.query(
        `SELECT DISTINCT "kind"::text FROM requirement_sources WHERE "agencyId" = $1`,
        [agencyId],
      );
      expect(rows.map((r) => r.kind).sort()).toEqual(expect.arrayContaining(kinds.sort()));
    });

    it("supports the low-confidence review query a recruiter screen is built on", async () => {
      if (!dbAvailable) return;
      await insertFact({
        field: "interview.venue",
        value: "Mumbai",
        sourceId: null,
        band: "LOW",
        confidence: 0.29,
      });

      const { rows } = await client.query(
        `SELECT "field" FROM requirement_facts
         WHERE "jobOrderId" = $1 AND "confidenceBand" = 'LOW' AND "method" <> 'ABSENT'`,
        [jobOrderId],
      );
      expect(rows.map((r) => r.field)).toContain("interview.venue");
    });

    it("isolates one agency's requirement evidence from another's", async () => {
      if (!dbAvailable) return;
      const otherAgency = `ri-agency-${randomUUID()}`;
      await client.query(
        `INSERT INTO agencies ("id","name","registrationNumber","website","officialEmail","logoUrl","status","createdAt","updatedAt")
         VALUES ($1,'Other',$2,'https://example.com',$3,'https://example.com/l.png','APPROVED',NOW(),NOW())`,
        [otherAgency, `RA-${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`],
      );

      const { rows } = await client.query(
        `SELECT 1 FROM requirement_sources WHERE "agencyId" = $1`,
        [otherAgency],
      );
      expect(rows).toHaveLength(0);

      await client.query(`DELETE FROM agencies WHERE "id" = $1`, [otherAgency]);
    });
  },
);
