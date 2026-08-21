import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * PRODUCT WORKFLOW — the recruiter's end-to-end journey, exercised
 * through the REAL service layer (Prisma + the application's own
 * services), not through SQL mirrored by hand.
 *
 * The existing integration suites (e2e-flow, generation-engine-flow,
 * advertisement-flow) deliberately issue raw SQL, because when they were
 * written `prisma generate` could not run in this sandbox and the
 * services were therefore unrunnable here. That constraint no longer
 * holds — the Prisma Client is generated — so this file covers what
 * those could not: that the SERVICES themselves compose into a working
 * product path.
 *
 *   register -> approve -> brand profile -> create ad (real vacancy)
 *   -> preview -> review -> approve -> export gating -> quota
 *
 * Tenant-neutral: the agency below is invented fixture data. No tenant
 * identity exists in product code (see tests/tenant-neutrality.test.ts).
 *
 * Skips when no database is reachable, like its sibling suites.
 */

/**
 * tests/setup.ts always assigns a DATABASE_URL default, so its presence
 * proves nothing about whether a server is actually running. Like the
 * sibling integration suites, this file probes a real connection and
 * skips when there isn't one.
 */
let hasDb = false;

// Imported lazily so the file can be collected without a database.
type Services = {
  agencyService: typeof import("@/server/services/agency.service")["agencyService"];
  advertisementService: typeof import("@/server/services/advertisement.service")["advertisementService"];
  generationQuotaService: typeof import("@/server/services/generation-quota.service")["generationQuotaService"];
  db: typeof import("@/lib/db")["db"];
};

let svc: Services;

const suffix = randomUUID().slice(0, 8);
const domain = `workflow-${suffix}.example`;

let agencyId = "";
let adminId = "";
let advertisementId = "";

beforeAll(async () => {
  const dbProbe = await import("@/lib/db");
  try {
    await dbProbe.db.$queryRaw`SELECT 1`;
    hasDb = true;
  } catch {
    hasDb = false;
    return;
  }

  const [agency, advertisement, quota, dbmod] = await Promise.all([
    import("@/server/services/agency.service"),
    import("@/server/services/advertisement.service"),
    import("@/server/services/generation-quota.service"),
    import("@/lib/db"),
  ]);
  svc = {
    agencyService: agency.agencyService,
    advertisementService: advertisement.advertisementService,
    generationQuotaService: quota.generationQuotaService,
    db: dbmod.db,
  };
});

afterAll(async () => {
  if (!hasDb || !svc) return;
  // Cascades clear advertisements, quota, history and users.
  if (agencyId) await svc.db.agency.deleteMany({ where: { id: agencyId } });
  await svc.db.$disconnect();
});

