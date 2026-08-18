-- Full verified registration identity (see VerifiedAgencyProfile in
-- src/server/generation/pipeline/types.ts).
--
-- "registrationNumber" remains the short/compact identifier (rcNumber)
-- used for lookups and small visual areas. It is never shortened or
-- reused as a stand-in for the full registration string.
--
-- A real generated advertisement was found rendering its short
-- registrationNumber ("9986") in the trust footer's full "MEA / RA
-- REGISTRATION" line, because the pipeline had nowhere else to read the
-- complete string from. All nullable: an agency that hasn't filled these
-- in yet keeps generating exactly as before (resolveAgencyProfile falls
-- back to registrationNumber only when fullRegistrationNumber is unset).
ALTER TABLE "agencies" ADD COLUMN "fullRegistrationNumber" TEXT;
ALTER TABLE "agencies" ADD COLUMN "meaRegistrationText" TEXT;
ALTER TABLE "agencies" ADD COLUMN "isoCertification" TEXT;
ALTER TABLE "agencies" ADD COLUMN "isoLogoUrl" TEXT;
