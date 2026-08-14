import { db } from "@/lib/db";
import type {
  Prisma,
  Agency,
} from "@prisma/client";

import {
  agencyRepository,
} from "@/server/repositories/agency.repository";

import {
  userRepository,
} from "@/server/repositories/user.repository";

import {
  auditLogService,
} from "@/server/services/audit-log.service";

import {
  emailService,
} from "@/server/services/email.service";

import {
  assertBusinessEmail,
} from "@/server/services/email-validation.service";

import {
  assertDomainIsAvailable,
} from "@/server/services/domain-validation.service";

import {
  AUDIT_ACTIONS,
} from "@/lib/constants";

import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";

import type {
  UpdateAgencyProfileInput,
} from "@/lib/validations/agency";

import {
  createLogger,
} from "@/lib/logger";

import {
  paginate,
  toSkipTake,
  type PaginationParams,
  type Paginated,
} from "@/lib/pagination";

import type {
  RegisterAgencyInput,
} from "@/lib/validations/agency";

const log =
  createLogger(
    "agency-service",
  );

export const agencyService = {
  /**
   * Registers a new agency:
   *
   * 1. Reject personal email domains.
   * 2. Reject duplicate registration number.
   * 3. Reject duplicate official email.
   * 4. Reject duplicate domain.
   * 5. Create Agency + Domain + first AGENCY_ADMIN user.
   * 6. Agency starts as PENDING.
   */
  async register(
    input: RegisterAgencyInput,
  ) {
    assertBusinessEmail(
      input.officialEmail,
    );

    const [
      existingByRegNumber,
      existingByEmail,
    ] = await Promise.all([
      agencyRepository.findByRegistrationNumber(
        input.registrationNumber,
      ),
      agencyRepository.findByOfficialEmail(
        input.officialEmail,
      ),
    ]);

    if (
      existingByRegNumber
    ) {
      throw new ConflictError(
        "An agency is already registered with this registration number.",
      );
    }

    if (
      existingByEmail
    ) {
      throw new ConflictError(
        "An agency is already registered with this official email.",
      );
    }

    const domain =
      await assertDomainIsAvailable(
        input.officialEmail,
      );

    const agency =
      await db.$transaction(
        async (
          tx: Prisma.TransactionClient,
        ) => {
          const createdAgency =
            await tx.agency.create({
              data: {
                name:
                  input.name,

                registrationNumber:
                  input.registrationNumber,

                website:
                  input.website,

                officialEmail:
                  input.officialEmail,

                logoUrl:
                  input.logoUrl,

                secondaryLogoUrl:
                  input.secondaryLogoUrl ||
                  null,

                status:
                  "PENDING",
              },
            });

          await tx.domain.create({
            data: {
              domain,
              agencyId:
                createdAgency.id,
            },
          });

          await tx.user.create({
            data: {
              name:
                input.name,

              email:
                input.officialEmail,

              role:
                "AGENCY_ADMIN",

              status:
                "PENDING",

              agencyId:
                createdAgency.id,
            },
          });

          return createdAgency;
        },
      );

    await auditLogService.record({
      action:
        AUDIT_ACTIONS.agencyRegistered,

      entity:
        "Agency",

      entityId:
        agency.id,

      agencyId:
        agency.id,

      metadata: {
        registrationNumber:
          agency.registrationNumber,

        domain,
      },
    });

    log.info(
      {
        agencyId:
          agency.id,
      },
      "Agency registered, pending approval",
    );

    return agency;
  },

  async listPending() {
    return agencyRepository.findMany({
      status: "PENDING",
    });
  },

  async listAll(
    params: {
      skip?: number;
      take?: number;
    } = {},
  ) {
    return agencyRepository.findMany(
      params,
    );
  },

  async listAllPaginated(
    pagination: PaginationParams,
  ): Promise<
    Paginated<Agency>
  > {
    const {
      skip,
      take,
    } =
      toSkipTake(
        pagination,
      );

    const [
      data,
      total,
    ] =
      await Promise.all([
        agencyRepository.findMany({
          skip,
          take,
        }),

        agencyRepository.count(
          {},
        ),
      ]);

    return paginate(
      data,
      total,
      pagination,
    );
  },

  async getById(
    id: string,
  ) {
    const agency =
      await agencyRepository.findById(
        id,
      );

    if (!agency) {
      throw new NotFoundError(
        "Agency",
      );
    }

    return agency;
  },

  /**
   * Agency Profile update.
   *
   * Agency-owned fields:
   *
   * - logo
   * - secondary / ISO logo
   * - official contact
   * - registered address
   * - permanent brand badges
   * - brand colours
   * - social links
   *
   * Admin-controlled fields remain protected:
   *
   * - agency name
   * - RC / MEA licence number
   * - verification status
   * - verification QR destination
   */
  async updateProfile(
    agencyId: string,
    actorId: string,
    input: UpdateAgencyProfileInput,
  ) {
    const blank =
      (
        value?: string,
      ) =>
        value === undefined
          ? undefined
          : value.trim() === ""
            ? null
            : value.trim();

    /**
     * IMPORTANT:
     *
     * brandBadges is agency-owned permanent
     * credential information.
     *
     * It is stored separately from:
     *
     * - campaign benefits
     * - interview data
     * - campaign contact
     *
     * Therefore it can be reused by the
     * verified agency trust layer.
     */
    const updated =
      await db.agency.update({
        where: {
          id: agencyId,
        },

        data: {
          logoUrl:
            input.logoUrl
              ?.trim()
              ? input.logoUrl.trim()
              : undefined,

          secondaryLogoUrl:
            input.secondaryLogoUrl
              ?.trim()
              ? input.secondaryLogoUrl.trim()
              : null,

          officialEmail:
            input.officialEmail
              ?.trim()
              ? input.officialEmail.trim()
              : undefined,

          website:
            input.website
              ?.trim()
              ? input.website.trim()
              : undefined,

          contactPerson:
            blank(
              input.contactPerson,
            ),

          phone:
            blank(
              input.phone,
            ),

          whatsapp:
            blank(
              input.whatsapp,
            ),

          officeAddress:
            blank(
              input.officeAddress,
            ),

          brandBadges:
            input.brandBadges ??
            undefined,

          brandColours:
            input.brandColours ??
            undefined,

          socialLinks:
            input.socialLinks ??
            undefined,
        },
      });

    await auditLogService.record({
      action:
        AUDIT_ACTIONS.agencyProfileUpdated,

      agencyId,

      actorId,

      entity:
        "Agency",

      entityId:
        agencyId,

      metadata: {
        updatedFields: [
          "logoUrl",
          "secondaryLogoUrl",
          "officialEmail",
          "website",
          "contactPerson",
          "phone",
          "whatsapp",
          "officeAddress",
          "brandBadges",
          "brandColours",
          "socialLinks",
        ],
      },
    });

    return updated;
  },

  async approve(
    agencyId: string,
    actorId: string,
    reason?: string,
  ) {
    const agency =
      await agencyService.getById(
        agencyId,
      );

    const updated =
      await db.$transaction(
        async (
          tx: Prisma.TransactionClient,
        ) => {
          const result =
            await tx.agency.update({
              where: {
                id: agencyId,
              },

              data: {
                status:
                  "APPROVED",
              },
            });

          await tx.user.updateMany({
            where: {
              agencyId,
              role:
                "AGENCY_ADMIN",
            },

            data: {
              status:
                "ACTIVE",
            },
          });

          await tx.approval.create({
            data: {
              targetType:
                "AGENCY",

              targetId:
                agencyId,

              decision:
                "APPROVE",

              reason,

              agencyId,

              actorId,
            },
          });

          return result;
        },
      );

    await auditLogService.record({
      action:
        AUDIT_ACTIONS.agencyApproved,

      entity:
        "Agency",

      entityId:
        agencyId,

      agencyId,

      actorId,

      metadata: {
        reason,
      },
    });

    await emailService
      .sendAgencyApproved(
        agency.officialEmail,
        agency.name,
      )
      .catch(
        (err) =>
          log.warn(
            {
              err,
            },
            "Could not send agency-approved email",
          ),
      );

    return updated;
  },

  async reject(
    agencyId: string,
    actorId: string,
    reason?: string,
  ) {
    if (
      !reason ||
      reason.trim()
        .length < 3
    ) {
      throw new ConflictError(
        "A rejection reason is required.",
      );
    }

    const agency =
      await agencyService.getById(
        agencyId,
      );

    const updated =
      await db.$transaction(
        async (
          tx: Prisma.TransactionClient,
        ) => {
          const result =
            await tx.agency.update({
              where: {
                id: agencyId,
              },

              data: {
                status:
                  "REJECTED",
              },
            });

          await tx.approval.create({
            data: {
              targetType:
                "AGENCY",

              targetId:
                agencyId,

              decision:
                "REJECT",

              reason,

              agencyId,

              actorId,
            },
          });

          return result;
        },
      );

    await auditLogService.record({
      action:
        AUDIT_ACTIONS.agencyRejected,

      entity:
        "Agency",

      entityId:
        agencyId,

      agencyId,

      actorId,

      metadata: {
        reason,
      },
    });

    await emailService
      .sendAgencyRejected(
        agency.officialEmail,
        agency.name,
        reason,
      )
      .catch(
        (err) =>
          log.warn(
            {
              err,
            },
            "Could not send agency-rejected email",
          ),
      );

    return updated;
  },

  async suspend(
    agencyId: string,
    actorId: string,
    reason?: string,
  ) {
    if (
      !reason ||
      reason.trim()
        .length < 3
    ) {
      throw new ConflictError(
        "A suspension reason is required.",
      );
    }

    await agencyService.getById(
      agencyId,
    );

    const updated =
      await db.$transaction(
        async (
          tx: Prisma.TransactionClient,
        ) => {
          const result =
            await tx.agency.update({
              where: {
                id: agencyId,
              },

              data: {
                status:
                  "SUSPENDED",
              },
            });

          await tx.approval.create({
            data: {
              targetType:
                "AGENCY",

              targetId:
                agencyId,

              decision:
                "SUSPEND",

              reason,

              agencyId,

              actorId,
            },
          });

          return result;
        },
      );

    await auditLogService.record({
      action:
        AUDIT_ACTIONS.agencySuspended,

      entity:
        "Agency",

      entityId:
        agencyId,

      agencyId,

      actorId,

      metadata: {
        reason,
      },
    });

    return updated;
  },

  async activate(
    agencyId: string,
    actorId: string,
    reason?: string,
  ) {
    await agencyService.getById(
      agencyId,
    );

    const updated =
      await db.$transaction(
        async (
          tx: Prisma.TransactionClient,
        ) => {
          const result =
            await tx.agency.update({
              where: {
                id: agencyId,
              },

              data: {
                status:
                  "APPROVED",
              },
            });

          await tx.approval.create({
            data: {
              targetType:
                "AGENCY",

              targetId:
                agencyId,

              decision:
                "ACTIVATE",

              reason,

              agencyId,

              actorId,
            },
          });

          return result;
        },
      );

    await auditLogService.record({
      action:
        AUDIT_ACTIONS.agencyActivated,

      entity:
        "Agency",

      entityId:
        agencyId,

      agencyId,

      actorId,

      metadata: {
        reason,
      },
    });

    return updated;
  },

  async listEmployees(
    agencyId: string,
  ) {
    return userRepository.listByAgency(
      agencyId,
    );
  },

  async listEmployeesPaginated(
    agencyId: string,
    pagination: PaginationParams,
  ) {
    const {
      skip,
      take,
    } =
      toSkipTake(
        pagination,
      );

    const [
      data,
      total,
    ] =
      await Promise.all([
        userRepository.listByAgencyPaginated(
          agencyId,
          skip,
          take,
        ),

        userRepository.countByAgency(
          agencyId,
        ),
      ]);

    return paginate(
      data,
      total,
      pagination,
    );
  },
};
