import { z } from "zod";

export const verifyAgencySchema = z.object({
  officialVerificationUrl: z.string().trim().url("Enter a valid verification URL"),
  evidenceReference: z.string().trim().max(300).optional(),
  licenseValidUntil: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
});


export const agencyVerificationStatusChangeSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
