import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import { UNKNOWN } from "@/server/job-order-intelligence/determinations";
import {
  assessCampaign,
  type CampaignAssessment,
  type CampaignInput,
  type UpstreamDetermination,
} from "@/server/campaign-intelligence/determinations";

const log = createLogger("campaign-intelligence");

/**
 * CAMPAIGN INTELLIGENCE ENGINE (Task 005)
 *
 *   ... -> Compliance Intelligence -> **Campaign Intelligence** -> ...
 *
 * Decides HOW a requirement should be communicated, and attaches that
 * decision to the JobOrder. It generates no advertisement, selects no
 * layout, and renders nothing. It never decides typography, colour or
 * position.
 *
 * Fully deterministic and model-free. Every decision is a lookup in
 * campaign-intelligence/strategy-map.ts keyed on what JobOrder
 * Intelligence and Compliance Intelligence already determined — so the
 * campaign is a function of the intelligence, and re-running it after
 * that intelligence is corrected produces a correspondingly corrected
 * campaign.
 */

/**
 * Bumped whenever the strategy map or a determiner changes.
 *
 * Stored per row so a campaign built under an older strategy is
 * identifiable rather than silently compared against newer ones.
 */
export const CAMPAIGN_INTELLIGENCE_VERSION = "1.0.0";

export const campaignIntelligenceService = {
  /**
   * Builds the communication strategy and attaches it.
   *
   * The whole set is replaced in one transaction: a requirement must
   * never be readable as half one strategy and half another.
   */
  async assess(jobOrderId: string, agencyId: string): Promise<CampaignAssessment> {
    const jobOrder = await db.jobOrder.findFirst({
      where: { id: jobOrderId, agencyId },
      include: {
        employer: true,
        positions: { orderBy: { sortOrder: "asc" } },
        determinations: true,
        complianceDeterminations: true,
        requirementFacts: { where: { field: { in: ["interview.date", "contact.phone", "contact.email"] } } },
      },
    });

    if (!jobOrder) throw new NotFoundError("Job order");

    // JobOrder Intelligence output, keyed by attribute. UNKNOWN values are
    // carried through as-is so the derivation layer can propagate them.
    const intelligence: Record<string, UpstreamDetermination | undefined> = {};
    for (const determination of jobOrder.determinations) {
      intelligence[determination.attribute] = {
        value: determination.value,
        confidencePct: determination.confidencePct,
      };
    }

    const readiness = jobOrder.complianceDeterminations.find(
      (determination) => determination.code === "COMPLIANCE_READINESS",
    );
    const agencyVerified = jobOrder.complianceDeterminations.some(
      (determination) =>
        determination.code === "KAI-TRUST-AGENCY-VERIFIED" && determination.status === "SATISFIED",
    );

    const stated = (field: string) =>
      jobOrder.requirementFacts.some(
        (fact) => fact.field === field && fact.value !== null && fact.method !== "ABSENT",
      );

    const input: CampaignInput = {
      intelligence,
      compliance: {
        // No compliance assessment at all is treated as UNKNOWN, not as
        // clear: a campaign must never be built on a compliance position
        // nobody established.
        readiness: readiness ? (readiness.status === "UNKNOWN" ? UNKNOWN : readiness.value) : UNKNOWN,
        agencyVerified,
      },
      jobOrder: {
        employerName: jobOrder.employer?.name ?? null,
        interviewDateStated: stated("interview.date"),
        contactStated: stated("contact.phone") || stated("contact.email"),
        positions: jobOrder.positions.map((position) => ({
          title: position.title,
          count: position.count,
          salary: position.salary,
        })),
      },
    };

    const assessment = assessCampaign(input);

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.campaignDetermination.deleteMany({ where: { jobOrderId } });
      await tx.campaignDetermination.createMany({
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
          engineVersion: CAMPAIGN_INTELLIGENCE_VERSION,
        })),
      });
    });

    log.info(
      {
        jobOrderId,
        overallConfidencePct: assessment.overallConfidencePct,
        unknown: assessment.unknownAttributes.length,
      },
      "Campaign strategy determined",
    );

    return assessment;
  },

  /** The attached communication strategy, for explaining a campaign back to a recruiter. */
  async get(jobOrderId: string, agencyId: string) {
    return db.campaignDetermination.findMany({
      where: { jobOrder: { id: jobOrderId, agencyId } },
      orderBy: { attribute: "asc" },
    });
  },
};
