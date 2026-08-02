-- Requirement Intelligence (Task 002).
--
-- Task 002's binding rule: "Every extracted field must include Source,
-- Confidence and Reason. Every AI decision must be explainable."
--
-- These two tables ARE that rule. A field cannot be recorded without
-- saying which artifact it came from, how sure the engine is, and why —
-- and absence is stored as a row with method = ABSENT rather than as a
-- missing row, so "the requirement did not state a salary" is
-- distinguishable from "nobody looked". That distinction is the
-- difference between an honest advertisement and a fabricated one.
--
-- Strictly additive. The Task 001 tables (job_orders, employers,
-- positions, advertisements) are NOT modified: no column added, no
-- column dropped, no constraint changed. JobOrder gains only virtual
-- Prisma back-relations, which exist in the schema file and not in the
-- database. There is no backfill because there is nothing to backfill —
-- requirements ingested before this engine existed have no sources to
-- point at, and inventing provenance for them would be exactly the
-- fabrication this table exists to prevent.

CREATE TYPE "RequirementSourceKind" AS ENUM (
  'WHATSAPP_TEXT',
  'WHATSAPP_SCREENSHOT',
  'PDF',
  'IMAGE',
  'VOICE_NOTE',
  'EMAIL',
  'WORD',
  'EXCEL',
  'GOOGLE_SHEET',
  'WEBSITE',
  'PLAIN_TEXT'
);

-- How a canonical value came to hold its form — the explainability axis.
CREATE TYPE "ExtractionMethod" AS ENUM (
  'DETERMINISTIC',
  'AI_EXTRACTION',
  'AI_THEN_NORMALIZED',
  'ABSENT'
);

CREATE TYPE "ConfidenceBand" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- One inbound requirement artifact, exactly as received. Kept so a fact
-- can point at the thing it came from and the original can be shown to a
-- recruiter — or a regulator — later.
CREATE TABLE "requirement_sources" (
  "id"            TEXT NOT NULL,
  "agencyId"      TEXT NOT NULL,
  "jobOrderId"    TEXT,
  "kind"          "RequirementSourceKind" NOT NULL,
  "label"         TEXT NOT NULL,
  -- sha256 of the artifact: the same demand letter forwarded twice in one
  -- batch is one source, not two.
  "contentHash"   TEXT NOT NULL,
  "uri"           TEXT,
  "mimeType"      TEXT,
  -- What the engine actually read: the transcript of a voice note, the
  -- cell text of a workbook. Stored so an extraction can be re-explained
  -- without re-fetching a URL whose content may since have changed.
  "extractedText" TEXT,
  "notes"         JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "requirement_facts" (
  "id"             TEXT NOT NULL,
  "jobOrderId"     TEXT NOT NULL,
  "sourceId"       TEXT,
  -- Canonical dotted path, e.g. 'country', 'positions.0.salary'.
  "field"          TEXT NOT NULL,
  "value"          TEXT,
  -- Exactly what the source said, before canonicalization. Always kept:
  -- a normalized value the recruiter disagrees with is only arguable if
  -- the original is still there to compare against.
  "rawValue"       TEXT,
  "sourceKind"     "RequirementSourceKind" NOT NULL,
  "sourceRef"      TEXT,
  -- 0-1, deterministic — see src/server/ai/requirement-provenance.ts.
  "confidence"     DOUBLE PRECISION NOT NULL,
  "confidenceBand" "ConfidenceBand" NOT NULL,
  "method"         "ExtractionMethod" NOT NULL,
  -- Plain-language explanation. NOT NULL by design: there is no code path
  -- that may record a fact without saying why.
  "reason"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_facts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "requirement_sources_agencyId_contentHash_idx" ON "requirement_sources"("agencyId", "contentHash");
CREATE INDEX "requirement_sources_jobOrderId_idx" ON "requirement_sources"("jobOrderId");

-- One canonical value per field per requirement. Two rows for
-- 'positions.0.salary' would mean the requirement says two different
-- things, which is precisely what reconcileFact() exists to resolve
-- before anything is written.
CREATE UNIQUE INDEX "requirement_facts_jobOrderId_field_key" ON "requirement_facts"("jobOrderId", "field");
CREATE INDEX "requirement_facts_jobOrderId_idx" ON "requirement_facts"("jobOrderId");
-- Supports "show me every low-confidence field on this requirement" —
-- the query a recruiter review screen is built on.
CREATE INDEX "requirement_facts_jobOrderId_confidenceBand_idx" ON "requirement_facts"("jobOrderId", "confidenceBand");

ALTER TABLE "requirement_sources"
  ADD CONSTRAINT "requirement_sources_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: the artifact a recruiter sent is evidence. It
-- outlives the requirement that was derived from it.
ALTER TABLE "requirement_sources"
  ADD CONSTRAINT "requirement_sources_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CASCADE: an explanation of a requirement has no meaning once the
-- requirement is gone.
ALTER TABLE "requirement_facts"
  ADD CONSTRAINT "requirement_facts_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL: losing the artifact must not delete the explanation. The
-- reason text still records what was read and why.
ALTER TABLE "requirement_facts"
  ADD CONSTRAINT "requirement_facts_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "requirement_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
