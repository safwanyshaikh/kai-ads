import type { Prisma } from "@prisma/client";
import { employerRepository } from "@/server/repositories/employer.repository";
import { jobOrderRepository, type JobOrderFilters } from "@/server/repositories/job-order.repository";
import { NotFoundError } from "@/lib/errors";
import { paginate, toSkipTake, type PaginationParams } from "@/lib/pagination";
import {
  collapseWhitespace,
  normalizeEmployerName,
  normalizePositionTitle,
} from "@/lib/normalize-entity-name";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

/**
 * JobOrder — the root entity of the permanent business domain (Task 001).
 *
 * WHERE THIS SITS IN THE CANONICAL PIPELINE
 *
 *   ANY REQUIREMENT -> Requirement Intelligence -> **JobOrder** -> ...
 *
 * Requirement Intelligence (src/server/ai) already turns any inbound
 * requirement into validated, source-grounded content. This module is
 * the next stage: it persists that content as the durable business
 * record the rest of the pipeline hangs off. It adds no intelligence of
 * its own and calls no AI provider.
 *
 * RELATIONSHIP TO Advertisement.positions / Advertisement.employer
 *
 * Those two columns are NOT removed and NOT deprecated. The
 * advertisement's Json blocks stay the immutable content snapshot that
 * the Rendering Engine consumes — the whole render path (fact-layer,
 * branding-overlay, versions, history, export) is untouched by this
 * change and continues to read exactly what it read before.
 *
 * The tables here are the *queryable projection* of the same facts. The
 * split is deliberate and is the reason existing APIs keep working
 * unchanged: nothing was moved, something was added alongside. Writes go
 * through both in one transaction (see advertisement.service.ts), so the
 * projection can never drift from the snapshot it was derived from.
 */

/** The shape a requirement takes once projected out of advertisement content. */
export interface ProjectedRequirement {
  /** Verbatim employer name, or null when the requirement named no employer. */
  employerName: string | null;
  /** De-duplication key for the above, or null. */
  employerNormalizedName: string | null;
  title: string;
  industry: string;
  country: string;
  interview: CreateAdvertisementInput["interview"] | null;
  positions: {
    title: string;
    normalizedTitle: string;
    count: number | null;
    experience: string | null;
    salary: string | null;
    ageRange: string | null;
    language: string | null;
    qualifications: string[] | null;
    sortOrder: number;
  }[];
}

/**
 * Pure projection from advertisement content to the business domain.
 *
 * Kept free of Prisma and of any I/O so the mapping rules — which
 * decide what an agency's employer and demand history will look like
 * forever — are directly testable without a database.
 *
 * Nothing is invented here. Every field is either copied verbatim from
 * the validated input or set to null; empty strings become null so that
 * "not stated" and "stated as blank" do not become two different things
 * in the history.
 */
export function projectRequirement(input: CreateAdvertisementInput): ProjectedRequirement {
  // collapseWhitespace, not just trim: the backfill in
  // migration.sql stores the collapsed form, so anything else here would
  // make an employer written before the migration and one written after
  // it store two different display names for the same record.
  const collapsedEmployer = input.employer ? collapseWhitespace(input.employer) : "";
  const employerName = collapsedEmployer.length > 0 ? collapsedEmployer : null;

  const blankToNull = (value: string | undefined): string | null => {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    employerName,
    employerNormalizedName: normalizeEmployerName(employerName),
    title: input.header,
    industry: input.industry,
    country: input.country,
    interview: input.interview ?? null,
    positions: input.positions.map((position, index) => ({
      title: position.title,
      normalizedTitle: normalizePositionTitle(position.title),
      count: position.count ?? null,
      experience: blankToNull(position.experience),
      salary: blankToNull(position.salary),
      ageRange: blankToNull(position.ageRange),
      language: blankToNull(position.language),
      qualifications:
        position.qualifications && position.qualifications.length > 0
          ? position.qualifications
          : null,
      sortOrder: index,
    })),
  };
}

