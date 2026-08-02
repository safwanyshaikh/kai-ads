-- Campaign Intelligence (Task 005).
--
-- Decides HOW a recruitment requirement should be communicated: primary
-- campaign objective, primary and secondary message, candidate
-- motivation, trust strategy, employer branding priority, urgency
-- strategy, CTA strategy, language strategy, audience type,
-- communication tone, information priority, campaign density, hero image
-- intent, visual focus and suggested image context.
--
-- It decides NOTHING about layout, typography, colour or position. The
-- three image-related attributes describe SUBJECT MATTER only — what the
-- picture should be of — because that is a communication decision.
-- Composition and palette belong to Layout Intelligence and the
-- Rendering Engine, which run later.
--
-- Every row carries Source, Confidence and Reason. `reason` is NOT NULL:
-- the engine may answer UNKNOWN, but it may never make a communication
-- decision it cannot explain.
--
-- `dependsOn` records which upstream determinations produced the
-- decision. That is what makes a campaign traceable — an UNKNOWN here
-- points at the exact gap in JobOrder or Compliance Intelligence that
-- caused it, instead of appearing as an unexplained blank.
--
-- Strictly additive. Tasks 001-004 tables are NOT modified: no column
-- added, dropped or changed. job_orders gains only a virtual Prisma
-- back-relation, which adds no column.
--
-- No backfill. These determinations are DERIVED and recomputed from the
-- upstream intelligence. Manufacturing a communication strategy for
-- requirements that predate the engine would assert decisions nobody
-- made.

CREATE TABLE "campaign_determinations" (
  "id"            TEXT NOT NULL,
  "jobOrderId"    TEXT NOT NULL,
  -- Stable machine name, e.g. 'primaryCommunicationMessage'.
  "attribute"     TEXT NOT NULL,
  -- The communication decision, or the literal 'UNKNOWN'.
  "value"         TEXT NOT NULL,
  -- 0-100. Capped by the least certain upstream input.
  "confidencePct" INTEGER NOT NULL,
  "source"        TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  -- string[]: the upstream attributes this was derived from.
  "dependsOn"     JSONB,
  "engineVersion" TEXT NOT NULL,
  "computedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_determinations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "campaign_determinations"
  ADD CONSTRAINT "campaign_determinations_confidence_range"
  CHECK ("confidencePct" >= 0 AND "confidencePct" <= 100);

-- An UNKNOWN decision must never carry confidence. A confident UNKNOWN
-- would read as a strategy the engine nearly settled on, when in fact it
-- reached none.
ALTER TABLE "campaign_determinations"
  ADD CONSTRAINT "campaign_determinations_unknown_has_no_confidence"
  CHECK ("value" <> 'UNKNOWN' OR "confidencePct" = 0);

-- One decision per attribute per requirement. Two primary messages would
-- mean the engine reached two strategies, which is exactly the ambiguity
-- it reports as UNKNOWN instead.
CREATE UNIQUE INDEX "campaign_determinations_jobOrderId_attribute_key"
  ON "campaign_determinations"("jobOrderId", "attribute");

CREATE INDEX "campaign_determinations_jobOrderId_idx"
  ON "campaign_determinations"("jobOrderId");

-- CASCADE: a communication strategy has no meaning once the requirement
-- it was built for is gone.
ALTER TABLE "campaign_determinations"
  ADD CONSTRAINT "campaign_determinations_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
