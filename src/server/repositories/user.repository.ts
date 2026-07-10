import { db } from "@/lib/db";
import type { Prisma, User, UserRole, UserStatus } from "@prisma/client";

export const userRepository = {
  findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  },

  findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  },

  create(data: Prisma.UserCreateInput): Promise<User> {
    return db.user.create({ data });
  },

  updateRoleAndStatus(
    id: string,
    data: { role?: UserRole; status?: UserStatus; agencyId?: string | null },
  ): Promise<User> {
    return db.user.update({ where: { id }, data });
  },

  listByAgency(agencyId: string): Promise<User[]> {
    return db.user.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
    });
  },

  listByAgencyPaginated(agencyId: string, skip: number, take: number): Promise<User[]> {
    return db.user.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  },

  countByAgency(agencyId: string): Promise<number> {
    return db.user.count({ where: { agencyId } });
  },

  countAdminsForAgency(agencyId: string): Promise<number> {
    return db.user.count({
      where: { agencyId, role: "AGENCY_ADMIN", status: "ACTIVE" },
    });
  },
};
