import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { requirementIntelligenceService } from "@/server/services/requirement-intelligence.service";
import { jobOrderIntelligenceService } from "@/server/services/job-order-intelligence.service";
import { complianceIntelligenceService } from "@/server/services/compliance-intelligence.service";
import { campaignIntelligenceService } from "@/server/services/campaign-intelligence.service";
import { layoutIntelligenceService } from "@/server/services/layout-intelligence.service";
import type { RequirementSourceInput } from "@/server/ai/requirement-source.service";

const log = createLogger("fat-validation");

/**
 * FOUNDER VALIDATION BRIDGE (Task 006.5)
 *
 * NOT a seventh intelligence engine. This module calls the five existing
 * engines (Requirement, JobOrder, Compliance, Campaign, Layout
 * Intelligence) in the order the locked pipeline already runs them, and
 * assembles their output into one JSON snapshot. It contains no new
 * determination logic of its own — every decision, confidence score and
 * reason in the snapshot was produced by Tasks 001-006, unmodified.
 *
 * Its only two responsibilities: (1) give the Founder's Super Admin
 * account a place to run requirements against without first setting up
 * a real agency, and (2) record that a run happened, so `/internal/fat`
 * has a history to show.
 */

const SANDBOX_AGENCY_NAME = "KAI Internal Validation Sandbox";
const SANDBOX_REGISTRATION_NUMBER = "INTERNAL-FAT-SANDBOX";
const SANDBOX_OFFICIAL_EMAIL = "fat-sandbox@internal.kai-ads.invalid";

/**
 * Finds or creates the one sandbox Agency the Founder's runs are stored
 * under. Idempotent — safe to call on every request. Auto-approved so no
 * separate registration/approval flow is needed before the Founder can
 * start testing; it exists purely so JobOrder's existing agencyId
 * foreign key has somewhere real to point, and is clearly labelled
 * wherever an admin screen already lists agencies.
 */
export async function ensureSandboxAgency(): Promise<string> {
  const existing = await db.agency.findFirst({ where: { name: SANDBOX_AGENCY_NAME } });
  if (existing) return existing.id;

  const created = await db.agency.create({
    data: {
      name: SANDBOX_AGENCY_NAME,
      registrationNumber: SANDBOX_REGISTRATION_NUMBER,
      website: "https://internal.invalid",
      officialEmail: SANDBOX_OFFICIAL_EMAIL,
      logoUrl: "https://internal.invalid/logo.png",
      status: "APPROVED",
    },
  });
  log.info({ agencyId: created.id }, "Created FAT sandbox agency");
  return created.id;
}

export interface FatIntakeParams {
  actorId: string;
  inputType: string;
  sources: RequirementSourceInput[];
}

export interface FatSnapshot {
  run: {
    id: string;
    status: string;
    inputType: string;
    createdAt: Date;
  };
  jobOrder: unknown;
  requirementIntelligence: { facts: unknown[] };
  jobOrderIntelligence: { determinations: unknown[] };
  complianceIntelligence: { determinations: unknown[] };
  campaignIntelligence: { determinations: unknown[] };
  layoutIntelligence: { determinations: unknown[] };
  unreadable: unknown[];
  warnings: string[];
}

