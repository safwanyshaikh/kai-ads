-- Layout Intelligence (Task 006).
--
-- Decides HOW the campaign should be presented — the Publication
-- Strategy: publication type, layout family, information density,
-- reading direction, visual hierarchy, hero image importance,
-- text/image ratio, QR importance, logo importance, trust element
-- priority, CTA priority, typography strategy (high-level only),
-- language strategy, multi-language requirement, colour mood
-- (high-level only), whitespace strategy, and mobile-first vs
-- print-first.
--
-- This engine renders nothing, generates no image, edits nothing and
-- publishes nothing. Its values are strategic descriptors ("Bold,
-- high-legibility, industrial"), never a coordinate, a pixel value, a
-- canvas size, a font name, or a colour value — those are Rendering
-- Engine decisions made later, from this strategy.
--
-- Every row carries Source, Confidence and Reason. `reason` is NOT NULL:
-- the engine may answer UNKNOWN, but it may never make a presentation
-- decision it cannot explain.
--
-- `dependsOn` records which Campaign Intelligence attributes produced
-- the decision, so an UNKNOWN here is traceable to the exact upstream
-- gap that caused it, the same guarantee Task 005 established one stage
-- earlier.
--
-- Strictly additive. Tasks 001-005 tables are NOT modified: no column
-- added, dropped or changed. job_orders gains only a virtual Prisma
-- back-relation, which adds no column.
--
-- No backfill. These determinations are DERIVED and recomputed from
-- Campaign Intelligence. Manufacturing a presentation strategy for
-- requirements that predate the engine would assert decisions nobody
-- made.

CREATE TABLE "layout_determinations" (
  "id"            TEXT NOT NULL,
  "jobOrderId"    TEXT NOT NULL,
  -- Stable machine name, e.g. 'publicationType', 'layoutFamily'.
  "attribute"     TEXT NOT NULL,
  -- The presentation decision, or the literal 'UNKNOWN'.
  "value"         TEXT NOT NULL,
  -- 0-100. Capped by the least certain Campaign Intelligence input.
  "confidencePct" INTEGER NOT NULL,
  "source"        TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  -- string[]: the Campaign Intelligence attributes this was derived from.
  "dependsOn"     JSONB,
  "engineVersion" TEXT NOT NULL,
  "computedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "layout_determinations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "layout_determinations"
  ADD CONSTRAINT "layout_determinations_confidence_range"
  CHECK ("confidencePct" >= 0 AND "confidencePct" <= 100);

-- An UNKNOWN presentation decision must never carry confidence. A
-- confident UNKNOWN would read as a strategy the engine nearly settled
-- on, when in fact it reached none.
ALTER TABLE "layout_determinations"
  ADD CONSTRAINT "layout_determinations_unknown_has_no_confidence"
  CHECK ("value" <> 'UNKNOWN' OR "confidencePct" = 0);

-- One decision per attribute per requirement. Two publication-type
-- recommendations would mean the engine reached two strategies, which
-- is exactly the ambiguity it reports as UNKNOWN instead.
CREATE UNIQUE INDEX "layout_determinations_jobOrderId_attribute_key"
  ON "layout_determinations"("jobOrderId", "attribute");

CREATE INDEX "layout_determinations_jobOrderId_idx"
  ON "layout_determinations"("jobOrderId");

-- CASCADE: a presentation strategy has no meaning once the requirement
-- it was built for is gone.
ALTER TABLE "layout_determinations"
  ADD CONSTRAINT "layout_determinations_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
