import { z } from "zod";
import { advertisementStyleSchema } from "./advertisement";

const draftSourceTypeSchema = z.enum([
  "PASTE_TEXT",
  "PDF",
  "DOCX",
  "IMAGE",
  "WHATSAPP_SCREENSHOT",
]);

/**
 * Create Advertisement — Screen: choose an input method.
 * Exactly one of rawText / sourceFileUrl is expected, enforced by
 * .superRefine below rather than a discriminated union, so the error
 * message can be specific to which one is missing.
 */
export const createDraftSchema = z
  .object({
    sourceType: draftSourceTypeSchema,
    rawText: z.string().trim().max(20000).optional(),
    sourceFileUrl: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "PASTE_TEXT") {
      if (!data.rawText || data.rawText.length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["rawText"],
          message: "Paste at least 10 characters of requirement text.",
        });
      }
    } else if (!data.sourceFileUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceFileUrl"],
        message: "Upload a file before continuing.",
      });
    }
  });
export type CreateDraftInput = z.infer<typeof createDraftSchema>;

/** AI Extraction Review — the recruiter's edited/approved data. Same shape as the Advertisement content blocks. */
export const reviewDraftSchema = z.object({
  reviewedData: z.record(z.string(), z.unknown()),
});

/** Style Selection — store only. */
export const selectDraftStyleSchema = z.object({
  style: advertisementStyleSchema,
});
