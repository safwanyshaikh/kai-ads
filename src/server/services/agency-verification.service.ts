import { agencyVerificationRepository } from "@/server/repositories/agency-verification.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { NotFoundError } from "@/lib/errors";
import { AUDIT_ACTIONS } from "@/lib/constants";
import type { AgencyVerificationStatus } from "@prisma/client";

/**
 * Agency Verification Workflow (Sprint 004). Only reachable via routes
 * gated on the "agency:verify" permission (KAI_SUPER_ADMIN only — see
 * src/lib/rbac.ts). Every action is audit-logged, reusing the Sprint 001
 * AuditLog rather than a parallel table.
 */
export const agencyVerificationService = {
  async getStatus(agencyId: string) {
    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");
    return agencyVerificationRepository.findByAgencyId(agencyId);
  },

  async listAll() {
    return agencyVerificationRepository.listAll();
  },

  async verify(
    agencyId: string,
    actorId: string,
    input: {
      officialVerificationUrl: string;
      evidenceReference?: string;
      licenseValidUntil?: Date;
      notes?: string;
    },
  ) {
    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const verification = await agencyVerificationRepository.upsert(agencyId, {
      status: "VERIFIED",
      officialVerificationUrl: input.officialVerificationUrl,
      verificationDate: new Date(),
      verifiedBy: { connect: { id: actorId } },
      evidenceReference: input.evidenceReference,
      licenseValidUntil: input.licenseValidUntil,
      reverificationRequired: false,
      notes: input.notes,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.agencyVerificationVerified,
      entity: "AgencyVerification",
      entityId: verification.id,
      agencyId,
      actorId,
      metadata: { officialVerificationUrl: input.officialVerificationUrl },
    });

    return verification;
  },

  async setStatus(
    agencyId: string,
    actorId: string,
    status: Extract<AgencyVerificationStatus, "SUSPENDED" | "REVERIFICATION_REQUIRED" | "UNVERIFIED">,
    notes?: string,
  ) {
    const agency = await agencyRepository.findById(agencyId);
    if (!agency) throw new NotFoundError("Agency");

    const verification = await agencyVerificationRepository.upsert(agencyId, {
      status,
      reverificationRequired: status === "REVERIFICATION_REQUIRED",
      notes,
    });

    const actionMap: Record<string, string> = {
      SUSPENDED: AUDIT_ACTIONS.agencyVerificationSuspended,
      REVERIFICATION_REQUIRED: AUDIT_ACTIONS.agencyVerificationReverificationRequired,
      UNVERIFIED: AUDIT_ACTIONS.agencyVerificationReverificationRequired,
    };

    await auditLogService.record({
      action: actionMap[status] ?? AUDIT_ACTIONS.agencyVerificationReverificationRequired,
      entity: "AgencyVerification",
      entityId: verification.id,
      agencyId,
      actorId,
      metadata: { notes },
    });

    return verification;
  },

  async restore(agencyId: string, actorId: string) {
    return agencyVerificationService.setStatus(
      agencyId,
      actorId,
      "REVERIFICATION_REQUIRED",
      "Restored from suspension — reverification required before VERIFIED status resumes.",
    );
  },
};
