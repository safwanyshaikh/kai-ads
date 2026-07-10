import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { userRepository } from "@/server/repositories/user.repository";
import { joinRequestRepository } from "@/server/repositories/join-request.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { emailService } from "@/server/services/email.service";
import { assertBusinessEmail } from "@/server/services/email-validation.service";
import { resolveAgencyByEmailDomain } from "@/server/services/domain-validation.service";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { paginate, toSkipTake, type PaginationParams } from "@/lib/pagination";
import type { CreateJoinRequestInput } from "@/lib/validations/join-request";

export const joinRequestService = {
  /**
   * Employee Join Request:
   *  1. Reject personal email
   *  2. Detect agency from email domain
   *  3. Create (or reuse) PENDING user + JoinRequest
   *  4. Requires Agency Admin approval before ACTIVE
   */
  async create(input: CreateJoinRequestInput) {
    assertBusinessEmail(input.email);

    const agency = await resolveAgencyByEmailDomain(input.email);
    if (agency.status !== "APPROVED") {
      throw new ConflictError(
        "This agency is not yet active. You cannot join it right now.",
      );
    }

    let user = await userRepository.findByEmail(input.email);

    if (user && user.status === "ACTIVE") {
      throw new ConflictError("You already have an active account. Please sign in.");
    }

    if (!user) {
      user = await userRepository.create({
        name: input.name,
        email: input.email,
        role: "AGENCY_USER",
        status: "PENDING",
        agency: { connect: { id: agency.id } },
      });
    }

    const existingPending = await joinRequestRepository.findPendingByUser(user.id);
    if (existingPending) {
      throw new ConflictError("You already have a pending join request.");
    }

    const joinRequest = await joinRequestRepository.create(user.id, agency.id);

    await auditLogService.record({
      action: AUDIT_ACTIONS.joinRequestCreated,
      entity: "JoinRequest",
      entityId: joinRequest.id,
      agencyId: agency.id,
      actorId: user.id,
      metadata: { email: input.email },
    });

    return { joinRequest, agency };
  },

  async listForAgency(agencyId: string) {
    return joinRequestRepository.listByAgency(agencyId, "PENDING");
  },

  async listForAgencyPaginated(agencyId: string, pagination: PaginationParams) {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await Promise.all([
      joinRequestRepository.listByAgencyPaginated(agencyId, "PENDING", skip, take),
      joinRequestRepository.countByAgency(agencyId, "PENDING"),
    ]);
    return paginate(data, total, pagination);
  },

  async approve(joinRequestId: string, actorId: string) {
    const request = await joinRequestRepository.findById(joinRequestId);
    if (!request) throw new NotFoundError("Join request");
    if (request.status !== "PENDING") {
      throw new ConflictError("This join request has already been reviewed.");
    }

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.joinRequest.update({
        where: { id: joinRequestId },
        data: { status: "APPROVED", reviewedById: actorId, reviewedAt: new Date() },
      });
      await tx.user.update({
        where: { id: request.userId },
        data: { status: "ACTIVE" },
      });
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.joinRequestApproved,
      entity: "JoinRequest",
      entityId: joinRequestId,
      agencyId: request.agencyId,
      actorId,
    });

    await emailService
      .sendJoinRequestDecision(request.user.email, true, request.agency.name)
      .catch(() => undefined);

    return request;
  },

  async reject(joinRequestId: string, actorId: string) {
    const request = await joinRequestRepository.findById(joinRequestId);
    if (!request) throw new NotFoundError("Join request");
    if (request.status !== "PENDING") {
      throw new ConflictError("This join request has already been reviewed.");
    }

    await joinRequestRepository.updateStatus(joinRequestId, "REJECTED", actorId);

    await auditLogService.record({
      action: AUDIT_ACTIONS.joinRequestRejected,
      entity: "JoinRequest",
      entityId: joinRequestId,
      agencyId: request.agencyId,
      actorId,
    });

    await emailService
      .sendJoinRequestDecision(request.user.email, false, request.agency.name)
      .catch(() => undefined);

    return request;
  },
};
