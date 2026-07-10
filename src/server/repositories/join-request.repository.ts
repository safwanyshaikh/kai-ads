import { db } from "@/lib/db";
import type { JoinRequest, JoinRequestStatus } from "@prisma/client";

export const joinRequestRepository = {
  create(userId: string, agencyId: string): Promise<JoinRequest> {
    return db.joinRequest.create({ data: { userId, agencyId } });
  },

  findById(id: string) {
    return db.joinRequest.findUnique({
      where: { id },
      include: { user: true, agency: true },
    });
  },

  findPendingByUser(userId: string): Promise<JoinRequest | null> {
    return db.joinRequest.findFirst({
      where: { userId, status: "PENDING" },
    });
  },

  listByAgency(agencyId: string, status?: JoinRequestStatus) {
    return db.joinRequest.findMany({
      where: { agencyId, ...(status ? { status } : {}) },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  },

  listByAgencyPaginated(agencyId: string, status: JoinRequestStatus | undefined, skip: number, take: number) {
    return db.joinRequest.findMany({
      where: { agencyId, ...(status ? { status } : {}) },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  },

  countByAgency(agencyId: string, status?: JoinRequestStatus): Promise<number> {
    return db.joinRequest.count({ where: { agencyId, ...(status ? { status } : {}) } });
  },

  updateStatus(
    id: string,
    status: JoinRequestStatus,
    reviewedById: string,
  ): Promise<JoinRequest> {
    return db.joinRequest.update({
      where: { id },
      data: { status, reviewedById, reviewedAt: new Date() },
    });
  },
};
