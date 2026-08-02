import { db } from "@/lib/db";
import type { Employer, Prisma } from "@prisma/client";

export const employerRepository = {
  findByNormalizedName(agencyId: string, normalizedName: string): Promise<Employer | null> {
    return db.employer.findUnique({
      where: { agencyId_normalizedName: { agencyId, normalizedName } },
    });
  },

  findById(id: string, agencyId: string): Promise<Employer | null> {
    return db.employer.findFirst({ where: { id, agencyId } });
  },

  listByAgency(agencyId: string): Promise<Employer[]> {
    return db.employer.findMany({ where: { agencyId }, orderBy: { name: "asc" } });
  },

  create(data: Prisma.EmployerCreateInput): Promise<Employer> {
    return db.employer.create({ data });
  },

  /**
   * Resolves free-text employer name to the agency's single Employer
   * record, creating it on first sight.
   *
   * Concurrency: two recruiters saving requirements for the same new
   * employer in the same second both miss the lookup and both insert.
   * The [agencyId, normalizedName] unique constraint makes the loser
   * fail with P2002, and the re-read returns the winner's row — so the
   * outcome is one employer either way. Handling it here rather than in
   * the service keeps every caller safe by default.
   */
  async resolve(
    tx: Prisma.TransactionClient,
    agencyId: string,
    name: string,
    normalizedName: string,
  ): Promise<Employer> {
    const existing = await tx.employer.findUnique({
      where: { agencyId_normalizedName: { agencyId, normalizedName } },
    });
    if (existing) return existing;

    try {
      return await tx.employer.create({ data: { agencyId, name, normalizedName } });
    } catch (error) {
      const raced = await tx.employer.findUnique({
        where: { agencyId_normalizedName: { agencyId, normalizedName } },
      });
      if (raced) return raced;
      throw error;
    }
  },
};
