-- JobOrder Intelligence (Task 003).
--
-- One understanding of one requirement, attached to the JobOrder:
-- industry, sector, country, employer, project name, plant type, plant
-- status, trade categories, number of trades, recruitment complexity,
-- candidate scarcity, languages, suggested channels, urgency, hiring
-- pattern and recruitment pattern.
--
-- Every row carries Source, Confidence and Reason — the same contract
-- the Requirement Intelligence engine established in Task 002. `reason`
-- is NOT NULL by design: the engine may return UNKNOWN, but it may never
-- return a value it cannot explain.
--
-- UNKNOWN is stored as a row with value = 'UNKNOWN' rather than as a
-- missing row. "We looked and could not tell" must stay distinguishable
-- from "this was never assessed": acting on the first is fine, acting on
-- the second is how a wrong advertisement gets published.
--
-- Strictly additive. Task 001 (job_orders, employers, positions,
-- advertisements) and Task 002 (requirement_sources, requirement_facts)
-- are NOT modified: no column added, no column dropped, no constraint
-- changed. job_orders gains only a virtual Prisma back-relation, which
-- exists in the schema file and not in the database.
--
-- No backfill. These determinations are DERIVED — recomputed from the
-- requirement whenever it is assessed, never migrated. Manufacturing
-- determinations for requirements that predate the engine would be
-- inventing understanding nobody performed, which is exactly what the
-- UNKNOWN rule exists to prevent.

CREATE TABLE "job_order_determinations" (
  "id"            TEXT NOT NULL,
  "jobOrderId"    TEXT NOT NULL,
  -- Stable machine name, e.g. 'industry', 'plantStatus'.
  "attribute"     TEXT NOT NULL,
  -- The determined value, or the literal 'UNKNOWN'.
  "value"         TEXT NOT NULL,
  -- 0-100. Zero whenever the value is UNKNOWN.
  "confidencePct" INTEGER NOT NULL,
  "source"        TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  -- string[]: the exact evidence that fired.
  "signals"       JSONB,
  -- Which build of the taxonomy produced this, so a re-run is comparable.
  "engineVersion" TEXT NOT NULL,
  "computedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_order_determinations_pkey" PRIMARY KEY ("id")
);

-- Confidence is a percentage. Enforced in the database because a value
-- outside 0-100 would be read as a percentage by every consumer and
-- silently mislead a recruiter about how sure the engine actually is.
ALTER TABLE "job_order_determinations"
  ADD CONSTRAINT "job_order_determinations_confidence_range"
  CHECK ("confidencePct" >= 0 AND "confidencePct" <= 100);

-- An UNKNOWN determination must never carry confidence. Without this,
-- "UNKNOWN at 90%" is representable, and it is meaningless.
ALTER TABLE "job_order_determinations"
  ADD CONSTRAINT "job_order_determinations_unknown_has_no_confidence"
  CHECK ("value" <> 'UNKNOWN' OR "confidencePct" = 0);

-- One answer per attribute per requirement. Two rows for 'industry'
-- would mean the engine reached two conclusions, which is precisely the
-- ambiguity it reports as UNKNOWN instead.
CREATE UNIQUE INDEX "job_order_determinations_jobOrderId_attribute_key"
  ON "job_order_determinations"("jobOrderId", "attribute");

CREATE INDEX "job_order_determinations_jobOrderId_idx"
  ON "job_order_determinations"("jobOrderId");

-- Supports "every requirement we have run for a refinery shutdown" —
-- the question this engine exists to make answerable.
CREATE INDEX "job_order_determinations_attribute_value_idx"
  ON "job_order_determinations"("attribute", "value");

-- CASCADE: an understanding of a requirement has no meaning once the
-- requirement is gone.
ALTER TABLE "job_order_determinations"
  ADD CONSTRAINT "job_order_determinations_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
