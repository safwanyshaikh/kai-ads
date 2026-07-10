import { auditLogRepository } from "@/server/repositories/audit-log.repository";
import { createLogger } from "@/lib/logger";
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
};