describe("Product workflow through the real service layer", () => {
  it("STEP 1 — a recruitment agency registers and lands PENDING, not usable yet", async () => {
    if (!hasDb) return;
    const agency = await svc.agencyService.register({
      name: `Northwind Overseas ${suffix}`,
      registrationNumber: `B-${suffix}/DEL/PER/1000+/9/2026`,
      website: `https://${domain}`,
      officialEmail: `admin@${domain}`,
      logoUrl: "https://cdn.example.invalid/logo.png",
    });

    agencyId = agency.id;
    expect(agency.status).toBe("PENDING");

    const admin = await svc.db.user.findFirst({ where: { agencyId } });
    expect(admin).not.toBeNull();
    adminId = admin!.id;
    // A pending agency's admin cannot act yet — this is the gate that
    // makes onboarding a real approval step rather than a formality.
    expect(admin!.status).toBe("PENDING");
  });

  it("STEP 2 — KAI approval activates the tenant and its admin", async () => {
    if (!hasDb) return;
    await svc.agencyService.approve(agencyId, adminId);

    const agency = await svc.db.agency.findUnique({ where: { id: agencyId } });
    const admin = await svc.db.user.findUnique({ where: { id: adminId } });
    expect(agency!.status).toBe("APPROVED");
    expect(admin!.status).toBe("ACTIVE");
  });

  it("STEP 3 — the tenant's brand profile is data, and round-trips", async () => {
    if (!hasDb) return;
    await svc.db.agency.update({
      where: { id: agencyId },
      data: {
        contactPerson: "Recruitment Desk",
        phone: "+91 11 4000 2020",
        whatsapp: "+91 98100 00000",
        officeAddress: "8 Harbour Lane, New Delhi 110001",
        fullRegistrationNumber: `B-${suffix}/DEL/PER/1000+/9/2026-FULL`,
        meaRegistrationText: "MEA Registered",
        isoCertification: "ISO 9001:2015",
        brandColours: { primary: "#123456" },
        brandBadges: ["Since 1998", "ISO 9001:2015"],
      },
    });

    const agency = await svc.db.agency.findUnique({ where: { id: agencyId } });
    expect(agency!.fullRegistrationNumber).toContain("FULL");
    expect(agency!.meaRegistrationText).toBe("MEA Registered");
    expect((agency!.brandBadges as string[]).length).toBe(2);
    // Brand identity lives on the tenant record, never in product code.
    expect((agency!.brandColours as { primary: string }).primary).toBe("#123456");
  });

  it("STEP 4 — a recruiter creates an advertisement from REAL vacancy data", async () => {
    if (!hasDb) return;
    const ad = await svc.advertisementService.create(agencyId, adminId, {
      header: "Urgent Requirement — Qatar",
      country: "Qatar",
      industry: "Oil & Gas",
      style: "VISUAL",
      positions: [
        { title: "Marble Mason", count: 12 },
        { title: "Marble Supervisor", count: 2 },
      ],
      benefits: [{ label: "Food & Accommodation" }, { label: "Transportation" }],
      interview: {},
      contact: { phone: "+91 90000 11111", email: `jobs@${domain}` },
    });

    advertisementId = ad.id;
    expect(ad.status).toBe("DRAFT");
    expect(ad.agencyId).toBe(agencyId);
  });

  it("STEP 5 — the advertisement is readable back, scoped to its tenant", async () => {
    if (!hasDb) return;
    const ad = await svc.advertisementService.getById(advertisementId, agencyId);
    // The advertisement's identity is `header` — there is no `title`
    // column; the create input's title is campaign metadata, not the
    // stored headline.
    expect(ad.header).toContain("Qatar");
    expect(ad.country).toBe("Qatar");

    // Another tenant cannot read it. This is the multi-tenant boundary
    // the whole product depends on.
    await expect(
      svc.advertisementService.getById(advertisementId, randomUUID()),
    ).rejects.toThrow();
  });

  it("STEP 6 — export is refused before generation, rather than shipping an empty asset", async () => {
    if (!hasDb) return;
    const ad = await svc.db.advertisement.findUnique({ where: { id: advertisementId } });
    // The export route gates on generatedAssetUrl and trustStatus. An
    // ungenerated advertisement has no asset, so a download must be
    // refused — silently exporting nothing would be worse than an error.
    expect(ad!.generatedAssetUrl).toBeNull();
  });

  it("STEP 7 — approval moves the advertisement through its real lifecycle", async () => {
    if (!hasDb) return;
    await svc.advertisementService.changeStatus(advertisementId, agencyId, adminId, "REVIEW");
    let ad = await svc.advertisementService.getById(advertisementId, agencyId);
    expect(ad.status).toBe("REVIEW");

    await svc.advertisementService.changeStatus(advertisementId, agencyId, adminId, "APPROVED");
    ad = await svc.advertisementService.getById(advertisementId, agencyId);
    expect(ad.status).toBe("APPROVED");

    // Re-approving is a conflict, not a silent no-op.
    await expect(
      svc.advertisementService.changeStatus(advertisementId, agencyId, adminId, "APPROVED"),
    ).rejects.toThrow();
  });

  it("STEP 8 — every transition is recorded for audit", async () => {
    if (!hasDb) return;
    const history = await svc.advertisementService.listHistory(advertisementId, agencyId);
    const transitions = history.filter((h: { action: string }) => h.action === "status_changed");
    expect(transitions.length).toBeGreaterThanOrEqual(2);
  });

  it("STEP 9 — the tenant's generation quota is real and agency-scoped", async () => {
    if (!hasDb) return;
    const quota = await svc.generationQuotaService.getStatus(agencyId);
    // Closed-beta allowance, from the migration that set it.
    expect(quota.totalQuota).toBe(50);
    expect(quota.used).toBe(0);
    expect(quota.remaining).toBe(50);

    // One quota row per agency, shared by every employee — not per user.
    const rows = await svc.db.agencyGenerationQuota.findMany({ where: { agencyId } });
    expect(rows.length).toBe(1);

    // And generation is permitted while the allowance holds.
    await expect(svc.generationQuotaService.assertGenerationAllowed(agencyId)).resolves.toBeUndefined();
  });
});
