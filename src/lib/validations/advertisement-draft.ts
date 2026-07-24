import { z } from "zod";
import { advertisementStyleSchema } from "./advertisement";
import { stripInvalidPostgresChars } from "@/lib/sanitize-text";

const draftSourceTypeSchema = z.enum([
  "PASTE_TEXT",
  "PDF",
  "DOCX",
  "IMAGE",
  "WHATSAPP_SCREENSHOT",
]);

/**
 * One staged attachment from the ChatGPT-style composer. `sourceType`
 * reuses the existing per-file enum values — deliberately NO "MIXED"
 * member: a draft's own sourceType stays a real file kind (the FIRST
 * attachment's), or PASTE_TEXT when the draft is text-only, so every
 * existing consumer of AdvertisementDraftSourceType (DB enum, engine,
 * audit metadata) keeps working without a schema-wide new value.
 */
const draftAttachmentSchema = z.object({
  url: z.string().url().max(2000),
  sourceType: draftSourceTypeSchema.exclude(["PASTE_TEXT"]),
  fileName: z.string().max(255),
  mimeType: z.string().max(100),
});
export type DraftAttachmentInput = z.infer<typeof draftAttachmentSchema>;

/**
 * Create Advertisement — the single ChatGPT-style composer (Supreme
 * Constitution Principle 12). A draft is valid when it has ANY of:
 * rawText, instructions, or at least one attachment. The original
 * single-source rules are preserved verbatim for back-compat: PASTE_TEXT
 * with no attachments still needs 10+ chars of text, and a file
 * sourceType with no attachments still needs sourceFileUrl — enforced by
 * .superRefine below rather than a discriminated union, so the error
 * message can be specific to which one is missing.
 */
export const createDraftSchema = z
  .object({
    sourceType: draftSourceTypeSchema,
    // Sprint 006 Bug 006: sanitized here, at the validation boundary, so
    // every caller of this schema automatically gets text Postgres can
    // actually store — a pasted email (rich-text paste from Outlook/Word)
    // is the realistic source of a stray NUL/control character.
    rawText: z.string().trim().max(20000).transform(stripInvalidPostgresChars).optional(),
    sourceFileUrl: z.string().max(2000).optional(),
    // Composer: free-typed guidance alongside attachments. Same sanitize
    // rationale as rawText — this is typed/pasted straight into a textarea.
    instructions: z.string().trim().max(4000).transform(stripInvalidPostgresChars).optional(),
    attachments: z.array(draftAttachmentSchema).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    const attachments = data.attachments ?? [];

    if (attachments.length > 0) {
      // Composer rule: the draft's sourceType mirrors the FIRST
      // attachment (see draftAttachmentSchema comment for why there is
      // no "MIXED" value). rawText/instructions may accompany freely.
      if (data.sourceType !== attachments[0].sourceType) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceType"],
          message: "With attachments, sourceType must match the first attachment.",
        });
      }
      return;
    }

    if (data.sourceType === "PASTE_TEXT") {
      // Text-only composer submit: rawText (a pasted requirement) or
      // instructions (typed guidance) each count as valid input.
      if ((!data.rawText || data.rawText.length < 10) && !data.instructions) {
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
