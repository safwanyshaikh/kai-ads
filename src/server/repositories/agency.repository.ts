import { db } from "@/lib/db";
import type { Agency, AgencyStatus, Prisma } from "@prisma/client";

/**
 * Repository pattern: all Prisma access for Agency lives here.
 * Services depend on this interface, never on `db` directly.
 */
export const agencyRepository = {
  create(data: Prisma.AgencyCreateInput): Promise<Agency> {
    return db.agency.create({ data });
  },

  findById(id: string): Promise<Agency | null> {
    return db.agency.findUnique({ where: { id } });
  },

  findByRegistrationNumber(registrationNumber: string): Promise<Agency | null> {
    return db.agency.findUnique({ where: { registrationNumber } });
  },

  findByOfficialEmail(officialEmail: string): Promise<Agency | null> {
    return db.agency.findUnique({ where: { officialEmail } });
  },

  findMany(params: {
    status?: AgencyStatus;
    skip?: number;
    take?: number;
  }): Promise<Agency[]> {
    return db.agency.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  count(params: { status?: AgencyStatus }): Promise<number> {
    return db.agency.count({
      where: params.status ? { status: params.status } : undefined,
    });
  },

  updateStatus(id: string, status: AgencyStatus): Promise<Agency> {
    return db.agency.update({ where: { id }, data: { status } });
  },

  withDomains(id: string) {
    return db.agency.findUnique({
      where: { id },
      include: { domains: true },
    });
  },
};
