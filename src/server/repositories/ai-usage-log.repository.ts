import { db } from "@/lib/db";
import type { AiUsageLog, Prisma } from "@prisma/client";

export const aiUsageLogRepository = {
  record(data: Prisma.AiUsageLogCreateInput): Promise<AiUsageLog> {
    return db.aiUsageLog.create({ data });
  },

  /** Ready for the future credit-calculation system the brief requires architecture support for — not wired to any UI yet. */
  aggregateCostByAgency(agencyId: string): Promise<{
    _sum: { estimatedCostUsd: Prisma.Decimal | null; inputTokens: number | null; outputTokens: number | null };
  }> {
    return db.aiUsageLog.aggregate({
      where: { agencyId },
      _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
    });
  },
};
