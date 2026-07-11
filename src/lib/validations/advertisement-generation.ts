import { z } from "zod";
import { advertisementStyleSchema } from "./advertisement";

export const generateAdvertisementSchema = z.object({
  platformFormat: z.string().min(1, "Platform format is required"),
  style: advertisementStyleSchema.optional(),
  isUrgent: z.boolean().optional(),
});
export type GenerateAdvertisementInput = z.infer<typeof generateAdvertisementSchema>;

const advertisementSectionSchema = z.enum([
  "HEADER",
  "COUNTRY_INDUSTRY",
  "POSITIONS",
  "BENEFITS",
  "INTERVIEW",
  "CONTACT",
  "AGENCY_FOOTER",
]);

export const regenerateSectionSchema = z.object({
  section: advertisementSectionSchema,
  data: z.record(z.string(), z.unknown()),
  method: z.enum(["AI_REGENERATED", "MANUAL_EDIT"]).default("MANUAL_EDIT"),
  reason: z.string().trim().max(300).optional(),
});

