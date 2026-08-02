import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import { UNKNOWN } from "@/server/job-order-intelligence/determinations";
import { assessLayout, type LayoutAssessment, type LayoutInput } from "@/server/layout-intelligence/determinations";
import type { UpstreamDetermination } from "@/server/campaign-intelligence/determinations";

const log = createLogger("layout-intelligence");

/**
 * LAYOUT INTELLIGENCE ENGINE (Task 006)
 *
 *   ... -> Campaign Intelligence -> **Layout Intelligence** -> Rendering Engine -> ...
 *
 * Decides HOW the campaign should be presented, and attaches that
 * Publication Strategy to the JobOrder. It does not render, generate
 * images, edit, or publish anything.
 *
 * Fully deterministic and model-free. Every decision is a lookup in
 * layout-intelligence/strategy-map.ts keyed on what Campaign
 * Intelligence already determined — and ONLY on that. This engine never
 * re-reads the JobOrder's own facts; if a fact matters to presentation,
 * Campaign Intelligence already turned it into a communication decision.
 */

/**
 * Bumped whenever the strategy map or a determiner changes.
 *
 * Stored per row so a Publication Strategy built under an older strategy
 * is identifiable rather than silently compared against newer ones.
 */
export const LAYOUT_INTELLIGENCE_VERSION = "1.0.0";

export const layoutIntelligenceService = {
  /**
   * Builds the Publication Strategy and attaches it.
   *
   * The whole set is replaced in one transaction: a requirement must
   * never be readable as half one strategy and half another.
   */
  async assess(jobOrderId: string, agencyId: string): Promise<LayoutAssessment> {
    const jobOrder = await db.jobOrder.findFirst({
      where: { id: jobOrderId, agencyId },
      include: { campaignDeterminations: true },
    });

    if (!jobOrder) throw new NotFoundError("Job order");

    const campaign: Record<string, UpstreamDetermination | undefined> = {};
    for (const determination of jobOrder.campaignDeterminations) {
      campaign[determination.attribute] = {
        value: determination.value,
        confidencePct: determination.confidencePct,
      };
    }

    const input: LayoutInput = { campaign };
    const assessment = assessLayout(input);

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.layoutDetermination.deleteMany({ where: { jobOrderId } });
      await tx.layoutDetermination.createMany({
        data: assessment.determinations.map((determination) => ({
          jobOrderId,
          attribute: determination.attribute,
          value: determination.value,
          // The database rejects a confident UNKNOWN; keep the two in
          // step here rather than relying on the constraint to catch it.
          confidencePct: determination.value === UNKNOWN ? 0 : determination.confidencePct,
          source: determination.source,
          reason: determination.reason,
          dependsOn: determination.dependsOn as Prisma.InputJsonValue,
          engineVersion: LAYOUT_INTELLIGENCE_VERSION,
        })),
      });
    });

    log.info(
      {
        jobOrderId,
        overallConfidencePct: assessment.overallConfidencePct,
        unknown: assessment.unknownAttributes.length,
      },
      "Publication strategy determined",
    );

    return assessment;
  },

  /** The attached Publication Strategy, for the Rendering Engine and for explaining it to a recruiter. */
  async get(jobOrderId: string, agencyId: string) {
    return db.layoutDetermination.findMany({
      where: { jobOrder: { id: jobOrderId, agencyId } },
      orderBy: { attribute: "asc" },
    });
  },
};
