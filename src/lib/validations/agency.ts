import { z } from "zod";

/**
 * Agency Registration — Screen 2
 *
 * Required:
 * - Agency Name
 * - Registration Number
 * - Official Website
 * - Official Email
 * - Logo
 *
 * Secondary Logo is optional.
 */
export const registerAgencySchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Agency name must be at least 2 characters",
      )
      .max(
        120,
        "Agency name is too long",
      ),

    registrationNumber: z
      .string()
      .trim()
      .min(
        3,
        "Registration number is required",
      )
      .max(
        60,
        "Registration number is too long",
      )
      .regex(
        /^[A-Za-z0-9/_+-]+$/,
        "Registration number can only contain letters, numbers, - / _ +",
      ),

    website: z
      .string()
      .trim()
      .min(
        1,
        "Company website is required",
      )
      .url(
        "Enter a valid website URL, e.g. https://youragency.com",
      ),

    officialEmail: z
      .string()
      .trim()
      .toLowerCase()
      .min(
        1,
        "Official business email is required",
      )
      .email(
        "Enter a valid email address",
      ),

    logoUrl: z
      .string()
      .min(
        1,
        "Agency logo is required",
      ),

    secondaryLogoUrl: z
      .string()
      .optional()
      .or(
        z.literal(""),
      ),
  });

export type RegisterAgencyInput =
  z.infer<
    typeof registerAgencySchema
  >;

/**
 * Agency Profile
 *
 * Agency-owned fields:
 * - logo
 * - secondary / ISO logo
 * - official contact
 * - registered office
 * - permanent approved brand claims
 *
 * Admin-controlled fields remain OUTSIDE this schema:
 * - agency name
 * - RC / MEA registration number
 * - verification status
 * - QR verification destination
 */
export const updateAgencyProfileSchema =
  z.object({
    logoUrl: z
      .string()
      .url()
      .optional()
      .or(
        z.literal(""),
      ),

    secondaryLogoUrl:
      z
        .string()
        .url()
        .optional()
        .or(
          z.literal(""),
        ),

    contactPerson:
      z
        .string()
        .trim()
        .max(
          120,
        )
        .optional()
        .or(
          z.literal(""),
        ),

    phone:
      z
        .string()
        .trim()
        .max(
          40,
        )
        .optional()
        .or(
          z.literal(""),
        ),

    whatsapp:
      z
        .string()
        .trim()
        .max(
          40,
        )
        .optional()
        .or(
          z.literal(""),
        ),

    officialEmail:
      z
        .string()
        .trim()
        .toLowerCase()
        .email()
        .optional()
        .or(
          z.literal(""),
        ),

    website:
      z
        .string()
        .trim()
        .max(
          200,
        )
        .optional()
        .or(
          z.literal(""),
        ),

    officeAddress:
      z
        .string()
        .trim()
        .max(
          300,
        )
        .optional()
        .or(
          z.literal(""),
        ),

    /**
     * Permanent approved agency credentials.
     *
     * Example:
     * [
     *   "ISO 9001:2015",
     *   "Since 1984"
     * ]
     */
    brandBadges:
      z
        .array(
          z
            .string()
            .trim()
            .min(
              1,
            )
            .max(
              120,
            ),
        )
        .max(
          10,
        )
        .optional(),

    brandColours:
      z
        .record(
          z.string(),
          z.string(),
        )
        .optional(),

    socialLinks:
      z
        .record(
          z.string(),
          z.string(),
        )
        .optional(),
  });

export type UpdateAgencyProfileInput =
  z.infer<
    typeof updateAgencyProfileSchema
  >;

export const approveAgencySchema =
  z.object({
    agencyId:
      z.string().min(1),

    reason:
      z
        .string()
        .max(
          500,
        )
        .optional(),
  });

export const rejectAgencySchema =
  z.object({
    agencyId:
      z.string().min(1),

    reason:
      z
        .string()
        .min(
          3,
          "A rejection reason is required",
        )
        .max(
          500,
        ),
  });

export const suspendAgencySchema =
  z.object({
    agencyId:
      z.string().min(1),

    reason:
      z
        .string()
        .min(
          3,
          "A suspension reason is required",
        )
        .max(
          500,
        ),
  });

export const activateAgencySchema =
  z.object({
    agencyId:
      z.string().min(1),

    reason:
      z
        .string()
        .max(
          500,
        )
        .optional(),
  });

export const grantGenerationQuotaSchema =
  z.object({
    agencyId:
      z.string().min(1),

    amount:
      z
        .coerce
        .number()
        .int()
        .min(1)
        .max(
          100000,
        ),

    reason:
      z
        .string()
        .max(
          500,
        )
        .optional(),
  });

export type GrantGenerationQuotaInput =
  z.infer<
    typeof grantGenerationQuotaSchema
  >;
