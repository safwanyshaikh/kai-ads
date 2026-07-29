import { db } from "@/lib/db";

/**
 * Closed Beta operations view.
 *
 * Read-only aggregate counts over tables that already exist — no new
 * models, no new writes, no change to how anything is recorded. This is
 * the visibility needed to run twenty agencies through a beta: who is
 * waiting for approval, who is actually generating, and who has consumed
 * their complimentary allocation.
 */
export interface BetaMetrics {
  agencies: {
    total: number;
    pending: number;
    approved: number;
    suspended: number;
    rejected: number;
    /** Approved agencies that have generated at least one advertisement. */
    active: number;
  };
  credits: {
    granted: number;
    used: number;
    remaining: number;
    /** Agencies that have consumed their full complimentary allocation. */
    exhausted: number;
  };
  advertisements: {
    total: number;
    generated: number;
    failed: number;
    averageGenerationMs: number | null;
  };
  mostActive: { agencyName: string; generated: number; remaining: number }[];
}

export const betaMetricsService = {
  async get(): Promise<BetaMetrics> {
    const [byStatus, quotas, adTotal, usage, topAgencies] = await Promise.all([
      db.agency.groupBy({ by: ["status"], _count: { _all: true } }),
      db.agencyGenerationQuota.findMany({
        select: { totalQuota: true, successfulGenerationsUsed: true },
      }),
      db.advertisement.count(),
      // FULL_AD_GENERATION rows only: that is the stage an agency waits on,
      // and `success` is recorded explicitly so failures are counted rather
      // than inferred from a difference between two unrelated totals.
      db.aiUsageLog.groupBy({
        by: ["success"],
        where: { operationType: "FULL_AD_GENERATION" },
        _avg: { latencyMs: true },
        _count: true,
      }),
      db.agencyGenerationQuota.findMany({
        where: { successfulGenerationsUsed: { gt: 0 } },
        orderBy: { successfulGenerationsUsed: "desc" },
        take: 10,
        select: {
          successfulGenerationsUsed: true,
          totalQuota: true,
          agency: { select: { name: true } },
        },
      }),
    ]);

    // AgencyStatus is PENDING | APPROVED | REJECTED | SUSPENDED.
    const count = (status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED") =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    const succeeded = usage.find((row) => row.success);
    const failed = usage.find((row) => !row.success);

    const granted = quotas.reduce((sum, q) => sum + q.totalQuota, 0);
    const used = quotas.reduce((sum, q) => sum + q.successfulGenerationsUsed, 0);

    return {
      agencies: {
        total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        pending: count("PENDING"),
        approved: count("APPROVED"),
        suspended: count("SUSPENDED"),
        rejected: count("REJECTED"),
        active: quotas.filter((q) => q.successfulGenerationsUsed > 0).length,
      },
      credits: {
        granted,
        used,
        remaining: Math.max(0, granted - used),
        exhausted: quotas.filter((q) => q.successfulGenerationsUsed >= q.totalQuota).length,
      },
      advertisements: {
        total: adTotal,
        generated: succeeded?._count ?? 0,
        failed: failed?._count ?? 0,
        averageGenerationMs: succeeded?._avg.latencyMs ?? null,
      },
      mostActive: topAgencies.map((q) => ({
        agencyName: q.agency.name,
        generated: q.successfulGenerationsUsed,
        remaining: Math.max(0, q.totalQuota - q.successfulGenerationsUsed),
      })),
    };
  },
};
