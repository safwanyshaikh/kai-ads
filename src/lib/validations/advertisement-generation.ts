import { z } from "zod";
import { advertisementStyleSchema } from "./advertisement";

/**
 * What the tenant asked to be produced.
 *
 * Required, with no default. The generation panel used to send a
 * hidden `platformFormat: "generic_portrait"` on every request, which
 * is why the live application produced a social poster even for
 * agencies that wanted a newspaper classified: the DTP compositor was
 * built, tested and never reachable. The choice is now the user's, and
 * a request that does not carry one does not generate.
 */
export const advertisementOutputFormatSchema = z.enum([
  "DTP_BW",
  "DTP_COLOUR",
  "SOCIAL",
]);
export type AdvertisementOutputFormat = z.infer<typeof advertisementOutputFormatSchema>;

/** The bookable classified heights, in whole centimetres. */
export const dtpHeightCmSchema = z.union([
  z.literal(5), z.literal(6), z.literal(7), z.literal(8),
  z.literal(9), z.literal(10), z.literal(11), z.literal(12),
]);

export const generateAdvertisementSchema = z
  .object({
    outputFormat: advertisementOutputFormatSchema,
    /**
     * The purchased classified height. Omitted, the compositor
     * recommends one; supplied, it is honoured exactly — an agency
     * that bought a 6x8 cannot place a 6x10.
     */
    dtpHeightCm: dtpHeightCmSchema.optional(),
    /**
     * Social only. Still required for that path, because the existing
     * social pipeline is driven by it; it is simply no longer applied
     * to every advertisement regardless of what was asked for.
     */
    platformFormat: z.string().min(1).optional(),
    style: advertisementStyleSchema.optional(),
    theme: z.string().optional(),
    isUrgent: z.boolean().optional(),
  })
  .refine(
    (input) => input.outputFormat !== "SOCIAL" || Boolean(input.platformFormat),
    { message: "Platform format is required for social advertisements.", path: ["platformFormat"] },
  );
export type GenerateAdvertisementInput = z.infer<typeof generateAdvertisementSchema>;

