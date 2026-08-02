import { db } from "@/lib/db";
import type { Position } from "@prisma/client";

export const positionRepository = {
  listByJobOrder(jobOrderId: string): Promise<Position[]> {
    return db.position.findMany({
      where: { jobOrderId },
      orderBy: { sortOrder: "asc" },
    });
  },

  /**
   * Total demand per trade across an agency's history.
   *
   * This query is the entire reason Position is a table rather than a
   * Json column: "how many riggers have we been asked for this year"
   * cannot be answered against one jsonb blob per advertisement without
   * reading every row and parsing it in application code.
   *
   * Grouped on `normalizedTitle` so spelling variants of the same trade
   * aggregate together; `title` stays source-verbatim on each row.
   */
  async demandByTrade(agencyId: string, since?: Date) {
    const grouped = await db.position.groupBy({
      by: ["normalizedTitle"],
      where: {
        jobOrder: { agencyId },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { count: true },
      _count: { _all: true },
      orderBy: { _count: { normalizedTitle: "desc" } },
    });

    return grouped.map((row) => ({
      normalizedTitle: row.normalizedTitle,
      /** Sum of stated headcounts. Null counts contribute 0 — a position with no stated count is still one line. */
      totalRequested: row._sum.count ?? 0,
      /** How many separate position lines mentioned this trade. */
      lineCount: row._count._all,
    }));
  },
};
