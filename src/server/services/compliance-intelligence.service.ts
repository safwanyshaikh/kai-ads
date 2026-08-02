import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import { UNKNOWN } from "@/server/job-order-intelligence/determinations";
import {
  assessCompliance,
  type ComplianceAssessment,
  type ComplianceInput,
} from "@/server/compliance-intelligence/determinations";

const log = createLogger("compliance-intelligence");

/**
 * COMPLIANCE INTELLIGENCE ENGINE (Task 004)
 *
 *   ... -> JobOrder Intelligence -> **Compliance Intelligence** -> ...
 *
 * Determines the recruitment compliance requirements that apply to a
 * canonical JobOrder, before any campaign is created. It generates no
 * advertisement, selects no layout, and renders nothing.
 *
 * Fully deterministic and model-free. Every requirement comes from the
 * knowledge base in compliance-intelligence/knowledge-base.ts, and
 * nothing outside it is ever asserted — a corridor the knowledge base
 * does not cover yields UNKNOWN, never an empty result.
 *
 * This engine determines what compliance REQUIRES. It does not check an
 * advertisement against those requirements, because no advertisement
 * exists yet. Render-time enforcement of the same rules already lives in
 * prohibited-claims.service.ts and trust-validation.service.ts, and the
 * knowledge base cites that same phrase list rather than restating it.
 */

/**
 * Bumped whenever the knowledge base or an evaluator changes.
 *
 * Stored on every row so a determination made under an older rule set is
 * identifiable. On a compliance record this is not bookkeeping: it is how
 * an agency answers "which version of the rules were we assessed under"
 * when the answer matters.
 */
export const COMPLIANCE_INTELLIGENCE_VERSION = "1.0.0";

export const complianceIntelligenceService = {
  /**
   * Assesses a requirement's compliance position and attaches it.
   *
   * The whole set is replaced in one transaction: a requirement must
   * never be readable as half one assessment and half another. Replacement
   * rather than merge is correct because the set is derived — re-running
   * after the agency records its registration number should produce
   * today's position, not today's layered over yesterday's.
   */
  async assess(jobOrderId: string, agencyId: string): Promise<ComplianceAssessment> {
    const jobOrder = await db.jobOrder.findFirst({
      where: { id: jobOrderId, agencyId },
      include: {
        employer: true,
        positions: { orderBy: { sortOrder: "asc" } },
        agency: { include: { verification: true } },
        requirementSources: true,
        // Industry as JobOrder Intelligence determined it — this engine
        // consumes that output rather than re-deriving it.
        determinations: { where: { attribute: "industry" } },
      },
    });

    if (!jobOrder) throw new NotFoundError("Job order");

    const industryDetermination = jobOrder.determinations[0];

    const input: ComplianceInput = {
      destinationCountry: normalizeCountry(jobOrder.country),
      // Origin is not stored on the requirement. It is the jurisdiction
      // the agency's licence is issued under, which for this platform is
      // India — stated as a default in the knowledge base rather than
      // inferred here, so the assumption is visible in one place.
      originCountry: null,
      employerName: jobOrder.employer?.name ?? null,
      industry:
        industryDetermination && industryDetermination.value !== UNKNOWN
          ? industryDetermination.value
          : null,
      agency: {
        name: jobOrder.agency.name,
        registrationNumber: jobOrder.agency.registrationNumber,
        verificationStatus: jobOrder.agency.verification?.status ?? null,
      },
      positionSalaries: jobOrder.positions.map((position) => position.salary),
      requirementTexts: [
        jobOrder.title,
        ...jobOrder.positions.map((position) => position.title),
        ...jobOrder.requirementSources
          .map((source) => source.extractedText)
          .filter((text): text is string => typeof text === "string" && text.length > 0),
      ],
    };

    const assessment = assessCompliance(input);

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.complianceDetermination.deleteMany({ where: { jobOrderId } });
      await tx.complianceDetermination.createMany({
        data: assessment.determinations.map((determination) => ({
          jobOrderId,
          code: determination.code,
          category: determination.category,
          status: determination.status === UNKNOWN ? "UNKNOWN" : determination.status,
          value: determination.value === UNKNOWN ? "UNKNOWN" : determination.value,
          // The database rejects a confident UNKNOWN; keep the two in
          // step here rather than relying on the constraint to catch it.
          confidencePct: determination.status === UNKNOWN ? 0 : determination.confidencePct,
          source: determination.source,
          reason: determination.reason,
          authority: determination.authority,
          citation: determination.citation,
          reviewStatus: determination.reviewStatus,
          engineVersion: COMPLIANCE_INTELLIGENCE_VERSION,
        })),
      });
    });

    log.info(
      {
        jobOrderId,
        readiness: assessment.readiness.value,
        determinations: assessment.determinations.length,
        requiresLegalReview: assessment.requiresLegalReview,
      },
      "Compliance assessed",
    );

    return assessment;
  },

  /** The attached compliance position, for showing a recruiter what is required. */
  async get(jobOrderId: string, agencyId: string) {
    return db.complianceDetermination.findMany({
      where: { jobOrder: { id: jobOrderId, agencyId } },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });
  },

  /**
   * Every requirement currently blocked or outstanding on compliance —
   * the owner's "what cannot go out yet" list.
   */
  async findOutstanding(agencyId: string) {
    return db.jobOrder.findMany({
      where: {
        agencyId,
        complianceDeterminations: { some: { status: { in: ["VIOLATED", "REQUIRED"] } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        employer: true,
        complianceDeterminations: { where: { status: { in: ["VIOLATED", "REQUIRED"] } } },
      },
    });
  },
};

/** The placeholder Requirement Intelligence records when nothing was stated. */
const NOT_STATED = new Set(["", "not stated", "unknown", "n/a", "na", "tbd"]);

function normalizeCountry(country: string | null): string | null {
  if (!country) return null;
  return NOT_STATED.has(country.trim().toLowerCase()) ? null : country.trim();
}
