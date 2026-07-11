import { db } from "@/lib/db";
import type { Prisma, QrScanEvent } from "@prisma/client";

export const qrScanEventRepository = {
  record(data: Prisma.QrScanEventCreateInput): Promise<QrScanEvent> {
    return db.qrScanEvent.create({ data });
  },

  listByAdvertisement(advertisementId: string, take = 100): Promise<QrScanEvent[]> {
    return db.qrScanEvent.findMany({
      where: { advertisementId },
      orderBy: { scannedAt: "desc" },
      take,
    });
  },
};
