import { z } from "zod";

/**
 * Agency Registration — Screen 2 (docs/001_FUNCTIONAL_SPECIFICATION.md)
 * Required: Agency Name, Registration Number, Official Website,
 * Official Email, Logo. Secondary Logo optional.
 */
export const registerAgencySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Agency name must be at least 2 characters")
    .max(120, "Agency name is too long"),

  // FIX-013: official Recruiting Agent registration numbers (e.g.
  // "RC-B1487/MUM/PART/1000+/9986/2022") legitimately include a "+" —
  // the licence-capacity-category segment ("1000+") — which the
  // original allow-list rejected, making it impossible to register the
  // full official format at all. No other characters were added.
  registrationNumber: z
    .string()
    .trim()
    .min(3, "Registration number is required")
    .max(60, "Registration number is too long")
    .regex(
      /^[A-Za-z0-9/_+-]+$/,
      "Registration number can only contain letters, numbers, - / _ +",
    ),

  website: z
    .string()
    .trim()
    .min(1, "Company website is required")
    .url("Enter a valid website URL, e.g. https://youragency.com"),

  officialEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Official business email is required")
    .email("Enter a valid email address"),

  logoUrl: z.string().min(1, "Agency logo is required"),
  secondaryLogoUrl: z.string().optional().or(z.literal("")),
});

export type RegisterAgencyInput = z.infer<typeof registerAgencySchema>;

/**
 * Agency Profile — the fields an agency owns and edits itself.
 *
 * Deliberately excludes name, registrationNumber (MEA licence),
 * verification status and QR destination: those are admin-controlled and
 * are what make the verification QR trustworthy. An agency that could
 * edit its own licence number could publish a false one.
 */
export const updateAgencyProfileSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  contactPerson: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  officialEmail: z.string().trim().email().optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  officeAddress: z.string().trim().max(300).optional().or(z.literal("")),
  brandColours: z.record(z.string(), z.string()).optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
});

export type UpdateAgencyProfileInput = z.infer<typeof updateAgencyProfileSchema>;

export const approveAgencySchema = z.object({
  agencyId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const rejectAgencySchema = z.object({
  agencyId: z.string().min(1),
  reason: z.string().min(3, "A rejection reason is required").max(500),
});

export const suspendAgencySchema = z.object({
  agencyId: z.string().min(1),
  reason: z.string().min(3, "A suspension reason is required").max(500),
});

export const activateAgencySchema = z.object({
  agencyId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const grantGenerationQuotaSchema = z.object({
  agencyId: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(100000),
  reason: z.string().max(500).optional(),
});
export type GrantGenerationQuotaInput = z.infer<typeof grantGenerationQuotaSchema>;
