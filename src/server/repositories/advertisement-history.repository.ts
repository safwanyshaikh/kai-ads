import { db } from "@/lib/db";
import type { AdvertisementHistory, Prisma } from "@prisma/client";

export const advertisementHistoryRepository = {
  record(data: Prisma.AdvertisementHistoryCreateInput): Promise<AdvertisementHistory> {
    return db.advertisementHistory.create({ data });
  },

  listByAdvertisement(advertisementId: string): Promise<AdvertisementHistory[]> {
    return db.advertisementHistory.findMany({
      where: { advertisementId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  },
};
