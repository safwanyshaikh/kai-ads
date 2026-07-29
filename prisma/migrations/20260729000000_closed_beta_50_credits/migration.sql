-- Closed Beta:each approved agency receives 50 complimentary generations.
-- The bootstrap-trial default of 10 would have stopped every beta agency
-- a fifth of the way through their allocation.
ALTER TABLE "agency_generation_quotas" ALTER COLUMN "totalQuota" SET DEFAULT 50;

-- Lift existing agencies still on the old trial allocation up to the beta
-- allocation. Only rows untouched by an explicit admin grant are moved, so
-- a manually adjusted quota is never overwritten.
UPDATE "agency_generation_quotas" SET "totalQuota" = 50 WHERE "totalQuota" = 10;
