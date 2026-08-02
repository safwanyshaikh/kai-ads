-- Compliance Intelligence (Task 004).
--
-- Determines the recruitment compliance requirements that apply to a
-- requirement, before any campaign is created: mandatory employer and
-- agency disclosures, country and corridor rules, mandatory warnings,
-- required legal statements, required trust elements, forbidden claims,
-- missing compliance information, and overall compliance readiness.
--
-- Every row carries Source, Confidence and Reason. `reason` is NOT NULL:
-- the engine may answer UNKNOWN, but it may never assert a legal
-- requirement it cannot explain.
--
-- THE DISTINCTION THIS TABLE EXISTS TO PRESERVE
--
-- UNKNOWN is stored as a row, never as absence. "No requirements apply"
-- and "we have no rules for this corridor" are identical as an empty
-- list and opposite answers in front of a regulator. An agency that
-- reads the second as the first advertises into a corridor nobody
-- checked.
--
-- `reviewStatus` records whether a rule was confirmed by a qualified
-- reviewer or merely encoded from public sources. Seeded rules are
-- REQUIRES_LEGAL_REVIEW without exception, and that status survives into
-- the database rather than being lost on write.
--
-- Strictly additive. Tasks 001-003 tables are NOT modified: no column
-- added, dropped or changed. job_orders gains only a virtual Prisma
-- back-relation, which adds no column.
--
-- No backfill. These determinations are DERIVED and recomputed.
-- Manufacturing compliance findings for requirements that predate the
-- engine would be asserting that a legal check was performed when none
-- was — the exact failure the UNKNOWN rule exists to prevent.

CREATE TYPE "ComplianceCategory" AS ENUM (
  'EMPLOYER_DISCLOSURE',
  'AGENCY_DISCLOSURE',
  'COUNTRY_RULE',
  'CORRIDOR_RULE',
  'MANDATORY_WARNING',
  'LEGAL_STATEMENT',
  'TRUST_ELEMENT',
  'FORBIDDEN_CLAIM'
);

CREATE TYPE "ComplianceStatus" AS ENUM (
  'SATISFIED',
  'REQUIRED',
  'VIOLATED',
  -- The corridor IS covered and holds no rule of this kind.
  'NOT_IN_KNOWLEDGE_BASE',
  -- The corridor is outside declared coverage. Not the same thing.
  'UNKNOWN'
);

CREATE TYPE "ComplianceReviewStatus" AS ENUM ('REQUIRES_LEGAL_REVIEW', 'REVIEWED');

CREATE TABLE "compliance_determinations" (
  "id"            TEXT NOT NULL,
  "jobOrderId"    TEXT NOT NULL,
  -- Rule id, or 'CATEGORY:summary' for a category-level verdict.
  "code"          TEXT NOT NULL,
  "category"      "ComplianceCategory" NOT NULL,
  "status"        "ComplianceStatus" NOT NULL,
  "value"         TEXT NOT NULL,
  "confidencePct" INTEGER NOT NULL,
  "source"        TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  -- The legal instrument. Null for coverage-gap and record-gap rows.
  "authority"     TEXT,
  -- Precise reference where genuinely known; never fabricated.
  "citation"      TEXT,
  "reviewStatus"  "ComplianceReviewStatus",
  "engineVersion" TEXT NOT NULL,
  "computedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_determinations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "compliance_determinations"
  ADD CONSTRAINT "compliance_determinations_confidence_range"
  CHECK ("confidencePct" >= 0 AND "confidencePct" <= 100);

-- An UNKNOWN determination must never carry confidence. "UNKNOWN at 90%"
-- is meaningless, and on a compliance record it is dangerous: it reads as
-- a near-certain legal finding.
ALTER TABLE "compliance_determinations"
  ADD CONSTRAINT "compliance_determinations_unknown_has_no_confidence"
  CHECK ("status" <> 'UNKNOWN' OR "confidencePct" = 0);

-- A determination asserting a legal requirement must name the instrument
-- it comes from. Only coverage gaps, record gaps and the readiness
-- summary may have no authority, and those never assert a requirement.
ALTER TABLE "compliance_determinations"
  ADD CONSTRAINT "compliance_determinations_asserted_rule_has_authority"
  CHECK (
    "status" NOT IN ('SATISFIED', 'REQUIRED', 'VIOLATED')
    OR "authority" IS NOT NULL
    OR "code" LIKE 'MISSING:%'
    OR "code" = 'COMPLIANCE_READINESS'
  );

-- One verdict per code per requirement.
CREATE UNIQUE INDEX "compliance_determinations_jobOrderId_code_key"
  ON "compliance_determinations"("jobOrderId", "code");

CREATE INDEX "compliance_determinations_jobOrderId_idx"
  ON "compliance_determinations"("jobOrderId");

-- Supports "every requirement currently blocked on compliance".
CREATE INDEX "compliance_determinations_category_status_idx"
  ON "compliance_determinations"("category", "status");

-- CASCADE: a compliance assessment has no meaning once the requirement
-- it assessed is gone.
ALTER TABLE "compliance_determinations"
  ADD CONSTRAINT "compliance_determinations_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
