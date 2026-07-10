import { aiUsageLogRepository } from "@/server/repositories/ai-usage-log.repository";
import { estimateCostUsd } from "@/server/services/cost-estimation";
import { createLogger } from "@/lib/logger";
import type { AiOperationType } from "@prisma/client";

const log = createLogger("cost-tracking");

export const costTrackingService = {
  /**
   * Records one AI operation. Never throws — a failure to log cost must
   * never break the extraction the recruiter is waiting on.
   */
  async record(entry: {
    operationType: AiOperationType;
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number | null;
    success: boolean;
    errorMessage?: string;
    agencyId?: string | null;
    userId?: string | null;
    advertisementDraftId?: string | null;
  }): Promise<void> {
    try {
      const estimatedCostUsd = estimateCostUsd(entry.model, entry.inputTokens, entry.outputTokens);

      await aiUsageLogRepository.record({
        operationType: entry.operationType,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        estimatedCostUsd,
        latencyMs: entry.latencyMs,
        success: entry.success,
        errorMessage: entry.errorMessage,
        agency: entry.agencyId ? { connect: { id: entry.agencyId } } : undefined,
        user: entry.userId ? { connect: { id: entry.userId } } : undefined,
        advertisementDraftId: entry.advertisementDraftId,
      });
    } catch (error) {
      log.error({ err: error, entry }, "Failed to record AI usage log");
    }
  },
};
