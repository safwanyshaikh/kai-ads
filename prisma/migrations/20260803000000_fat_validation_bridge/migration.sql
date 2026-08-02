-- Founder validation bridge (Task 006.5).
--
-- NOT part of Tasks 001-006. Those six intelligence engines are
-- completely unmodified by this migration — no column added, dropped,
-- or changed on any of their tables. This adds exactly one new table,
-- fat_runs, so the Founder's own internal validation runs are listed
-- somewhere ("every run must be stored") instead of requiring the
-- database to be opened directly.
--
-- jobOrderId is nullable: an unreadable source or a failed extraction
-- never produces a JobOrder, and the run is still recorded with the
-- reason in `summary` — a failed test is exactly as visible as a
-- successful one, which is the whole point of a validation tool.

CREATE TABLE "fat_runs" (
  "id"          TEXT NOT NULL,
  "agencyId"    TEXT NOT NULL,
  "jobOrderId"  TEXT,
  -- What the Founder submitted: WHATSAPP_TEXT | PDF | IMAGE | EXCEL | WORD | GOOGLE_SHEET | WEBSITE | ...
  "inputType"   TEXT NOT NULL,
  -- CREATED | NO_READABLE_SOURCE | INSUFFICIENT_REQUIREMENT | EXTRACTION_FAILED | ERROR
  "status"      TEXT NOT NULL,
  "summary"     JSONB,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fat_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fat_runs_agencyId_createdAt_idx" ON "fat_runs"("agencyId", "createdAt");

ALTER TABLE "fat_runs"
  ADD CONSTRAINT "fat_runs_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL: a run's history entry outlives the JobOrder it produced if
-- that JobOrder is ever removed — the run still records what was tried.
ALTER TABLE "fat_runs"
  ADD CONSTRAINT "fat_runs_jobOrderId_fkey"
  FOREIGN KEY ("jobOrderId") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fat_runs"
  ADD CONSTRAINT "fat_runs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
