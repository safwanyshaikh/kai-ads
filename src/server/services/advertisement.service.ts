import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  advertisementRepository,
  type AdvertisementFilters,
} from "@/server/repositories/advertisement.repository";
import { advertisementVersionRepository } from "@/server/repositories/advertisement-version.repository";
import { advertisementHistoryRepository } from "@/server/repositories/advertisement-history.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { paginate, toSkipTake, type PaginationParams } from "@/lib/pagination";
import { createLogger } from "@/lib/logger";
import type {
  CreateAdvertisementInput,
  UpdateAdvertisementInput,
} from "@/lib/validations/advertisement";

const log = createLogger("advertisement-service");

/** The full set of editable fields — used to build both the initial record and every version snapshot. */
function contentFields(input: Partial<CreateAdvertisementInput>) {
  return {
    header: input.header,
    industry: input.industry,
    country: input.country,
    employer: input.employer || null,
    positions: input.positions,
    benefits: input.benefits,
    interview: input.interview,
    contact: input.contact,
    footer: input.footer || null,
    theme: input.theme,
    style: input.style,
  };
}

export const advertisementService = {
  /** Creates the Advertisement plus its v1 version snapshot in one transaction. */
  async create(agencyId: string, actorId: string, input: CreateAdvertisementInput) {
    const advertisement = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.advertisement.create({
        data: {
          agencyId,
          createdById: actorId,
          status: "DRAFT",
          currentVersion: 1,
          sourceDraftId: input.sourceDraftId,
          ...contentFields(input),
          positions: input.positions as Prisma.InputJsonValue,
          benefits: input.benefits as Prisma.InputJsonValue,
          interview: input.interview as Prisma.InputJsonValue,
          contact: input.contact as Prisma.InputJsonValue,
          theme: (input.theme ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.advertisementVersion.create({
        data: {
          advertisementId: created.id,
          versionNumber: 1,
          snapshot: contentFields(input) as Prisma.InputJsonValue,
          changeSummary: "Initial version",
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId: created.id,
          action: "created",
          toStatus: "DRAFT",
          actorId,
        },
      });

      return created;
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementCreated,
      entity: "Advertisement",
      entityId: advertisement.id,
      agencyId,
      actorId,
    });

    log.info({ advertisementId: advertisement.id }, "Advertisement created");
    return advertisement;
  },

  async getById(id: string, agencyId: string, includeDeleted = false) {
    const advertisement = await advertisementRepository.findById(id, agencyId, includeDeleted);
    if (!advertisement) throw new NotFoundError("Advertisement");
    return advertisement;
  },

  async list(filters: AdvertisementFilters, pagination: PaginationParams) {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await Promise.all([
      advertisementRepository.findMany(filters, skip, take),
      advertisementRepository.count(filters),
    ]);
    return paginate(data, total, pagination);
  },

  /** Updates content, bumps the version, and snapshots the new state — never mutates history in place. */
  async update(
    id: string,
    agencyId: string,
    actorId: string,
    input: UpdateAdvertisementInput,
  ) {
    const existing = await advertisementService.getById(id, agencyId);

    const merged: Partial<CreateAdvertisementInput> = {
      header: input.header ?? existing.header,
      industry: input.industry ?? existing.industry,
      country: input.country ?? existing.country,
      employer: input.employer ?? existing.employer ?? undefined,
      positions: (input.positions ?? existing.positions) as CreateAdvertisementInput["positions"],
      benefits: (input.benefits ?? existing.benefits) as CreateAdvertisementInput["benefits"],
      interview: (input.interview ?? existing.interview) as CreateAdvertisementInput["interview"],
      contact: (input.contact ?? existing.contact) as CreateAdvertisementInput["contact"],
      footer: input.footer ?? existing.footer ?? undefined,
      theme: (input.theme ?? existing.theme) as CreateAdvertisementInput["theme"],
      style: input.style ?? existing.style,
    };

    const nextVersion = existing.currentVersion + 1;

    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.advertisement.update({
        where: { id },
        data: {
          ...contentFields(merged),
          positions: merged.positions as Prisma.InputJsonValue,
          benefits: merged.benefits as Prisma.InputJsonValue,
          interview: merged.interview as Prisma.InputJsonValue,
          contact: merged.contact as Prisma.InputJsonValue,
          theme: (merged.theme ?? undefined) as Prisma.InputJsonValue | undefined,
          currentVersion: nextVersion,
        },
      });

      await tx.advertisementVersion.create({
        data: {
          advertisementId: id,
          versionNumber: nextVersion,
          snapshot: contentFields(merged) as Prisma.InputJsonValue,
          changeSummary: input.changeSummary || "Updated",
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId: id,
          action: "updated",
          metadata: { versionNumber: nextVersion },
          actorId,
        },
      });

      return result;
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementUpdated,
      entity: "Advertisement",
      entityId: id,
      agencyId,
      actorId,
      metadata: { versionNumber: nextVersion },
    });

    return updated;
  },

  async changeStatus(
    id: string,
    agencyId: string,
    actorId: string,
    toStatus: "DRAFT" | "REVIEW" | "APPROVED" | "ARCHIVED",
    reason?: string,
  ) {
    const existing = await advertisementService.getById(id, agencyId);
    if (existing.status === toStatus) {
      throw new ConflictError(`Advertisement is already ${toStatus}.`);
    }

    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.advertisement.update({ where: { id }, data: { status: toStatus } });
      await tx.advertisementHistory.create({
        data: {
          advertisementId: id,
          action: "status_changed",
          fromStatus: existing.status,
          toStatus,
          metadata: reason ? { reason } : undefined,
          actorId,
        },
      });
      return result;
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementStatusChanged,
      entity: "Advertisement",
      entityId: id,
      agencyId,
      actorId,
      metadata: { from: existing.status, to: toStatus, reason },
    });

    return updated;
  },

  /** Build item: "Advertisement Archive" — a status transition, the ad stays visible under an Archived filter. */
  async archive(id: string, agencyId: string, actorId: string, reason?: string) {
    const updated = await advertisementService.changeStatus(id, agencyId, actorId, "ARCHIVED", reason);
    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementArchived,
      entity: "Advertisement",
      entityId: id,
      agencyId,
      actorId,
    });
    return updated;
  },

  /** Acceptance criterion: "Soft delete" — distinct from Archive; hides the ad from every default listing. */
  async softDelete(id: string, agencyId: string, actorId: string) {
    await advertisementService.getById(id, agencyId);
    const updated = await advertisementRepository.softDelete(id);

    await advertisementHistoryRepository.record({
      advertisement: { connect: { id } },
      action: "deleted",
      actor: { connect: { id: actorId } },
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDeleted,
      entity: "Advertisement",
      entityId: id,
      agencyId,
      actorId,
    });

    return updated;
  },

  /**
   * Build item: "Advertisement Restore" / Acceptance: "Restore." — a
   * single action that undoes whichever of the two "hidden" states the
   * advertisement is in: soft-deleted (trash) takes priority if both
   * happen to be true, otherwise archived.
   */
  async restore(id: string, agencyId: string, actorId: string) {
    const existing = await advertisementRepository.findById(id, agencyId, true);
    if (!existing) throw new NotFoundError("Advertisement");

    if (existing.deletedAt) {
      const updated = await advertisementRepository.restore(id);
      await advertisementHistoryRepository.record({
        advertisement: { connect: { id } },
        action: "undeleted",
        actor: { connect: { id: actorId } },
      });
      await auditLogService.record({
        action: AUDIT_ACTIONS.advertisementUndeleted,
        entity: "Advertisement",
        entityId: id,
        agencyId,
        actorId,
      });
      return updated;
    }

    if (existing.status === "ARCHIVED") {
      const updated = await advertisementService.changeStatus(id, agencyId, actorId, "REVIEW");
      await auditLogService.record({
        action: AUDIT_ACTIONS.advertisementRestored,
        entity: "Advertisement",
        entityId: id,
        agencyId,
        actorId,
      });
      return updated;
    }

    throw new ConflictError("This advertisement is neither archived nor deleted — nothing to restore.");
  },

  /** Build item: "Advertisement Duplicate" — clones content into a new DRAFT ad, its own version-1 history. */
  async duplicate(id: string, agencyId: string, actorId: string) {
    const source = await advertisementService.getById(id, agencyId);

    const duplicated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.advertisement.create({
        data: {
          agencyId,
          createdById: actorId,
          status: "DRAFT",
          currentVersion: 1,
          duplicatedFromId: source.id,
          header: `${source.header} (Copy)`,
          industry: source.industry,
          country: source.country,
          employer: source.employer,
          positions: source.positions as Prisma.InputJsonValue,
          benefits: source.benefits as Prisma.InputJsonValue,
          interview: source.interview as Prisma.InputJsonValue,
          contact: source.contact as Prisma.InputJsonValue,
          footer: source.footer,
          theme: (source.theme ?? undefined) as Prisma.InputJsonValue | undefined,
          style: source.style,
        },
      });

      await tx.advertisementVersion.create({
        data: {
          advertisementId: created.id,
          versionNumber: 1,
          snapshot: {
            header: created.header,
            industry: created.industry,
            country: created.country,
            employer: created.employer,
            positions: source.positions,
            benefits: source.benefits,
            interview: source.interview,
            contact: source.contact,
            footer: created.footer,
            theme: source.theme,
            style: created.style,
          } as Prisma.InputJsonValue,
          changeSummary: `Duplicated from ${source.id}`,
          createdById: actorId,
        },
      });

      await tx.advertisementHistory.create({
        data: {
          advertisementId: created.id,
          action: "duplicated",
          toStatus: "DRAFT",
          metadata: { duplicatedFromId: source.id },
          actorId,
        },
      });

      return created;
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.advertisementDuplicated,
      entity: "Advertisement",
      entityId: duplicated.id,
      agencyId,
      actorId,
      metadata: { duplicatedFromId: source.id },
    });

    return duplicated;
  },

  async listVersions(id: string, agencyId: string) {
    await advertisementService.getById(id, agencyId, true);
    return advertisementVersionRepository.listByAdvertisement(id);
  },

  async listHistory(id: string, agencyId: string) {
    await advertisementService.getById(id, agencyId, true);
    return advertisementHistoryRepository.listByAdvertisement(id);
  },
};