export const fatValidationService = {
  /**
   * Runs one requirement through the full locked pipeline and records
   * the attempt. Never throws for a business-level failure (unreadable
   * source, insufficient requirement, extraction failure) — those are
   * recorded as a FatRun with the reason, exactly like a successful run,
   * because a failed test is exactly as valuable to the Founder as a
   * passing one.
   */
  async runIntake(params: FatIntakeParams): Promise<FatSnapshot> {
    const agencyId = await ensureSandboxAgency();

    let ingestResult: Awaited<ReturnType<typeof requirementIntelligenceService.ingest>>;
    try {
      ingestResult = await requirementIntelligenceService.ingest({
        agencyId,
        actorId: params.actorId,
        sources: params.sources,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error({ err: error }, "FAT intake threw during ingest");
      const run = await db.fatRun.create({
        data: {
          agencyId,
          inputType: params.inputType,
          status: "ERROR",
          summary: { error: message } as Prisma.InputJsonValue,
          createdById: params.actorId,
        },
      });
      return {
        run: { id: run.id, status: run.status, inputType: run.inputType, createdAt: run.createdAt },
        jobOrder: null,
        requirementIntelligence: { facts: [] },
        jobOrderIntelligence: { determinations: [] },
        complianceIntelligence: { determinations: [] },
        campaignIntelligence: { determinations: [] },
        layoutIntelligence: { determinations: [] },
        unreadable: [],
        warnings: [message],
      };
    }

    if (ingestResult.status !== "CREATED" || !ingestResult.jobOrderId) {
      const run = await db.fatRun.create({
        data: {
          agencyId,
          inputType: params.inputType,
          status: ingestResult.status,
          summary: {
            unreadable: ingestResult.unreadable,
            warnings: ingestResult.warnings,
          } as unknown as Prisma.InputJsonValue,
          createdById: params.actorId,
        },
      });
      return {
        run: { id: run.id, status: run.status, inputType: run.inputType, createdAt: run.createdAt },
        jobOrder: null,
        requirementIntelligence: { facts: ingestResult.facts },
        jobOrderIntelligence: { determinations: [] },
        complianceIntelligence: { determinations: [] },
        campaignIntelligence: { determinations: [] },
        layoutIntelligence: { determinations: [] },
        unreadable: ingestResult.unreadable,
        warnings: ingestResult.warnings,
      };
    }

    const jobOrderId = ingestResult.jobOrderId;

    // The exact locked order: JobOrder -> JobOrder Intelligence ->
    // Compliance -> Campaign -> Layout. Each call is the real, unmodified
    // Task 003-006 service — this bridge adds no decision of its own.
    await jobOrderIntelligenceService.assess(jobOrderId, agencyId);
    await complianceIntelligenceService.assess(jobOrderId, agencyId);
    await campaignIntelligenceService.assess(jobOrderId, agencyId);
    await layoutIntelligenceService.assess(jobOrderId, agencyId);

    const run = await db.fatRun.create({
      data: {
        agencyId,
        jobOrderId,
        inputType: params.inputType,
        status: "CREATED",
        summary: { warnings: ingestResult.warnings } as Prisma.InputJsonValue,
        createdById: params.actorId,
      },
    });

    const snapshot = await fatValidationService.getSnapshot(run.id, agencyId);
    if (!snapshot) throw new Error("FAT run vanished immediately after being created.");
    return snapshot;
  },

  /** Rebuilds the full snapshot for a past run — what "View Result" reads. */
  async getSnapshot(runId: string, agencyId: string): Promise<FatSnapshot | null> {
    const run = await db.fatRun.findFirst({ where: { id: runId, agencyId } });
    if (!run) return null;

    if (!run.jobOrderId) {
      const summary = (run.summary as { unreadable?: unknown[]; warnings?: string[]; error?: string } | null) ?? {};
      return {
        run: { id: run.id, status: run.status, inputType: run.inputType, createdAt: run.createdAt },
        jobOrder: null,
        requirementIntelligence: { facts: [] },
        jobOrderIntelligence: { determinations: [] },
        complianceIntelligence: { determinations: [] },
        campaignIntelligence: { determinations: [] },
        layoutIntelligence: { determinations: [] },
        unreadable: summary.unreadable ?? [],
        warnings: summary.warnings ?? (summary.error ? [summary.error] : []),
      };
    }

    const [jobOrder, facts, jobOrderIntel, compliance, campaign, layout] = await Promise.all([
      db.jobOrder.findFirst({
        where: { id: run.jobOrderId, agencyId },
        include: { employer: true, positions: { orderBy: { sortOrder: "asc" } } },
      }),
      db.requirementFact.findMany({ where: { jobOrderId: run.jobOrderId }, orderBy: { field: "asc" } }),
      jobOrderIntelligenceService.get(run.jobOrderId, agencyId),
      complianceIntelligenceService.get(run.jobOrderId, agencyId),
      campaignIntelligenceService.get(run.jobOrderId, agencyId),
      layoutIntelligenceService.get(run.jobOrderId, agencyId),
    ]);

    const summary = (run.summary as { warnings?: string[] } | null) ?? {};

    return {
      run: { id: run.id, status: run.status, inputType: run.inputType, createdAt: run.createdAt },
      jobOrder,
      requirementIntelligence: { facts: facts },
      jobOrderIntelligence: { determinations: jobOrderIntel },
      complianceIntelligence: { determinations: compliance },
      campaignIntelligence: { determinations: campaign },
      layoutIntelligence: { determinations: layout },
      unreadable: [],
      warnings: summary.warnings ?? [],
    };
  },

  /** Run history for the sandbox agency — "Timestamp, Input type, Status, View Result". */
  async listRuns(limit = 50) {
    const agencyId = await ensureSandboxAgency();
    return db.fatRun.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, inputType: true, status: true, createdAt: true, jobOrderId: true },
    });
  },
};
