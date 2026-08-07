import { z } from "zod";

/**
 * Task 006.5 — RUN PIPELINE request body. Deliberately reuses the exact
 * same source-type enum as Task 002's createDraftSchema (src/lib/validations/
 * advertisement-draft.ts) rather than defining a new one, since FAT creates
 * a real AdvertisementDraft under the hood and must stay valid against that
 * same column.
 */
export const fatRunSchema = z.object({
  sourceType: z.enum(["PASTE_TEXT", "PDF", "DOCX", "IMAGE", "WHATSAPP_SCREENSHOT"]),
  rawText: z.string().trim().max(20000).optional(),
  sourceFileUrl: z.string().max(2000).optional(),
  instructions: z.string().trim().max(4000).optional(),
  sourceLabel: z.string().trim().max(255).optional(),
});
export type FatRunInput = z.infer<typeof fatRunSchema>;

export const fatGenerateSchema = z.object({
  advertisementId: z.string().min(1),
  platformFormat: z.string().default("generic_square"),
});
