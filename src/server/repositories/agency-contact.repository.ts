import { db } from "@/lib/db";
import type { AgencyContact, Prisma } from "@prisma/client";

export const agencyContactRepository = {
  create(data: Prisma.AgencyContactCreateInput): Promise<AgencyContact> {
    return db.agencyContact.create({ data });
  },

  findById(id: string, agencyId: string): Promise<AgencyContact | null> {
    return db.agencyContact.findFirst({ where: { id, agencyId, deletedAt: null } });
  },

  listByAgency(agencyId: string): Promise<AgencyContact[]> {
    return db.agencyContact.findMany({
      where: { agencyId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  },

  update(id: string, data: Prisma.AgencyContactUpdateInput): Promise<AgencyContact> {
    return db.agencyContact.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<AgencyContact> {
    return db.agencyContact.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
