import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Layout Intelligence — persistence, against a real PostgreSQL instance
 * (Task 006).
 *
 * Verifies the guarantees only the table can enforce: that a
 * determination cannot be stored without a reason, that a confident
 * UNKNOWN is unrepresentable, that a requirement cannot hold two
 * publication strategies for one attribute, and that the strategy is
 * removed with the requirement it was built for.
 *
 * Skips automatically when DATABASE_URL isn't reachable.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kai_ads:kai_ads_dev_pw@localhost:5432/kai_ads?schema=public";

let client: Client;
let dbAvailable = false;

const agencyId = `layi-agency-${randomUUID()}`;
const userId = `layi-user-${randomUUID()}`;
let jobOrderId: string;

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM layout_determinations LIMIT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  await client.query(
    `INSERT INTO agencies ("id","name","registrationNumber","website","officialEmail","logoUrl","status","createdAt","updatedAt")
     VALUES ($1,'LayI Agency',$2,'https://example.com',$3,'https://example.com/l.png','APPROVED',NOW(),NOW())`,
    [agencyId, `RA-${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`],
  );
  await client.query(
    `INSERT INTO users ("id","email","name","role","status","agencyId","createdAt","updatedAt")
     VALUES ($1,$2,'LayI Recruiter','AGENCY_ADMIN','ACTIVE',$3,NOW(),NOW())`,
    [userId, `${randomUUID()}@example.com`, agencyId],
  );

  jobOrderId = `layi-jo-${randomUUID()}`;
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
  attribute: string;
  value?: string;
  confidencePct?: number;
  reason?: string | null;
  dependsOn?: string[];
}) {
  return client.query(
    `INSERT INTO layout_determinations
       ("id","jobOrderId","attribute","value","confidencePct","source","reason","dependsOn","engineVersion","computedAt")
     VALUES ($1,$2,$3,$4,$5,'audienceType, campaignDensity',$6,$7::jsonb,'1.0.0',NOW())`,
    [
      `layi-det-${randomUUID()}`,
      params.jobOrderId ?? jobOrderId,
      params.attribute,
      params.value ?? "WhatsApp, Status, Facebook, Newspaper, Print",
      params.confidencePct ?? 90,
      params.reason === undefined
        ? "Audience is Skilled trades workforce at HIGH campaign density."
        : params.reason,
      JSON.stringify(params.dependsOn ?? ["audienceType", "campaignDensity"]),
    ],
  );
}

describe.skipIf(!process.env.DATABASE_URL && !dbAvailable)(
  "Layout Intelligence persistence against a real PostgreSQL instance",
  () => {
    it("attaches a determination with its source, confidence and reason", async () => {
      if (!dbAvailable) return;
      await insert({ attribute: "publicationType" });

      const { rows } = await client.query(
        `SELECT "attribute","value","confidencePct","source","reason","dependsOn","engineVersion"
         FROM layout_determinations WHERE "jobOrderId" = $1 AND "attribute" = 'publicationType'`,
        [jobOrderId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].value).toContain("WhatsApp");
      expect(rows[0].reason.length).toBeGreaterThan(0);
      expect(rows[0].dependsOn).toEqual(["audienceType", "campaignDensity"]);
      expect(rows[0].engineVersion).toBe("1.0.0");
    });

    it("refuses to store a determination with no reason", async () => {
      if (!dbAvailable) return;
      await expect(insert({ attribute: "layoutFamily", reason: null })).rejects.toThrow();
    });

    it("stores UNKNOWN as a row rather than as a missing row", async () => {
      if (!dbAvailable) return;
      await insert({
        attribute: "readingDirection",
        value: "UNKNOWN",
        confidencePct: 0,
        reason: "Language strategy is UNKNOWN in Campaign Intelligence. Reported as UNKNOWN rather than assumed.",
      });

      const { rows } = await client.query(
        `SELECT "value","confidencePct" FROM layout_determinations
         WHERE "jobOrderId" = $1 AND "attribute" = 'readingDirection'`,
        [jobOrderId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("UNKNOWN");
      expect(rows[0].confidencePct).toBe(0);
    });

    it("makes a confident UNKNOWN unrepresentable", async () => {
      if (!dbAvailable) return;
      // A confident UNKNOWN would read as a presentation strategy the
      // engine nearly settled on, when in fact it reached none.
      await expect(
        insert({ attribute: "colourMood", value: "UNKNOWN", confidencePct: 65 }),
      ).rejects.toThrow();
    });

    it.each([-1, 101])("rejects a confidence of %i", async (confidencePct) => {
      if (!dbAvailable) return;
      await expect(insert({ attribute: `range-${confidencePct}`, confidencePct })).rejects.toThrow();
    });

    it("permits only one decision per attribute per requirement", async () => {
      if (!dbAvailable) return;
      await insert({ attribute: "layoutFamily", value: "High Density" });
      await expect(insert({ attribute: "layoutFamily", value: "Corporate Premium" })).rejects.toThrow();
    });

    it("records what a decision depended on, so it is traceable to its cause", async () => {
      if (!dbAvailable) return;
      await insert({ attribute: "heroImageImportance", dependsOn: ["audienceType", "heroImageIntent"] });

      const { rows } = await client.query(
        `SELECT "dependsOn" FROM layout_determinations
         WHERE "jobOrderId" = $1 AND "attribute" = 'heroImageImportance'`,
        [jobOrderId],
      );
      expect(rows[0].dependsOn).toEqual(["audienceType", "heroImageIntent"]);
    });

    it("removes the strategy with the requirement it was built for", async () => {
      if (!dbAvailable) return;
      const throwaway = `layi-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Temp','Construction','Qatar',$3,NOW(),NOW())`,
        [throwaway, agencyId, userId],
      );
      await insert({ jobOrderId: throwaway, attribute: "publicationType" });

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwaway]);

      const { rows } = await client.query(
        `SELECT 1 FROM layout_determinations WHERE "jobOrderId" = $1`,
        [throwaway],
      );
      expect(rows).toHaveLength(0);
    });

    it("leaves upstream Task 001-005 records untouched", async () => {
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

    it("replaces a strategy set wholesale on reassessment", async () => {
      if (!dbAvailable) return;
      const throwaway = `layi-jo-${randomUUID()}`;
      await client.query(
        `INSERT INTO job_orders ("id","agencyId","title","industry","country","createdById","createdAt","updatedAt")
         VALUES ($1,$2,'Reassess','Construction','Oman',$3,NOW(),NOW())`,
        [throwaway, agencyId, userId],
      );
      await insert({ jobOrderId: throwaway, attribute: "mobileOrPrintFirst", value: "Mobile-first" });

      await client.query(`DELETE FROM layout_determinations WHERE "jobOrderId" = $1`, [throwaway]);
      await insert({ jobOrderId: throwaway, attribute: "mobileOrPrintFirst", value: "Print-first" });

      const { rows } = await client.query(
        `SELECT "value" FROM layout_determinations WHERE "jobOrderId" = $1 AND "attribute" = 'mobileOrPrintFirst'`,
        [throwaway],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("Print-first");

      await client.query(`DELETE FROM job_orders WHERE "id" = $1`, [throwaway]);
    });
  },
);
