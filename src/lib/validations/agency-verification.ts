import { z } from "zod";

export const verifyAgencySchema = z.object({
  officialVerificationUrl: z.string().trim().url("Enter a valid verification URL"),
  evidenceReference: z.string().trim().max(300).optional(),
  licenseValidUntil: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),

  /**
   * Full verified registration identity (see VerifiedAgencyProfile in
   * src/server/generation/pipeline/types.ts). Admin-set, same as
   * officialVerificationUrl above — never self-service, since these are
   * exactly the trust-bearing fields the verification step exists to
   * confirm. Optional: verifying an agency doesn't require re-entering
   * these every time if they're already correct.
   */
  fullRegistrationNumber: z.string().trim().max(120).optional(),
  meaRegistrationText: z.string().trim().max(120).optional(),
  isoCertification: z.string().trim().max(120).optional(),
  isoLogoUrl: z.string().trim().url().optional().or(z.literal("")),
});


export const agencyVerificationStatusChangeSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
