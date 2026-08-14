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
  agencyVerificationService,
} from "@/server/services/agency-verification.service";

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
  RegisterAgencyInput,
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

const log =
  createLogger(
    "agency-service",
  );

export const agencyService = {
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
   * Trust-sensitive changes automatically invalidate
   * an existing VERIFIED agency profile and require
   * Super Admin reverification.
   */
  async updateProfile(
    agencyId: string,
    actorId: string,
    input: UpdateAgencyProfileInput,
  ) {
    const currentAgency =
      await agencyService.getById(
        agencyId,
      );

    const currentVerification =
      await agencyVerificationService.getStatus(
        agencyId,
      );

    const blank = (
      value?: string,
    ) =>
      value === undefined
        ? undefined
        : value.trim() === ""
          ? null
          : value.trim();

    /**
     * logoUrl is required by Prisma.
     *
     * Never write null.
     *
     * If the caller does not provide it,
     * leave the existing value untouched.
     */
    const nextLogoUrl =
      input.logoUrl ===
      undefined
        ? currentAgency.logoUrl
        : input.logoUrl.trim()
            ? input.logoUrl.trim()
            : currentAgency.logoUrl;

    const nextSecondaryLogoUrl =
      input.secondaryLogoUrl ===
      undefined
        ? currentAgency.secondaryLogoUrl
        : input.secondaryLogoUrl
            .trim() ||
          null;

    const nextOfficialEmail =
      input.officialEmail ===
      undefined
        ? currentAgency.officialEmail
        : input.officialEmail
            .trim() ||
          currentAgency.officialEmail;

    const nextWebsite =
      input.website ===
      undefined
        ? currentAgency.website
        : input.website
            .trim() ||
          currentAgency.website;

    const nextContactPerson =
      input.contactPerson ===
      undefined
        ? currentAgency.contactPerson
        : blank(
            input.contactPerson,
          );

    const nextPhone =
      input.phone ===
      undefined
        ? currentAgency.phone
        : blank(
            input.phone,
          );

    const nextWhatsapp =
      input.whatsapp ===
      undefined
        ? currentAgency.whatsapp
        : blank(
            input.whatsapp,
          );

    const nextOfficeAddress =
      input.officeAddress ===
      undefined
        ? currentAgency.officeAddress
        : blank(
            input.officeAddress,
          );

    const nextBrandBadges =
      input.brandBadges ===
      undefined
        ? currentAgency.brandBadges
        : input.brandBadges;

    const nextBrandColours =
      input.brandColours ===
      undefined
        ? currentAgency.brandColours
        : input.brandColours;

    const nextSocialLinks =
      input.socialLinks ===
      undefined
        ? currentAgency.socialLinks
        : input.socialLinks;

    const trustIdentityChanged =
      currentAgency.logoUrl !==
        nextLogoUrl ||

      currentAgency.secondaryLogoUrl !==
        nextSecondaryLogoUrl ||

      currentAgency.officialEmail !==
        nextOfficialEmail ||

      currentAgency.website !==
        nextWebsite ||

      currentAgency.contactPerson !==
        nextContactPerson ||

      currentAgency.phone !==
        nextPhone ||

      currentAgency.whatsapp !==
        nextWhatsapp ||

      currentAgency.officeAddress !==
        nextOfficeAddress ||

      JSON.stringify(
        currentAgency.brandBadges ??
          null,
      ) !==
        JSON.stringify(
          nextBrandBadges ??
            null,
        ) ||

      JSON.stringify(
        currentAgency.brandColours ??
          null,
      ) !==
        JSON.stringify(
          nextBrandColours ??
            null,
        ) ||

      JSON.stringify(
        currentAgency.socialLinks ??
          null,
      ) !==
        JSON.stringify(
          nextSocialLinks ??
            null,
        );

    const updated =
      await db.agency.update({
        where: {
          id: agencyId,
        },

        data: {
          /**
           * Required string field.
           */
          logoUrl:
            input.logoUrl ===
            undefined
              ? undefined
              : nextLogoUrl,

          /**
           * Nullable string field.
           */
          secondaryLogoUrl:
            input.secondaryLogoUrl ===
            undefined
              ? undefined
              : nextSecondaryLogoUrl,

          /**
           * Required string fields.
           * Preserve existing values when
           * caller does not provide them.
           */
          officialEmail:
            input.officialEmail ===
            undefined
              ? undefined
              : nextOfficialEmail,

          website:
            input.website ===
            undefined
              ? undefined
              : nextWebsite,

          contactPerson:
            input.contactPerson ===
            undefined
              ? undefined
              : nextContactPerson,

          phone:
            input.phone ===
            undefined
              ? undefined
              : nextPhone,

          whatsapp:
            input.whatsapp ===
            undefined
              ? undefined
              : nextWhatsapp,

          officeAddress:
            input.officeAddress ===
            undefined
              ? undefined
              : nextOfficeAddress,

          /**
           * JSON fields.
           *
           * IMPORTANT:
           *
           * When the caller does not supply the field,
           * OMIT the Prisma property completely.
           *
           * This preserves the existing database value
           * and avoids passing JsonValue | null where Prisma
           * expects InputJsonValue.
           */
          brandBadges:
            input.brandBadges ===
            undefined
              ? undefined
              : input.brandBadges,

          brandColours:
            input.brandColours ===
            undefined
              ? undefined
              : input.brandColours,

          socialLinks:
            input.socialLinks ===
            undefined
              ? undefined
              : input.socialLinks,
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

    /**
     * VERIFIED → REVERIFICATION REQUIRED
     *
     * Only when an actual trust-sensitive identity
     * field changed.
     */
    if (
      currentVerification?.status ===
        "VERIFIED" &&
      trustIdentityChanged
    ) {
      await agencyVerificationService
        .setStatus(
          agencyId,
          actorId,
          "REVERIFICATION_REQUIRED",
          "Agency trust identity changed. Super Admin reverification is required before the updated agency profile is treated as verified.",
        );
    }

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
      reason.trim().length <
        3
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
      reason.trim().length <
        3
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
