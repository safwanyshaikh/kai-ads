import { agencyContactRepository } from "@/server/repositories/agency-contact.repository";
import { auditLogService } from "@/server/services/audit-log.service";
import { NotFoundError, AppError } from "@/lib/errors";
import { AUDIT_ACTIONS } from "@/lib/constants";
import type { UpsertContactInput } from "@/lib/validations/agency-contact";

/**
 * Contact Directory (Sprint 003): "Do not ask the recruiter to type
 * contact information repeatedly." Every method is agency-scoped —
 * selecting a saved contact never crosses tenant boundaries.
 */
export const agencyContactService = {
  async create(agencyId: string, actorId: string, input: UpsertContactInput) {
    if (!input.mobile && !input.whatsapp && !input.email) {
      throw new AppError("Add at least one way to reach this contact (mobile, WhatsApp, or email).", 400);
    }

    const contact = await agencyContactRepository.create({
      agency: { connect: { id: agencyId } },
      createdBy: { connect: { id: actorId } },
      name: input.name,
      mobile: input.mobile || null,
      whatsapp: input.whatsapp || null,
      email: input.email || null,
      designation: input.designation || null,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.agencyContactCreated,
      entity: "AgencyContact",
      entityId: contact.id,
      agencyId,
      actorId,
    });

    return contact;
  },

  async list(agencyId: string) {
    return agencyContactRepository.listByAgency(agencyId);
  },

  async update(id: string, agencyId: string, actorId: string, input: UpsertContactInput) {
    const existing = await agencyContactRepository.findById(id, agencyId);
    if (!existing) throw new NotFoundError("Contact");

    const updated = await agencyContactRepository.update(id, {
      name: input.name,
      mobile: input.mobile || null,
      whatsapp: input.whatsapp || null,
      email: input.email || null,
      designation: input.designation || null,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.agencyContactUpdated,
      entity: "AgencyContact",
      entityId: id,
      agencyId,
      actorId,
    });

    return updated;
  },

  async remove(id: string, agencyId: string, actorId: string) {
    const existing = await agencyContactRepository.findById(id, agencyId);
    if (!existing) throw new NotFoundError("Contact");

    const updated = await agencyContactRepository.softDelete(id);

    await auditLogService.record({
      action: AUDIT_ACTIONS.agencyContactDeleted,
      entity: "AgencyContact",
      entityId: id,
      agencyId,
      actorId,
    });

    return updated;
  },
};
