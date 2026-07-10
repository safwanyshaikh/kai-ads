import { auditLogRepository } from "@/server/repositories/audit-log.repository";
import { createLogger } from "@/lib/logger";
import { paginate, toSkipTake, type PaginationParams } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

const log = createLogger("audit");

export const auditLogService = {
  async record(entry: {
    action: string;
    entity: string;
    entityId: string;
    actorId?: string | null;
    agencyId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      await auditLogRepository.record(entry);
    } catch (error) {
      // Audit logging must never break the primary transaction.
      log.error({ err: error, entry }, "Failed to write audit log");
    }
  },

  /**
   * FIX-006: pagination is implemented at the data layer so it's ready
   * the moment an audit log screen ships. No route or UI is added here —
   * out of scope for this stabilization pass (no new features/UI).
   */
  async listPaginated(pagination: PaginationParams, agencyId?: string) {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await Promise.all([
      auditLogRepository.listPaginated({ agencyId, skip, take }),
      auditLogRepository.count({ agencyId }),
    ]);
    return paginate(data, total, pagination);
  },
};
