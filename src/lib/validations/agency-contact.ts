import { z } from "zod";

export const upsertContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  mobile: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
});
export type UpsertContactInput = z.infer<typeof upsertContactSchema>;
