-- Permanent business domain (Task 001): JobOrder, Employer, Position.
--
-- Until now the advertisement was the root entity: the employer was a
-- free-text column on it and the positions were an opaque jsonb blob.
-- Neither "everything we have run for ABC Contracting" nor "how many
-- riggers were we asked for this year" was an answerable question at any
-- speed, because the data to answer them was never structured.
--
-- This migration is strictly ADDITIVE. No column is dropped, no column
-- is renamed, no existing value is rewritten:
--   * advertisements.employer  — stays, still populated, still rendered
--   * advertisements.positions — stays, still the Rendering Engine's input
-- The new tables are a queryable projection of the same facts, written
-- in the same transaction as the advertisement. Existing read paths,
-- APIs and version snapshots are untouched by design, which is what
-- lets every existing feature and test keep working unchanged.
--
-- Backfill: every pre-existing advertisement is given exactly one
-- JobOrder, its employer text is resolved to an Employer, and each entry
-- of its positions array becomes a Position row. Zero advertisements are
-- left without a requirement behind them; zero rows are deleted.

-- ---------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------

CREATE TABLE "employers" (
  "id"             TEXT NOT NULL,
  "agencyId"       TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_orders" (
  "id"          TEXT NOT NULL,
  "agencyId"    TEXT NOT NULL,
  "employerId"  TEXT,
  "title"       TEXT NOT NULL,
  "industry"    TEXT NOT NULL,
  "country"     TEXT NOT NULL,
  "interview"   JSONB,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "positions" (
  "id"              TEXT NOT NULL,
  "jobOrderId"      TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "count"           INTEGER,
  "experience"      TEXT,
  "salary"          TEXT,
  "ageRange"        TEXT,
  "language"        TEXT,
  "qualifications"  JSONB,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- One employer per agency per normalized name. This is what collapses
-- "ABC Contracting", "abc  contracting" and " ABC Contracting " into one
-- history instead of three, and what makes the service layer's
-- create-on-first-sight resolution safe under concurrency.
CREATE UNIQUE INDEX "employers_agencyId_normalizedName_key" ON "employers"("agencyId", "normalizedName");
CREATE INDEX "employers_agencyId_idx" ON "employers"("agencyId");

CREATE INDEX "job_orders_agencyId_createdAt_idx" ON "job_orders"("agencyId", "createdAt");
CREATE INDEX "job_orders_agencyId_country_idx"   ON "job_orders"("agencyId", "country");
CREATE INDEX "job_orders_agencyId_industry_idx"  ON "job_orders"("agencyId", "industry");
CREATE INDEX "job_orders_employerId_idx"         ON "job_orders"("employerId");

CREATE INDEX "positions_jobOrderId_sortOrder_idx" ON "positions"("jobOrderId", "sortOrder");
CREATE INDEX "positions_normalizedTitle_idx"      ON "positions"("normalizedTitle");

ALTER TABLE "employers"
  ADD CONSTRAINT "employers_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_orders"
  ADD CONSTRAINT "job_orders_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: removing an employer record must never destroy
-- the requirement history that was run for them.
ALTER TABLE "job_orders"
  ADD CONSTRAINT "job_orders_employerId_fkey"
  FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_orders"
  ADD CONSTRAINT "job_orders_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CASCADE: a position has no meaning outside its requirement.
ALTER TABLE "positions"
  ADD CONSTRAINT "positions_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nullable: every existing read path, API response and test keeps working
-- without joining through the new domain. The service layer always
-- populates it on create, so only pre-migration rows can hold NULL, and
-- the backfill below leaves none of those either.
ALTER TABLE "advertisements" ADD COLUMN "jobOrderId" TEXT;

CREATE INDEX "advertisements_jobOrderId_idx" ON "advertisements"("jobOrderId");

-- SET NULL, not CASCADE: an advertisement is a historical record with its
-- own versions, history and published artwork. It must survive its
-- requirement being removed.
ALTER TABLE "advertisements"
  ADD CONSTRAINT "advertisements_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 2. Backfill
-- ---------------------------------------------------------------------
--
-- Normalization below MUST stay identical to
-- src/lib/normalize-entity-name.ts (collapse whitespace runs -> single
-- space, trim, lowercase). If the two ever diverge, rows written before
-- and after this migration group under different keys and an agency's
-- employer history silently splits in two.

-- Every statement below is idempotent: re-running the backfill after a
-- partial failure, or against a database that is already partly
-- backfilled, converges to the same result instead of duplicating
-- employers, requirements or vacancies.
--
-- 2a. One Employer per distinct (agency, normalized employer name).
--     Advertisements with a NULL/blank employer contribute nothing here
--     and their job order simply carries no employer.
INSERT INTO "employers" ("id", "agencyId", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  source."agencyId",
  source."name",
  source."normalizedName",
  source."firstSeen",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (a."agencyId", lower(trim(regexp_replace(a."employer", '\s+', ' ', 'g'))))
    a."agencyId"                                                        AS "agencyId",
    trim(regexp_replace(a."employer", '\s+', ' ', 'g'))                 AS "name",
    lower(trim(regexp_replace(a."employer", '\s+', ' ', 'g')))          AS "normalizedName",
    a."createdAt"                                                       AS "firstSeen"
  FROM "advertisements" a
  WHERE a."employer" IS NOT NULL
    AND trim(regexp_replace(a."employer", '\s+', ' ', 'g')) <> ''
  -- Earliest spelling wins as the display name, so the employer is
  -- labelled the way the agency first wrote it.
  ORDER BY
    a."agencyId",
    lower(trim(regexp_replace(a."employer", '\s+', ' ', 'g'))),
    a."createdAt" ASC
) AS source
ON CONFLICT ("agencyId", "normalizedName") DO NOTHING;

-- 2b. One JobOrder per existing advertisement — including archived and
--     soft-deleted ones, which are history and must not lose their
--     requirement.
--
--     The pairing is carried explicitly in a temporary column rather
--     than reconstructed afterwards by matching on content. Two
--     advertisements can legitimately share every field (a duplicate
--     saved in the same second, an agency re-running an identical
--     requirement), and a content match would then be ambiguous: both
--     rows could resolve to the same job order, leaving one requirement
--     orphaned and two advertisements sharing a third. Carrying the id
--     makes the mapping exactly 1:1 with no reliance on uniqueness that
--     the data does not guarantee.
ALTER TABLE "job_orders" ADD COLUMN "_backfillAdvertisementId" TEXT;

INSERT INTO "job_orders" ("id", "agencyId", "employerId", "title", "industry", "country", "interview", "createdById", "createdAt", "updatedAt", "_backfillAdvertisementId")
SELECT
  gen_random_uuid()::TEXT,
  a."agencyId",
  e."id",
  a."header",
  a."industry",
  a."country",
  a."interview",
  a."createdById",
  a."createdAt",
  a."updatedAt",
  a."id"
FROM "advertisements" a
LEFT JOIN "employers" e
  ON  e."agencyId" = a."agencyId"
  AND e."normalizedName" = lower(trim(regexp_replace(a."employer", '\s+', ' ', 'g')))
WHERE a."jobOrderId" IS NULL;

-- 2c. Link each advertisement to the job order created for it, by id.
UPDATE "advertisements" a
SET "jobOrderId" = jo."id"
FROM "job_orders" jo
WHERE jo."_backfillAdvertisementId" = a."id";

ALTER TABLE "job_orders" DROP COLUMN "_backfillAdvertisementId";

-- 2d. Explode each advertisement's positions array into Position rows,
--     preserving the order the trades appeared in the requirement.
INSERT INTO "positions" ("id", "jobOrderId", "title", "normalizedTitle", "count", "experience", "salary", "ageRange", "language", "qualifications", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  a."jobOrderId",
  COALESCE(NULLIF(trim(p.value ->> 'title'), ''), 'Untitled position'),
  lower(trim(regexp_replace(COALESCE(NULLIF(trim(p.value ->> 'title'), ''), 'Untitled position'), '\s+', ' ', 'g'))),
  CASE
    WHEN jsonb_typeof(p.value -> 'count') = 'number' THEN (p.value ->> 'count')::INTEGER
    ELSE NULL
  END,
  NULLIF(trim(COALESCE(p.value ->> 'experience', '')), ''),
  NULLIF(trim(COALESCE(p.value ->> 'salary', '')), ''),
  NULLIF(trim(COALESCE(p.value ->> 'ageRange', '')), ''),
  NULLIF(trim(COALESCE(p.value ->> 'language', '')), ''),
  CASE
    WHEN jsonb_typeof(p.value -> 'qualifications') = 'array'
     AND jsonb_array_length(p.value -> 'qualifications') > 0
    THEN p.value -> 'qualifications'
    ELSE NULL
  END,
  (p.ordinality - 1)::INTEGER,
  a."createdAt",
  CURRENT_TIMESTAMP
FROM "advertisements" a
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(a."positions") = 'array' THEN a."positions" ELSE '[]'::jsonb END
) WITH ORDINALITY AS p(value, ordinality)
WHERE a."jobOrderId" IS NOT NULL
  -- Only for requirements that have no vacancies yet, so a re-run never
  -- doubles an agency's demand history.
  AND NOT EXISTS (
    SELECT 1 FROM "positions" existing WHERE existing."jobOrderId" = a."jobOrderId"
  );
