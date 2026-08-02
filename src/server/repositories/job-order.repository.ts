import { db } from "@/lib/db";
import type { JobOrder, Prisma } from "@prisma/client";

export interface JobOrderFilters {
  agencyId: string;
  employerId?: string;
  country?: string;
  industry?: string;
}

function buildWhere(filters: JobOrderFilters): Prisma.JobOrderWhereInput {
  const where: Prisma.JobOrderWhereInput = { agencyId: filters.agencyId };
  if (filters.employerId) where.employerId = filters.employerId;
  if (filters.country) where.country = { equals: filters.country, mode: "insensitive" };
  if (filters.industry) where.industry = { equals: filters.industry, mode: "insensitive" };
  return where;
}

export const jobOrderRepository = {
  findById(id: string, agencyId: string): Promise<JobOrder | null> {
    return db.jobOrder.findFirst({ where: { id, agencyId } });
  },

  /** The requirement plus everything hanging off it — the root-entity read. */
  findWithRelations(id: string, agencyId: string) {
    return db.jobOrder.findFirst({
      where: { id, agencyId },
      include: {
        employer: true,
        positions: { orderBy: { sortOrder: "asc" } },
        advertisements: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
  },

  findMany(filters: JobOrderFilters, skip: number, take: number): Promise<JobOrder[]> {
    return db.jobOrder.findMany({
      where: buildWhere(filters),
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  },

  count(filters: JobOrderFilters): Promise<number> {
    return db.jobOrder.count({ where: buildWhere(filters) });
  },
};
