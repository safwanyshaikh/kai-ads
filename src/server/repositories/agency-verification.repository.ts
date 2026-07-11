import { db } from "@/lib/db";
import type { AgencyVerification, Prisma } from "@prisma/client";

export const agencyVerificationRepository = {
  findById(id: string): Promise<AgencyVerification | null> {
    return db.agencyVerification.findUnique({ where: { id } });
  },

  findByAgencyId(agencyId: string): Promise<AgencyVerification | null> {
    return db.agencyVerification.findUnique({ where: { agencyId } });
  },

  upsert(agencyId: string, data: Prisma.AgencyVerificationUpdateInput): Promise<AgencyVerification> {
    return db.agencyVerification.upsert({
      where: { agencyId },
      create: { agency: { connect: { id: agencyId } }, ...(data as Prisma.AgencyVerificationCreateWithoutAgencyInput) },
      update: data,
    });
  },

  listAll(): Promise<AgencyVerification[]> {
    return db.agencyVerification.findMany({ orderBy: { updatedAt: "desc" } });
  },
};