export const jobOrderService = {
  /**
   * Creates the JobOrder (and resolves/creates its Employer and
   * Positions) for a new advertisement.
   *
   * Takes the caller's transaction rather than opening its own: the job
   * order, the advertisement, its v1 version snapshot and its history
   * row must all commit together or not at all. A committed advertisement
   * with no requirement behind it would be exactly the orphan state this
   * task exists to eliminate.
   */
  async provisionForAdvertisement(
    tx: Prisma.TransactionClient,
    params: { agencyId: string; actorId: string; input: CreateAdvertisementInput },
  ): Promise<string> {
    const projected = projectRequirement(params.input);

    let employerId: string | null = null;
    if (projected.employerName && projected.employerNormalizedName) {
      const employer = await employerRepository.resolve(
        tx,
        params.agencyId,
        projected.employerName,
        projected.employerNormalizedName,
      );
      employerId = employer.id;
    }

    const jobOrder = await tx.jobOrder.create({
      data: {
        agencyId: params.agencyId,
        employerId,
        title: projected.title,
        industry: projected.industry,
        country: projected.country,
        interview: (projected.interview ?? undefined) as Prisma.InputJsonValue | undefined,
        createdById: params.actorId,
        positions: {
          create: projected.positions.map((position) => ({
            title: position.title,
            normalizedTitle: position.normalizedTitle,
            count: position.count,
            experience: position.experience,
            salary: position.salary,
            ageRange: position.ageRange,
            language: position.language,
            qualifications: (position.qualifications ?? undefined) as Prisma.InputJsonValue | undefined,
            sortOrder: position.sortOrder,
          })),
        },
      },
    });

    return jobOrder.id;
  },

  /**
   * Re-projects a job order after its advertisement's content was edited,
   * so the queryable domain never lags the snapshot the recruiter just
   * approved.
   *
   * Positions are replaced wholesale rather than diffed. They carry no
   * independent identity yet — nothing references a Position row — so a
   * replace is both simpler and strictly correct. The moment something
   * does attach to a position, this becomes a diff and that will be a
   * deliberate change, not an accident.
   *
   * A no-op when the advertisement has no job order (an advertisement
   * created before this task and not yet backfilled): the edit still
   * succeeds, because no existing capability may regress on account of
   * the new domain.
   */
  async syncFromAdvertisement(
    tx: Prisma.TransactionClient,
    params: {
      jobOrderId: string | null;
      agencyId: string;
      content: CreateAdvertisementInput;
    },
  ): Promise<void> {
    if (!params.jobOrderId) return;

    const projected = projectRequirement(params.content);

    let employerId: string | null = null;
    if (projected.employerName && projected.employerNormalizedName) {
      const employer = await employerRepository.resolve(
        tx,
        params.agencyId,
        projected.employerName,
        projected.employerNormalizedName,
      );
      employerId = employer.id;
    }

    await tx.jobOrder.update({
      where: { id: params.jobOrderId },
      data: {
        employerId,
        title: projected.title,
        industry: projected.industry,
        country: projected.country,
        interview: (projected.interview ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await tx.position.deleteMany({ where: { jobOrderId: params.jobOrderId } });
    await tx.position.createMany({
      data: projected.positions.map((position) => ({
        jobOrderId: params.jobOrderId as string,
        title: position.title,
        normalizedTitle: position.normalizedTitle,
        count: position.count,
        experience: position.experience,
        salary: position.salary,
        ageRange: position.ageRange,
        language: position.language,
        qualifications: (position.qualifications ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: position.sortOrder,
      })),
    });
  },

  async getById(id: string, agencyId: string) {
    const jobOrder = await jobOrderRepository.findWithRelations(id, agencyId);
    if (!jobOrder) throw new NotFoundError("Job order");
    return jobOrder;
  },

  async list(filters: JobOrderFilters, pagination: PaginationParams) {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await Promise.all([
      jobOrderRepository.findMany(filters, skip, take),
      jobOrderRepository.count(filters),
    ]);
    return paginate(data, total, pagination);
  },
};
