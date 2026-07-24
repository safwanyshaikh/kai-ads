-- AlterTable: advertisement_drafts — ChatGPT-style composer (Supreme
-- Constitution Principle 12). Additive only: rawText/sourceFileUrl are kept
-- untouched so every existing draft (and the legacy single-source create
-- path) keeps working unchanged.
ALTER TABLE "advertisement_drafts" ADD COLUMN "attachments" JSONB;
ALTER TABLE "advertisement_drafts" ADD COLUMN "instructions" TEXT;
