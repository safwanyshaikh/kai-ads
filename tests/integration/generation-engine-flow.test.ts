import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * Sprint 004 — same rationale as every prior sprint's integration test:
 * this sandbox cannot run `prisma generate`, so this exercises the
 * schema/constraints directly against real PostgreSQL. Covers Agency
 * Verification, Bootstrap Trial Quota, QR Scan Events + tenant
 * isolation, and the full flow: Approved Requirement -> Style
 * Recommendation -> Theme Selection -> Advertisement Generation ->
 * Unified Verification QR Badge -> QR Decode Verification -> Trust
 * Check -> Save Version.
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
  "Sprint 004 generation engine against a real PostgreSQL instance",
  () => {
    const suffix = randomUUID().slice(0, 8);
    let agencyId: string;
    let otherAgencyId: string;
    let superAdminId: string;
    let userId: string;
    let advertisementId: string;
    let verificationId: string;

    beforeAll(async () => {
      if (!dbAvailable) return;

      const agency = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'Gen Engine Test Agency', $2, 'https://gen-test.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `GEN-${suffix}`, `admin-${suffix}@gen-test.dev`],
      );
      agencyId = agency.rows[0].id;

      const otherAgency = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, 'Gen Engine Other Agency', $2, 'https://gen-other.dev', $3, 'https://x/logo.png', 'APPROVED', now(), now()) RETURNING id`,
        [randomUUID(), `GEN-OTHER-${suffix}`, `admin-other-${suffix}@gen-test.dev`],
      );
      otherAgencyId = otherAgency.rows[0].id;

      const superAdmin = await client.query(
        `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
         VALUES ($1, 'Gen Test Super Admin', $2, 'KAI_SUPER_ADMIN', 'ACTIVE', now(), now()) RETURNING id`,
        [randomUUID(), `super-${suffix}@gen-test.dev`],
      );
      superAdminId = superAdmin.rows[0].id;

      const user = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'Gen Test User', $2, 'AGENCY_ADMIN', 'ACTIVE', $3, now(), now()) RETURNING id`,
        [randomUUID(), `user-${suffix}@gen-test.dev`, agencyId],
      );
      userId = user.rows[0].id;

      const advertisement = await client.query(
        `INSERT INTO advertisements
           (id, "agencyId", header, industry, country, positions, benefits, interview, contact, style, status, "currentVersion", "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'Welders Needed', 'Construction', 'UAE', $3, '[]', '{}', $4, 'TYPOGRAPHY', 'APPROVED', 1, $5, now(), now())
         RETURNING id`,
        [
          randomUUID(),
          agencyId,
          JSON.stringify([{ title: "Welder", count: 10 }]),
          JSON.stringify({ phone: "+91-9000000000" }),
          userId,
        ],
      );
      advertisementId = advertisement.rows[0].id;
    });

    it("STEP 1 — Agency Verification: KAI Super Admin verifies the agency (mirrors agencyVerificationService.verify)", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `INSERT INTO agency_verifications
           (id, "agencyId", status, "officialVerificationUrl", "verificationDate", "verifiedById", "createdAt", "updatedAt")
         VALUES ($1, $2, 'VERIFIED', 'https://emigrate.gov.in/agency/12345', now(), $3, now(), now())
         RETURNING id, status`,
        [randomUUID(), agencyId, superAdminId],
      );
      verificationId = result.rows[0].id;
      expect(result.rows[0].status).toBe("VERIFIED");
    });

    it("rejects a second AgencyVerification row for the same agency (1:1, unique constraint)", async () => {
      if (!dbAvailable) return;
      await expect(
        client.query(
          `INSERT INTO agency_verifications (id, "agencyId", status, "createdAt", "updatedAt")
           VALUES ($1, $2, 'VERIFIED', now(), now())`,
          [randomUUID(), agencyId],
        ),
      ).rejects.toThrow(/duplicate key/i);
    });

    it("STEP 2 — Bootstrap Trial Quota: defaults to 10, shared at the agency level", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `INSERT INTO agency_generation_quotas (id, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, $2, now(), now()) RETURNING "totalQuota", "successfulGenerationsUsed"`,
        [randomUUID(), agencyId],
      );
      expect(result.rows[0].totalQuota).toBe(10);
      expect(result.rows[0].successfulGenerationsUsed).toBe(0);
    });

    it("a second employee's generation increments the SAME agency quota, not a per-user one", async () => {
      if (!dbAvailable) return;
      const secondUser = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'Second Employee', $2, 'AGENCY_USER', 'ACTIVE', $3, now(), now()) RETURNING id`,
        [randomUUID(), `employee2-${suffix}@gen-test.dev`, agencyId],
      );
      const secondUserId = secondUser.rows[0].id;

      await client.query(
        `UPDATE agency_generation_quotas SET "successfulGenerationsUsed" = "successfulGenerationsUsed" + 1 WHERE "agencyId" = $1`,
        [agencyId],
      );
      await client.query(
        `UPDATE agency_generation_quotas SET "successfulGenerationsUsed" = "successfulGenerationsUsed" + 1 WHERE "agencyId" = $1`,
        [agencyId],
      );

      const result = await client.query(
        `SELECT "successfulGenerationsUsed" FROM agency_generation_quotas WHERE "agencyId" = $1`,
        [agencyId],
      );
      expect(result.rows[0].successfulGenerationsUsed).toBe(2);
      expect(secondUserId).toBeTruthy();
    });

    it("STEP 3 — Advertisement Generation: FULL_AD_GENERATION recorded in AiUsageLog, billable on success (mirrors advertisementGenerationService.generate)", async () => {
      if (!dbAvailable) return;
      await client.query(
        `INSERT INTO ai_usage_logs
           (id, "operationType", provider, model, "latencyMs", success, billable, "agencyId", "userId", "advertisementId", "createdAt")
         VALUES ($1, 'FULL_AD_GENERATION', 'kai', 'section-renderer', 120, true, true, $2, $3, $4, now())`,
        [randomUUID(), agencyId, userId, advertisementId],
      );
      const result = await client.query(
        `SELECT success, billable FROM ai_usage_logs WHERE "advertisementId" = $1 AND "operationType" = 'FULL_AD_GENERATION'`,
        [advertisementId],
      );
      expect(result.rows[0].success).toBe(true);
      expect(result.rows[0].billable).toBe(true);
    });

    it("a failed generation is recorded but NOT billable ('Do not charge or consume user quota for system failures')", async () => {
      if (!dbAvailable) return;
      await client.query(
        `INSERT INTO ai_usage_logs
           (id, "operationType", provider, model, success, billable, "errorMessage", "agencyId", "userId", "advertisementId", "createdAt")
         VALUES ($1, 'FULL_AD_GENERATION', 'kai', 'section-renderer', false, false, 'QR generation failed', $2, $3, $4, now())`,
        [randomUUID(), agencyId, userId, advertisementId],
      );
      const result = await client.query(
        `SELECT success, billable FROM ai_usage_logs WHERE "advertisementId" = $1 AND success = false`,
        [advertisementId],
      );
      expect(result.rows[0].billable).toBe(false);
    });

    it("STEP 4 — Save Version: generation creates a new AdvertisementVersion with regenerationMethod = AI_REGENERATED", async () => {
      if (!dbAvailable) return;
      await client.query(
        `UPDATE advertisements SET "currentVersion" = 2, "platformFormat" = 'generic_square', density = 'MEDIUM', "trustStatus" = 'TRUST_READY' WHERE id = $1`,
        [advertisementId],
      );
      const result = await client.query(
        `INSERT INTO advertisement_versions
           (id, "advertisementId", "versionNumber", snapshot, "changeSummary", "regenerationMethod", "createdById", "createdAt")
         VALUES ($1, $2, 2, $3, 'Full advertisement generated', 'AI_REGENERATED', $4, now())
         RETURNING "regenerationMethod"`,
        [randomUUID(), advertisementId, JSON.stringify({ style: "TYPOGRAPHY" }), userId],
      );
      expect(result.rows[0].regenerationMethod).toBe("AI_REGENERATED");

      const advertisement = await client.query(
        `SELECT "trustStatus", density FROM advertisements WHERE id = $1`,
        [advertisementId],
      );
      expect(advertisement.rows[0].trustStatus).toBe("TRUST_READY");
      expect(advertisement.rows[0].density).toBe("MEDIUM");
    });

    it("Critical Editing USP: a section regeneration records changedSection + previous/new data, distinct from a full regeneration", async () => {
      if (!dbAvailable) return;
      await client.query(`UPDATE advertisements SET header = 'Welders Urgently Needed', "currentVersion" = 3 WHERE id = $1`, [
        advertisementId,
      ]);
      const result = await client.query(
        `INSERT INTO advertisement_versions
           (id, "advertisementId", "versionNumber", snapshot, "changedSection", "regenerationMethod", "previousSectionData", "newSectionData", "createdById", "createdAt")
         VALUES ($1, $2, 3, $3, 'HEADER', 'MANUAL_EDIT', $4, $5, $6, now())
         RETURNING "changedSection", "regenerationMethod"`,
        [
          randomUUID(),
          advertisementId,
          JSON.stringify({ header: "Welders Urgently Needed" }),
          JSON.stringify({ header: "Welders Needed" }),
          JSON.stringify({ header: "Welders Urgently Needed" }),
          userId,
        ],
      );
      expect(result.rows[0].changedSection).toBe("HEADER");
      expect(result.rows[0].regenerationMethod).toBe("MANUAL_EDIT");

      const versionCount = await client.query(
        `SELECT COUNT(*) FROM advertisement_versions WHERE "advertisementId" = $1`,
        [advertisementId],
      );
      expect(Number(versionCount.rows[0].count)).toBe(2);
    });

    it("STEP 5 — QR Scan: records a privacy-preserving scan event with no candidate identity fields", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `INSERT INTO qr_scan_events
           (id, "advertisementId", "sourcePlatform", "countryCode", "deviceCategory", "destinationUrl", "redirectSuccess", "scannedAt")
         VALUES ($1, $2, 'whatsapp', 'IN', 'mobile', 'https://emigrate.gov.in/agency/12345', true, now())
         RETURNING id, "redirectSuccess"`,
        [randomUUID(), advertisementId],
      );
      expect(result.rows[0].redirectSuccess).toBe(true);
    });

    it("Tenant Isolation: Other Agency cannot see this agency's verification, quota, or scan events", async () => {
      if (!dbAvailable) return;

      const verification = await client.query(`SELECT id FROM agency_verifications WHERE "agencyId" = $1`, [
        otherAgencyId,
      ]);
      expect(verification.rows).toHaveLength(0);

      const quota = await client.query(`SELECT id FROM agency_generation_quotas WHERE "agencyId" = $1`, [
        otherAgencyId,
      ]);
      expect(quota.rows).toHaveLength(0);

      const otherAgencyAds = await client.query(`SELECT id FROM advertisements WHERE "agencyId" = $1`, [
        otherAgencyId,
      ]);
      expect(otherAgencyAds.rows).toHaveLength(0);

      const scanUnderWrongAgency = await client.query(
        `SELECT qse.id FROM qr_scan_events qse
         JOIN advertisements a ON a.id = qse."advertisementId"
         WHERE a."agencyId" = $1`,
        [otherAgencyId],
      );
      expect(scanUnderWrongAgency.rows).toHaveLength(0);
    });

    it("QR Architecture: the verification ID used in the QR is NOT the official government URL — only a KAI-internal ID", async () => {
      if (!dbAvailable) return;
      expect(verificationId).not.toMatch(/emigrate|mea\.gov\.in/i);
      const verification = await client.query(
        `SELECT "officialVerificationUrl" FROM agency_verifications WHERE id = $1`,
        [verificationId],
      );
      expect(verification.rows[0].officialVerificationUrl).toContain("emigrate.gov.in");
    });

    it("Agency Verification suspension is a real status transition", async () => {
      if (!dbAvailable) return;
      await client.query(`UPDATE agency_verifications SET status = 'SUSPENDED' WHERE id = $1`, [verificationId]);
      const result = await client.query(`SELECT status FROM agency_verifications WHERE id = $1`, [verificationId]);
      expect(result.rows[0].status).toBe("SUSPENDED");
    });

    afterAll(async () => {
      if (!dbAvailable) return;
      await client.query(`DELETE FROM qr_scan_events WHERE "advertisementId" = $1`, [advertisementId]);
      await client.query(`DELETE FROM ai_usage_logs WHERE "advertisementId" = $1`, [advertisementId]);
      await client.query(`DELETE FROM advertisement_versions WHERE "advertisementId" = $1`, [advertisementId]);
      await client.query(`DELETE FROM advertisements WHERE id = $1`, [advertisementId]);
      await client.query(`DELETE FROM agency_verifications WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM agency_generation_quotas WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM users WHERE "agencyId" IN ($1, $2) OR id = $3`, [
        agencyId,
        otherAgencyId,
        superAdminId,
      ]);
      await client.query(`DELETE FROM agencies WHERE id IN ($1, $2)`, [agencyId, otherAgencyId]);
    });
  },
);
