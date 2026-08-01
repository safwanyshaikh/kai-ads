import { z } from "zod";
import { advertisementStyleSchema } from "./advertisement";

/** The five production Design DNA packs (src/server/generation/dna/packs). */
export const dnaPackSchema = z.enum([
  "PREMIUM_SOCIAL",
  "ASSIGNMENT_ABROAD_DTP",
  "CORPORATE_PREMIUM",
  "CONSTRUCTION",
  "OIL_AND_GAS",
]);

export const generateAdvertisementSchema = z.object({
  platformFormat: z.string().min(1, "Platform format is required"),
  style: advertisementStyleSchema.optional(),
  theme: z.string().optional(),
  isUrgent: z.boolean().optional(),
  /**
   * A specific Design DNA, when the recruiter has chosen one. Omitted
   * means KAI selects it from the shape of the requirement — which is the
   * normal path, because a recruiter should not have to be a designer.
   */
  designDnaId: z.string().min(1).optional(),
  /** A pack preference, when the recruiter wants a look but not a specific design. */
  designPack: dnaPackSchema.optional(),
  /** Print or newspaper destination — forces the classified composition. */
  printOrNewspaper: z.boolean().optional(),
});
export type GenerateAdvertisementInput = z.infer<typeof generateAdvertisementSchema>;

