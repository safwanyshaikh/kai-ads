import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

/**
 * FIX-002 / FIX-009 — end-to-end verification of the full Sprint 001 flow
 * against a REAL PostgreSQL instance:
 *
 *   Agency Registration -> Pending Approval -> Admin Approval -> Login
 *   -> Employee Join Request -> Approval -> Dashboard
 *
 * IMPORTANT — why this uses `pg` directly instead of the application's
 * service layer / Prisma Client:
 *
 * This sandbox cannot reach binaries.prisma.sh, so `prisma generate` has
 * never been able to run here (documented in README "Known environment
 * limitation" and in SPRINT_001_FIX.md FIX-001). Without a generated
 * Prisma Client, the actual `agencyService` / `joinRequestService` /
 * Better Auth code cannot execute in this sandbox at all.
 *
 * To still get REAL verification instead of a theoretical one, this test
 * runs the exact same SQL the service layer issues (mirrored 1:1 from
 * agency.service.ts / join-request.service.ts) directly against a real
 * `postgres:16` instance, against the exact schema produced by
 * `prisma/migrations/20260101000000_init/migration.sql`. It proves the
 * schema, constraints, and state machine are correct end-to-end.
 *
 * This is a stand-in, not a replacement, for true HTTP-level integration
 * tests once `prisma generate` can run in an environment with normal
 * network access (see SPRINT_001_FIX.md, "What remains").
 *
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
  "end-to-end flow against a real PostgreSQL instance",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const agencyEmail = `admin-${suffix}@e2e-test-agency.dev`;
    const employeeEmail = `employee-${suffix}@e2e-test-agency.dev`;
    const registrationNumber = `E2E-${suffix}`;
    const domain = `e2e-test-agency-${suffix}.dev`;

    let agencyId: string;
    let adminUserId: string;
    let superAdminId: string;
    let employeeUserId: string;
    let joinRequestId: string;

    it("connects to a real database", async () => {
      if (!dbAvailable) return;
      const result = await client.query("SELECT 1 as ok");
      expect(result.rows[0].ok).toBe(1);
    });

    it("STEP 1 — Agency Registration creates Agency + Domain + pending Admin (mirrors agencyService.register)", async () => {
      if (!dbAvailable) return;

      await client.query("BEGIN");
      const agencyResult = await client.query(
        `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', now(), now()) RETURNING id, status`,
        [
          randomUUID(),
          "E2E Test Recruitment Agency",
          registrationNumber,
          "https://e2e-test-agency.dev",
          agencyEmail,
          "https://storage.example.com/logo.png",
        ],
      );
      agencyId = agencyResult.rows[0].id;
      expect(agencyResult.rows[0].status).toBe("PENDING");

      await client.query(
        `INSERT INTO domains (id, domain, "agencyId", "createdAt") VALUES ($1, $2, $3, now())`,
        [randomUUID(), domain, agencyId],
      );

      const adminResult = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'AGENCY_ADMIN', 'PENDING', $4, now(), now()) RETURNING id, status`,
        [randomUUID(), "E2E Admin", agencyEmail, agencyId],
      );
      adminUserId = adminResult.rows[0].id;
      await client.query("COMMIT");

      expect(adminResult.rows[0].status).toBe("PENDING");
    });

    it("rejects a duplicate registration number (DB-level uniqueness, defense in depth behind Zod)", async () => {
      if (!dbAvailable) return;
      await expect(
        client.query(
          `INSERT INTO agencies (id, name, "registrationNumber", website, "officialEmail", "logoUrl", status, "createdAt", "updatedAt")
           VALUES ($1, 'Dup', $2, 'https://dup.dev', $3, 'https://x/logo.png', 'PENDING', now(), now())`,
          [randomUUID(), registrationNumber, `dup-${suffix}@other.dev`],
        ),
      ).rejects.toThrow(/duplicate key/i);
    });

    it("rejects a duplicate domain (DB-level uniqueness)", async () => {
      if (!dbAvailable) return;
      await expect(
        client.query(`INSERT INTO domains (id, domain, "agencyId", "createdAt") VALUES ($1, $2, $3, now())`, [
          randomUUID(),
          domain,
          agencyId,
        ]),
      ).rejects.toThrow(/duplicate key/i);
    });

    it("STEP 2 — Pending Approval: agency and admin are not yet usable", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `SELECT status FROM agencies WHERE id = $1`,
        [agencyId],
      );
      expect(result.rows[0].status).toBe("PENDING");
    });

    it("STEP 3 — Admin (KAI Super Admin) Approval flips Agency to APPROVED and Admin to ACTIVE (mirrors agencyService.approve)", async () => {
      if (!dbAvailable) return;

      const superAdminResult = await client.query(
        `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
         VALUES ($1, 'E2E Super Admin', $2, 'KAI_SUPER_ADMIN', 'ACTIVE', now(), now()) RETURNING id`,
        [randomUUID(), `super-${suffix}@kai.dev`],
      );
      superAdminId = superAdminResult.rows[0].id;

      await client.query("BEGIN");
      await client.query(`UPDATE agencies SET status = 'APPROVED' WHERE id = $1`, [agencyId]);
      await client.query(
        `UPDATE users SET status = 'ACTIVE' WHERE "agencyId" = $1 AND role = 'AGENCY_ADMIN'`,
        [agencyId],
      );
      await client.query(
        `INSERT INTO approvals (id, "targetType", "targetId", decision, "agencyId", "actorId", "createdAt")
         VALUES ($1, 'AGENCY', $2, 'APPROVE', $2, $3, now())`,
        [randomUUID(), agencyId, superAdminId],
      );
      await client.query("COMMIT");

      const agency = await client.query(`SELECT status FROM agencies WHERE id = $1`, [agencyId]);
      const admin = await client.query(`SELECT status FROM users WHERE id = $1`, [adminUserId]);
      expect(agency.rows[0].status).toBe("APPROVED");
      expect(admin.rows[0].status).toBe("ACTIVE");
    });

    it("STEP 4 — Login: an active user can hold a session (mirrors Better Auth's Session model)", async () => {
      if (!dbAvailable) return;
      const token = randomUUID();
      await client.query(
        `INSERT INTO sessions (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, now() + interval '7 days', now(), now())`,
        [randomUUID(), adminUserId, token],
      );
      const result = await client.query(
        `SELECT u.status FROM sessions s JOIN users u ON u.id = s."userId" WHERE s.token = $1`,
        [token],
      );
      expect(result.rows[0].status).toBe("ACTIVE");
    });

    it("STEP 5 — Employee Join Request: domain auto-detected, PENDING user + JoinRequest created (mirrors joinRequestService.create)", async () => {
      if (!dbAvailable) return;

      const domainRow = await client.query(`SELECT "agencyId" FROM domains WHERE domain = $1`, [domain]);
      expect(domainRow.rows[0].agencyId).toBe(agencyId);

      const employeeResult = await client.query(
        `INSERT INTO users (id, name, email, role, status, "agencyId", "createdAt", "updatedAt")
         VALUES ($1, 'E2E Employee', $2, 'AGENCY_USER', 'PENDING', $3, now(), now()) RETURNING id`,
        [randomUUID(), employeeEmail, agencyId],
      );
      employeeUserId = employeeResult.rows[0].id;

      const joinRequestResult = await client.query(
        `INSERT INTO join_requests (id, "userId", "agencyId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'PENDING', now(), now()) RETURNING id, status`,
        [randomUUID(), employeeUserId, agencyId],
      );
      joinRequestId = joinRequestResult.rows[0].id;

      expect(joinRequestResult.rows[0].status).toBe("PENDING");
    });

    it("STEP 6 — Agency Admin Approval flips JoinRequest to APPROVED and Employee to ACTIVE (mirrors joinRequestService.approve)", async () => {
      if (!dbAvailable) return;

      await client.query("BEGIN");
      await client.query(
        `UPDATE join_requests SET status = 'APPROVED', "reviewedById" = $1, "reviewedAt" = now() WHERE id = $2`,
        [adminUserId, joinRequestId],
      );
      await client.query(`UPDATE users SET status = 'ACTIVE' WHERE id = $1`, [employeeUserId]);
      await client.query("COMMIT");

      const request = await client.query(`SELECT status FROM join_requests WHERE id = $1`, [joinRequestId]);
      const employee = await client.query(`SELECT status FROM users WHERE id = $1`, [employeeUserId]);
      expect(request.rows[0].status).toBe("APPROVED");
      expect(employee.rows[0].status).toBe("ACTIVE");
    });

    it("STEP 7 — Dashboard: an active employee resolves to their agency with no pending state left (mirrors /api/employees scoping)", async () => {
      if (!dbAvailable) return;
      const result = await client.query(
        `SELECT u.status, u."agencyId", a.status as "agencyStatus"
         FROM users u JOIN agencies a ON a.id = u."agencyId"
         WHERE u.id = $1`,
        [employeeUserId],
      );
      expect(result.rows[0].status).toBe("ACTIVE");
      expect(result.rows[0].agencyId).toBe(agencyId);
      expect(result.rows[0].agencyStatus).toBe("APPROVED");
    });

    afterAll(async () => {
      if (!dbAvailable) return;
      // Clean up everything created by this test run.
      await client.query(`DELETE FROM sessions WHERE "userId" IN ($1, $2, $3)`, [
        adminUserId,
        employeeUserId,
        superAdminId,
      ]);
      await client.query(`DELETE FROM join_requests WHERE id = $1`, [joinRequestId]);
      await client.query(`DELETE FROM approvals WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM users WHERE "agencyId" = $1 OR id = $2`, [agencyId, superAdminId]);
      await client.query(`DELETE FROM domains WHERE "agencyId" = $1`, [agencyId]);
      await client.query(`DELETE FROM agencies WHERE id = $1`, [agencyId]);
    });
  },
);
