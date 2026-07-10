import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const auditLogRepository = {
  record(entry: {
    action: string;
    entity: string;
    entityId: string;
    actorId?: string | null;
    agencyId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return db.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        actorId: entry.actorId ?? null,
        agencyId: entry.agencyId ?? null,
        metadata: entry.metadata,
      },
    });
  },

  listForEntity(entity: string, entityId: string) {
    return db.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: "desc" },
    });
  },

  listPaginated(params: { agencyId?: string; skip: number; take: number }) {
    return db.auditLog.findMany({
      where: params.agencyId ? { agencyId: params.agencyId } : undefined,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  count(params: { agencyId?: string }): Promise<number> {
    return db.auditLog.count({
      where: params.agencyId ? { agencyId: params.agencyId } : undefined,
    });
  },
};
