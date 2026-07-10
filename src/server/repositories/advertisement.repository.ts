import { db } from "@/lib/db";
import type { Advertisement, AdvertisementStatus, AdvertisementStyle, Prisma } from "@prisma/client";

export interface AdvertisementFilters {
  agencyId: string;
  q?: string;
  status?: AdvertisementStatus;
  style?: AdvertisementStyle;
  industry?: string;
  country?: string;
  createdById?: string;
  includeDeleted?: boolean;
  includeArchived?: boolean;
}

function buildWhere(filters: AdvertisementFilters): Prisma.AdvertisementWhereInput {
  const where: Prisma.AdvertisementWhereInput = { agencyId: filters.agencyId };

  if (!filters.includeDeleted) {
    where.deletedAt = null;
  }
  if (filters.status) {
    where.status = filters.status;
  } else if (filters.includeArchived === false) {
    where.status = { not: "ARCHIVED" };
  }
  if (filters.style) where.style = filters.style;
  if (filters.industry) where.industry = { equals: filters.industry, mode: "insensitive" };
  if (filters.country) where.country = { equals: filters.country, mode: "insensitive" };
  if (filters.createdById) where.createdById = filters.createdById;

  if (filters.q) {
    where.OR = [
      { header: { contains: filters.q, mode: "insensitive" } },
      { employer: { contains: filters.q, mode: "insensitive" } },
      { industry: { contains: filters.q, mode: "insensitive" } },
      { country: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export const advertisementRepository = {
  create(data: Prisma.AdvertisementCreateInput): Promise<Advertisement> {
    return db.advertisement.create({ data });
  },

  findById(id: string, agencyId: string, includeDeleted = false): Promise<Advertisement | null> {
    return db.advertisement.findFirst({
      where: { id, agencyId, ...(includeDeleted ? {} : { deletedAt: null }) },
    });
  },

  findMany(filters: AdvertisementFilters, skip: number, take: number): Promise<Advertisement[]> {
    return db.advertisement.findMany({
      where: buildWhere(filters),
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });
  },

  count(filters: AdvertisementFilters): Promise<number> {
    return db.advertisement.count({ where: buildWhere(filters) });
  },

  update(id: string, data: Prisma.AdvertisementUpdateInput): Promise<Advertisement> {
    return db.advertisement.update({ where: { id }, data });
  },

  updateStatus(id: string, status: AdvertisementStatus): Promise<Advertisement> {
    return db.advertisement.update({ where: { id }, data: { status } });
  },

  softDelete(id: string): Promise<Advertisement> {
    return db.advertisement.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  restore(id: string): Promise<Advertisement> {
    return db.advertisement.update({ where: { id }, data: { deletedAt: null } });
  },

  incrementVersion(id: string): Promise<Advertisement> {
    return db.advertisement.update({
      where: { id },
      data: { currentVersion: { increment: 1 } },
    });
  },
};
