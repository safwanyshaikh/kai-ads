import { db } from "@/lib/db";
import type { AdvertisementDraft, AdvertisementDraftStatus, Prisma } from "@prisma/client";

export const advertisementDraftRepository = {
  create(data: Prisma.AdvertisementDraftCreateInput): Promise<AdvertisementDraft> {
    return db.advertisementDraft.create({ data });
  },

  findById(id: string, agencyId: string): Promise<AdvertisementDraft | null> {
    return db.advertisementDraft.findFirst({ where: { id, agencyId } });
  },

  update(id: string, data: Prisma.AdvertisementDraftUpdateInput): Promise<AdvertisementDraft> {
    return db.advertisementDraft.update({ where: { id }, data });
  },

  listByAgency(
    agencyId: string,
    status: AdvertisementDraftStatus | undefined,
    skip: number,
    take: number,
  ): Promise<AdvertisementDraft[]> {
    return db.advertisementDraft.findMany({
      where: { agencyId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });
  },

  count(agencyId: string, status?: AdvertisementDraftStatus): Promise<number> {
    return db.advertisementDraft.count({ where: { agencyId, ...(status ? { status } : {}) } });
  },
};
