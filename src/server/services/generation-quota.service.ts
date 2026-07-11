import { agencyGenerationQuotaRepository } from "@/server/repositories/agency-generation-quota.repository";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("generation-quota");

export class QuotaExceededError extends AppError {
  constructor() {
    super(
      "This agency has used all its free advertisement generations. Contact support to continue.",
      402,
      "QUOTA_EXCEEDED",
    );
  }
}

export class AiKillSwitchError extends AppError {
  constructor() {
    super("AI generation is temporarily disabled. Try again later.", 503, "AI_KILL_SWITCH");
  }
}

/**
 * Bootstrap Trial Quota (Sprint 004): "10 free successful full
 * advertisement generations per approved agency. Quota belongs to the
 * AGENCY. Not to each employee." Every employee of an agency draws from
 * the same counters — enforced simply by keying everything off agencyId,
 * never userId.
 */
export const generationQuotaService = {
  async getStatus(agencyId: string) {
    const quota = await agencyGenerationQuotaRepository.findOrCreate(agencyId);
    return {
      totalQuota: quota.totalQuota,
      used: quota.successfulGenerationsUsed,
      remaining: Math.max(0, quota.totalQuota - quota.successfulGenerationsUsed),
      sectionRegenerationCount: quota.sectionRegenerationCount,
    };
  },

  /**
   * Global AI kill switch + daily budget guard architecture. The budget
   * check is a stub returning true today (no spend-aggregation query is
   * wired up yet — see SPRINT_004_FINAL.md) so the architecture and the
   * kill switch are real and enforced now, without pretending the budget
   * guard does real-time spend math it doesn't do yet.
   */
  async assertGenerationAllowed(agencyId: string): Promise<void> {
    const env = getEnv();
    if (env.AI_KILL_SWITCH) {
      log.warn({ agencyId }, "Generation blocked by AI kill switch");
      throw new AiKillSwitchError();
    }

    const status = await generationQuotaService.getStatus(agencyId);
    if (status.remaining <= 0) {
      throw new QuotaExceededError();
    }
  },

  /** Only a genuinely successful, billable full generation consumes quota — never a failed provider call. */
  async recordSuccessfulGeneration(agencyId: string): Promise<void> {
    await agencyGenerationQuotaRepository.incrementSuccessfulGenerations(agencyId);
  },

  async recordSectionRegeneration(agencyId: string): Promise<void> {
    await agencyGenerationQuotaRepository.incrementSectionRegenerations(agencyId);
  },
};
