import { db } from "@/lib/db";
import type { AdvertisementVersion, Prisma } from "@prisma/client";

export const advertisementVersionRepository = {
  create(data: Prisma.AdvertisementVersionCreateInput): Promise<AdvertisementVersion> {
    return db.advertisementVersion.create({ data });
  },

  listByAdvertisement(advertisementId: string): Promise<AdvertisementVersion[]> {
    return db.advertisementVersion.findMany({
      where: { advertisementId },
      orderBy: { versionNumber: "desc" },
      take: 500,
    });
  },

  findVersion(advertisementId: string, versionNumber: number): Promise<AdvertisementVersion | null> {
    return db.advertisementVersion.findUnique({
      where: { advertisementId_versionNumber: { advertisementId, versionNumber } },
    });
  },
};
