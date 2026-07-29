import { agencyGenerationQuotaRepository } from "@/server/repositories/agency-generation-quota.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("generation-quota");

/**
 * Closed Beta completion, not a billing failure.
 *
 * The agency keeps its account, its advertisements and its logins — only
 * further generation pauses. The wording is deliberately a thank-you
 * rather than a wall: these are the first twenty agencies helping us
 * find production issues, and "contact support to continue" read like a
 * paywall for something we are not charging for.
 */
export class QuotaExceededError extends AppError {
  constructor() {
    super(
      "You've successfully completed your complimentary beta allocation. " +
        "Thank you for helping improve KAI Ads. " +
        "Our team will contact you regarding the next phase.",
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
 * Closed Beta allocation: 50 complimentary successful full advertisement
 * generations per approved agency. The quota belongs to the AGENCY, not to
 * each employee — every employee draws from the same counters, enforced by
 * keying everything off agencyId and never userId.
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

  /**
   * KAI Super Admin only (see agency:manage_quota permission) — adds to an
   * agency's total quota, e.g. to extend a testing/pilot agency past the
   * bootstrap trial limit. Always additive, never resets usage already
   * counted, and always a positive whole number — this can only grant
   * more generations, never revoke ones already used.
   */
  async grantAdditionalQuota(
    agencyId: string,
    amount: number,
    actorId: string,
    reason?: string,
  ): Promise<{ totalQuota: number }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new AppError("Quota grant amount must be a positive whole number.", 400);
    }
    const quota = await agencyGenerationQuotaRepository.incrementTotalQuota(agencyId, amount);

    await auditLogService.record({
      action: AUDIT_ACTIONS.agencyGenerationQuotaGranted,
      entity: "Agency",
      entityId: agencyId,
      agencyId,
      actorId,
      metadata: { amount, newTotalQuota: quota.totalQuota, reason },
    });

    log.info({ agencyId, amount, newTotalQuota: quota.totalQuota }, "Generation quota granted");
    return { totalQuota: quota.totalQuota };
  },
};
