import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import {
  assessJobOrder,
  UNKNOWN,
  type JobOrderInput,
  type JobOrderIntelligenceResult,
} from "@/server/job-order-intelligence/determinations";

const log = createLogger("job-order-intelligence");

/**
 * JOBORDER INTELLIGENCE ENGINE (Task 003)
 *
 *   ... -> JobOrder -> **JobOrder Intelligence** -> Compliance -> ...
 *
 * Understands one canonical JobOrder and attaches that understanding to
 * it. It generates no advertisement, selects no layout, renders nothing,
 * and performs no compliance check — the next stage owns compliance and
 * runs after this one.
 *
 * Fully deterministic. This engine calls no model at all: every
 * determination comes from the taxonomy in
 * job-order-intelligence/taxonomy.ts matched against the requirement's
 * own records. That is a deliberate choice, not a limitation — a
 * classification an agency will quote to a principal has to be
 * reproducible and defensible a year later, and it must not change
 * because a provider shipped a new model.
 */

/**
 * Bumped whenever the taxonomy or a classifier changes.
 *
 * Stored on every row so a determination made under an older vocabulary
 * is identifiable rather than silently mixed with newer ones. Without
 * it, comparing two requirements assessed months apart quietly compares
 * two different engines.
 */
export const JOB_ORDER_INTELLIGENCE_VERSION = "1.0.0";

export const jobOrderIntelligenceService = {
  /**
   * Assesses a requirement and attaches the result.
   *
   * The whole determination set is replaced in one transaction: a
   * requirement must never be readable as half old understanding and
   * half new. Replacement rather than merge is correct because the set
   * is derived — re-running the engine on corrected facts should produce
   * today's answer, not today's answer layered over yesterday's.
   */
  async assess(jobOrderId: string, agencyId: string): Promise<JobOrderIntelligenceResult> {
    const jobOrder = await db.jobOrder.findFirst({
      where: { id: jobOrderId, agencyId },
      include: {
        employer: true,
        positions: { orderBy: { sortOrder: "asc" } },
        requirementSources: true,
        requirementFacts: { where: { field: "projectType" } },
      },
    });

    if (!jobOrder) throw new NotFoundError("Job order");

    const projectTypeFact = jobOrder.requirementFacts[0];

    const input: JobOrderInput = {
      title: jobOrder.title,
      industry: jobOrder.industry,
      country: jobOrder.country,
      employerName: jobOrder.employer?.name ?? null,
      projectType: projectTypeFact?.value ?? null,
      positions: jobOrder.positions.map((position) => ({
        title: position.title,
        normalizedTitle: position.normalizedTitle,
        count: position.count,
        experience: position.experience,
        qualifications: Array.isArray(position.qualifications)
          ? (position.qualifications as unknown[]).filter(
              (value): value is string => typeof value === "string",
            )
          : null,
        sortOrder: position.sortOrder,
      })),
      // What the engine actually read at intake — the narrative that
      // carries plant type, scope and urgency, which the structured
      // fields never capture.
      sourceTexts: jobOrder.requirementSources
        .map((source) => source.extractedText)
        .filter((text): text is string => typeof text === "string" && text.length > 0),
    };

    const result = assessJobOrder(input);

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.jobOrderDetermination.deleteMany({ where: { jobOrderId } });
      await tx.jobOrderDetermination.createMany({
        data: result.determinations.map((determination) => ({
          jobOrderId,
          attribute: determination.attribute,
          value: determination.value,
          // The database rejects a confident UNKNOWN; keep the two in
          // step here rather than relying on the constraint to catch it.
          confidencePct: determination.value === UNKNOWN ? 0 : determination.confidencePct,
          source: determination.source,
          reason: determination.reason,
          signals: determination.signals as Prisma.InputJsonValue,
          engineVersion: JOB_ORDER_INTELLIGENCE_VERSION,
        })),
      });
    });

    log.info(
      {
        jobOrderId,
        overallConfidencePct: result.overallConfidencePct,
        unknown: result.unknownAttributes.length,
      },
      "JobOrder assessed",
    );

    return result;
  },

  /** The attached understanding, for explaining a requirement back to a recruiter. */
  async get(jobOrderId: string, agencyId: string) {
    return db.jobOrderDetermination.findMany({
      where: { jobOrder: { id: jobOrderId, agencyId } },
      orderBy: { attribute: "asc" },
    });
  },

  /**
   * Every requirement an agency has run whose assessment matched a value
   * — "show me our refinery shutdowns".
   *
   * The determinations table exists to make exactly this answerable;
   * against free text it was not answerable at any speed.
   */
  async findByDetermination(agencyId: string, attribute: string, value: string) {
    return db.jobOrder.findMany({
      where: { agencyId, determinations: { some: { attribute, value } } },
      orderBy: { createdAt: "desc" },
      include: { employer: true },
    });
  },
};
