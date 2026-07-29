import { db } from "@/lib/db";

/**
 * Weekly and Monthly Intelligence Reports — platform analytics for the
 * Platform Admin.
 *
 * This is not LLM retraining and it changes nothing automatically. It
 * reads tables that already exist and reports what agencies actually did,
 * so product decisions are made from usage rather than from guesses.
 * Every improvement it suggests stays human-approved.
 */
export type ReportPeriod = "weekly" | "monthly";

export interface IntelligenceReport {
  period: ReportPeriod;
  from: Date;
  to: Date;
  adoption: {
    agenciesRegistered: number;
    agenciesApproved: number;
    agenciesGenerating: number;
  };
  generation: {
    attempted: number;
    succeeded: number;
    failed: number;
    successRatePct: number | null;
    averageMs: number | null;
    creditsConsumed: number;
  };
  providers: { provider: string; model: string; runs: number; averageMs: number | null; costUsd: number | null }[];
  demand: { industries: { label: string; count: number }[]; countries: { label: string; count: number }[] };
  reach: { qrScans: number; topPlatforms: { label: string; count: number }[] };
  mostActive: { agencyName: string; generated: number }[];
}

function windowStart(period: ReportPeriod, now: Date): Date {
  const from = new Date(now);
  from.setDate(from.getDate() - (period === "weekly" ? 7 : 30));
  return from;
}

function tally(rows: (string | null)[], limit = 5): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row) continue;
    counts.set(row, (counts.get(row) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export const intelligenceReportService = {
  async generate(period: ReportPeriod, now = new Date()): Promise<IntelligenceReport> {
    const from = windowStart(period, now);
    const range = { gte: from, lte: now };

    const [registered, approved, usage, byProvider, ads, scans, activeQuotas] = await Promise.all([
      db.agency.count({ where: { createdAt: range } }),
      db.agency.count({ where: { status: "APPROVED", updatedAt: range } }),
      db.aiUsageLog.groupBy({
        by: ["success"],
        where: { operationType: "FULL_AD_GENERATION", createdAt: range },
        _count: true,
        _avg: { latencyMs: true },
      }),
      db.aiUsageLog.groupBy({
        by: ["provider", "model"],
        where: { operationType: "FULL_AD_GENERATION", createdAt: range },
        _count: true,
        _avg: { latencyMs: true },
        _sum: { estimatedCostUsd: true },
      }),
      db.advertisement.findMany({
        where: { createdAt: range },
        select: { industry: true, country: true, agencyId: true },
      }),
      db.qrScanEvent.findMany({
        where: { scannedAt: range },
        select: { sourcePlatform: true },
      }),
      db.agencyGenerationQuota.findMany({
        where: { successfulGenerationsUsed: { gt: 0 } },
        orderBy: { successfulGenerationsUsed: "desc" },
        take: 5,
        select: { successfulGenerationsUsed: true, agency: { select: { name: true } } },
      }),
    ]);

    const succeeded = usage.find((r) => r.success);
    const failed = usage.find((r) => !r.success);
    const succeededCount = succeeded?._count ?? 0;
    const failedCount = failed?._count ?? 0;
    const attempted = succeededCount + failedCount;

    return {
      period,
      from,
      to: now,
      adoption: {
        agenciesRegistered: registered,
        agenciesApproved: approved,
        agenciesGenerating: new Set(ads.map((a) => a.agencyId)).size,
      },
      generation: {
        attempted,
        succeeded: succeededCount,
        failed: failedCount,
        successRatePct: attempted > 0 ? Math.round((succeededCount / attempted) * 100) : null,
        averageMs: succeeded?._avg.latencyMs ?? null,
        creditsConsumed: succeededCount,
      },
      providers: byProvider.map((p) => ({
        provider: p.provider,
        model: p.model,
        runs: p._count,
        averageMs: p._avg.latencyMs ?? null,
        costUsd: p._sum.estimatedCostUsd ? Number(p._sum.estimatedCostUsd) : null,
      })),
      demand: {
        industries: tally(ads.map((a) => a.industry)),
        countries: tally(ads.map((a) => a.country)),
      },
      reach: {
        qrScans: scans.length,
        topPlatforms: tally(scans.map((s) => s.sourcePlatform)),
      },
      mostActive: activeQuotas.map((q) => ({
        agencyName: q.agency.name,
        generated: q.successfulGenerationsUsed,
      })),
    };
  },
};
