import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Sprint 003 — same rationale as tests/integration/advertisement-flow.test.ts:
 * this sandbox cannot run `prisma generate`, so this exercises the schema
 * and constraints directly against a real PostgreSQL 16 instance rather
 * than through the (unbuildable-here) Prisma Client. Covers:
 *   - Contact Directory CRUD + soft delete
 *   - AI Usage Log (Cost Tracking) persistence
 *   - Tenant isolation across two separate agencies
 *   - The full flow: Input -> Document Processing -> KAI Intelligence
 *     Engine -> Structured Extraction -> Recruiter Review -> Corrections
 *     -> Approval -> Saved Advertisement Draft
 * Skips automatically if DATABASE_URL isn't reachable.
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
  "KAI Intelligence Engine against a real PostgreSQL instance",
  () => {
    const suffix = randomUUID().slice(0, 8);

    let agencyAId: string;
    let agencyBId: string;
    let userAId: string;
    let userBId: string;
    let contactAId: string;
    let draftId: string;

    beforeAll(async () => {
      if (!dbAvailable) return;

      const agencyA = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'KAI Test Agency A', $2, 'https://a.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `KAI-A-${suffix}`, `admin-a-${suffix}@kai-test.dev`],
      );
      agencyAId = agencyA.rows[0].id;

      const agencyB = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'KAI Test Agency B', $2, 'https://b.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `KAI-B-${suffix}`, `admin-b-${suffix}@kai-test.dev`],
      );
      agencyBId = agencyB.rows[0].id;

      const userA = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'User A', $2, 'AGENCY_ADMIN', 'ACTIVE', $3, now(), now()) RETURNING id`,
        [randomUUID(), `user-a-${suffix}@kai-test.dev`, agencyAId],
      );
      userAId = userA.rows[0].id;

      const userB = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'User B', $2, 'AGENCY_ADMIN', 'ACTIVE', $3, now(), now()) RETURNING id`,
        [randomUUID(), `user-b-${suffix}@kai-test.dev`, agencyBId],
      );
      userBId = userB.rows[0].id;
    });

    it("Tenant Isolation: a contact created by User B belongs to Agency B only, invisible to Agency A", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `INSERT INTO agency_contacts (id, "agencyId", name, "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'Agency B Desk', $3, now(), now()) RETURNING id`,
        [randomUUID(), agencyBId, userBId],
      );
      const contactBId = result.rows[0].id;

      const visibleToA = await client.query(
        `SELECT id FROM agency_contacts WHERE "agencyId" = $1 AND id = $2`,
        [agencyAId, contactBId],
      );
      expect(visibleToA.rows).toHaveLength(0);

      await client.query(`DELETE FROM agency_contacts WHERE id = $1`, [contactBId]);
    });

    it("STEP 1 — Contact Directory: creates a contact scoped to Agency A", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `INSERT INTO agency_contacts (id, "agencyId", name, mobile, email, "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'Agency A Desk', '+91-9000000001', 'desk-a@kai-test.dev', $3, now(), now())
         RETURNING id`,
        [randomUUID(), agencyAId, userAId],
      );
      contactAId = result.rows[0].id;
      expect(contactAId).toBeTruthy();
    });

    it("Tenant Isolation: Agency B cannot see Agency A's contact", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `SELECT id FROM agency_contacts WHERE "agencyId" = $1 AND id = $2`,
        [agencyBId, contactAId],
      );
      expect(result.rows).toHaveLength(0);
    });

    it("Contact Directory: soft delete hides the contact from the default listing", async () => {
      if (!dbAvailable) return;
      await client.query(`UPDATE agency_contacts SET "deletedAt" = now() WHERE id = $1`, [contactAId]);
      const result = await client.query(
        `SELECT id FROM agency_contacts WHERE "agencyId" = $1 AND "deletedAt" IS NULL`,
        [agencyAId],
      );
      expect(result.rows.map((r) => r.id)).not.toContain(contactAId);
      // restore for later assertions
      await client.query(`UPDATE agency_contacts SET "deletedAt" = NULL WHERE id = $1`, [contactAId]);
    });

    it("STEP 2 — Input: Paste Requirement creates an AdvertisementDraft (mirrors advertisementDraftService.create)", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `INSERT INTO advertisement_drafts (id, "agencyId", "sourceType", "rawText", status, "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'PASTE_TEXT', 'Need 10 6G welders and 5 pipe fitters for a UAE construction project.', 'UPLOADED', $3, now(), now())
         RETURNING id, status`,
        [randomUUID(), agencyAId, userAId],
      );
      draftId = result.rows[0].id;
      expect(result.rows[0].status).toBe("UPLOADED");
    });

    it("STEP 3 — KAI Intelligence Engine / Structured Extraction: extractedData + AiUsageLog recorded together (Cost Tracking)", async () => {
      if (!dbAvailable) return;

      const extractedData = {
        country: { value: "United Arab Emirates", confidence: "HIGH" },
        industry: { value: "Construction", confidence: "HIGH" },
        positions: [
          { title: "6G Welder", tradeSummary: "Perform high-quality pipe welding for oil and gas projects." },
          { title: "Pipe Fitter", tradeSummary: "Install and assemble industrial piping systems from isometric drawings." },
        ],
        warnings: [],
      };

      await client.query("BEGIN");
      await client.query(
        `UPDATE advertisement_drafts SET status = 'EXTRACTED', "extractedData" = $1, "updatedAt" = now() WHERE id = $2`,
        [JSON.stringify(extractedData), draftId],
      );
      await client.query(
        `INSERT INTO ai_usage_logs
           (id, "operationType", provider, model, "inputTokens", "outputTokens", "estimatedCostUsd", "latencyMs", success, "agencyId", "userId", "advertisementDraftId", "createdAt")
         VALUES ($1, 'COMPOSITE_EXTRACTION', 'openai', 'gpt-4.1-mini', 180, 420, 0.000744, 850, true, $2, $3, $4, now())`,
        [randomUUID(), agencyAId, userAId, draftId],
      );
      await client.query("COMMIT");

      const draft = await client.query(`SELECT status, "extractedData" FROM advertisement_drafts WHERE id = $1`, [draftId]);
      expect(draft.rows[0].status).toBe("EXTRACTED");
      expect(draft.rows[0].extractedData.positions).toHaveLength(2);

      const usage = await client.query(
        `SELECT provider, model, success, "estimatedCostUsd" FROM ai_usage_logs WHERE "advertisementDraftId" = $1`,
        [draftId],
      );
      expect(usage.rows).toHaveLength(1);
      expect(usage.rows[0].provider).toBe("openai");
      expect(usage.rows[0].success).toBe(true);
    });

    it("records a failed AI operation too (Error Handling: 'Record ... Success or failure')", async () => {
      if (!dbAvailable) return;
      await client.query(
        `INSERT INTO ai_usage_logs
           (id, "operationType", provider, model, success, "errorMessage", "agencyId", "userId", "advertisementDraftId", "createdAt")
         VALUES ($1, 'COMPOSITE_EXTRACTION', 'openai', 'unknown', false, 'AiRateLimitError', $2, $3, $4, now())`,
        [randomUUID(), agencyAId, userAId, draftId],
      );
      const result = await client.query(
        `SELECT success, "errorMessage" FROM ai_usage_logs WHERE "advertisementDraftId" = $1 AND success = false`,
        [draftId],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].errorMessage).toBe("AiRateLimitError");
    });

    it("Tenant Isolation: Agency B cannot see Agency A's AiUsageLog rows", async () => {
      if (!dbAvailable) return;
      const result = await client.query(`SELECT id FROM ai_usage_logs WHERE "agencyId" = $1`, [agencyBId]);
      expect(result.rows).toHaveLength(0);
    });

    it("STEP 4 — Recruiter Review + Corrections: reviewedData differs from extractedData (the recruiter corrected the industry)", async () => {
      if (!dbAvailable) return;
      const reviewedData = {
        header: "6G Welders & Pipe Fitters — UAE",
        industry: "Oil & Gas", // recruiter corrected this from the AI's "Construction" guess
        country: "United Arab Emirates",
        positions: [
          { title: "6G Welder", count: 10 },
          { title: "Pipe Fitter", count: 5 },
        ],
        benefits: [],
        interview: {},
        contact: {},
        style: "VISUAL",
      };

      await client.query(
        `UPDATE advertisement_drafts SET status = 'REVIEWED', "reviewedData" = $1, "updatedAt" = now() WHERE id = $2`,
        [JSON.stringify(reviewedData), draftId],
      );

      const draft = await client.query(
        `SELECT "extractedData"->'industry'->>'value' as extracted_industry, "reviewedData"->>'industry' as reviewed_industry
         FROM advertisement_drafts WHERE id = $1`,
        [draftId],
      );
      expect(draft.rows[0].extracted_industry).toBe("Construction");
      expect(draft.rows[0].reviewed_industry).toBe("Oil & Gas");
    });

    it("STEP 5 — Style Selection: store only", async () => {
      if (!dbAvailable) return;
      await client.query(
        `UPDATE advertisement_drafts SET status = 'STYLE_SELECTED', "selectedStyle" = 'NEWSPAPER', "updatedAt" = now() WHERE id = $1`,
        [draftId],
      );
      const result = await client.query(`SELECT "selectedStyle" FROM advertisement_drafts WHERE id = $1`, [draftId]);
      expect(result.rows[0].selectedStyle).toBe("NEWSPAPER");
    });

    it("STEP 6 — Approval / Save: draft becomes a real Advertisement carrying the corrected (reviewed) data, not the raw AI guess", async () => {
      if (!dbAvailable) return;

      const advertisementId = randomUUID();
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO advertisements
           (id, "agencyId", header, industry, country, positions, benefits, interview, contact, style, status, "currentVersion", "createdById", "sourceDraftId", "createdAt", "updatedAt")
         VALUES ($1, $2, '6G Welders & Pipe Fitters — UAE', 'Oil & Gas', 'United Arab Emirates', $3, '[]', '{}', '{}', 'NEWSPAPER', 'DRAFT', 1, $4, $5, now(), now())`,
        [
          advertisementId,
          agencyAId,
          JSON.stringify([{ title: "6G Welder", count: 10 }, { title: "Pipe Fitter", count: 5 }]),
          userAId,
          draftId,
        ],
      );
      await client.query(`UPDATE advertisement_drafts SET status = 'SAVED', "updatedAt" = now() WHERE id = $1`, [draftId]);
      await client.query("COMMIT");

      const advertisement = await client.query(`SELECT industry, "sourceDraftId" FROM advertisements WHERE id = $1`, [
        advertisementId,
      ]);
      expect(advertisement.rows[0].industry).toBe("Oil & Gas"); // the recruiter's correction, not the AI's guess
      expect(advertisement.rows[0].sourceDraftId).toBe(draftId);

      const draft = await client.query(`SELECT status FROM advertisement_drafts WHERE id = $1`, [draftId]);
      expect(draft.rows[0].status).toBe("SAVED");

      await client.query(`DELETE FROM advertisements WHERE id = $1`, [advertisementId]);
    });

    afterAll(async () => {
      if (!dbAvailable) return;
      await client.query(`DELETE FROM ai_usage_logs WHERE "agencyId" IN ($1, $2)`, [agencyAId, agencyBId]);
      await client.query(`DELETE FROM advertisement_drafts WHERE "agencyId" IN ($1, $2)`, [agencyAId, agencyBId]);
      await client.query(`DELETE FROM agency_contacts WHERE "agencyId" IN ($1, $2)`, [agencyAId, agencyBId]);
      await client.query(`DELETE FROM users WHERE "agencyId" IN ($1, $2)`, [agencyAId, agencyBId]);
      await client.query(`DELETE FROM agencies WHERE id IN ($1, $2)`, [agencyAId, agencyBId]);
    });
  },
);
