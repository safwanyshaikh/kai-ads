import { db } from "@/lib/db";
import type { Domain } from "@prisma/client";

export const domainRepository = {
  findByDomain(domain: string): Promise<Domain | null> {
    return db.domain.findUnique({ where: { domain } });
  },

  create(domain: string, agencyId: string): Promise<Domain> {
    return db.domain.create({ data: { domain, agencyId } });
  },

  listByAgency(agencyId: string): Promise<Domain[]> {
    return db.domain.findMany({ where: { agencyId } });
  },
};
