import { db } from "@/lib/db";
import type { AgencyGenerationQuota } from "@prisma/client";

export const agencyGenerationQuotaRepository = {
  async findOrCreate(agencyId: string): Promise<AgencyGenerationQuota> {
    const existing = await db.agencyGenerationQuota.findUnique({ where: { agencyId } });
    if (existing) return existing;
    return db.agencyGenerationQuota.create({ data: { agency: { connect: { id: agencyId } } } });
  },

  incrementSuccessfulGenerations(agencyId: string): Promise<AgencyGenerationQuota> {
    return db.agencyGenerationQuota.update({
      where: { agencyId },
      data: { successfulGenerationsUsed: { increment: 1 } },
    });
  },

  incrementSectionRegenerations(agencyId: string): Promise<AgencyGenerationQuota> {
    return db.agencyGenerationQuota.update({
      where: { agencyId },
      data: { sectionRegenerationCount: { increment: 1 } },
    });
  },
};
