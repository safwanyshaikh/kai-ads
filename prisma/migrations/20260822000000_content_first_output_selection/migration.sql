-- Content-first workflow: the tenant approves facts, then chooses what
-- to produce from them.

-- DTP and Social are separate rendering engines over the same approved
-- content; Black & White and Colour are two modes of DTP.
CREATE TYPE "AdvertisementOutputType" AS ENUM ('DTP_BW', 'DTP_COLOUR', 'SOCIAL');

ALTER TABLE "advertisement_drafts"
  -- The client's own mark, uploaded deliberately into its own field.
  -- Never a logo harvested from inside an attachment, which could as
  -- easily be the agency's, a certification badge, or decoration.
  ADD COLUMN "clientLogoUrl" TEXT,
  -- Source disagreements held for the tenant to resolve, rather than
  -- settled silently by preferring one input over another.
  ADD COLUMN "contentConflicts" JSONB,
  -- Chosen after content approval, never before.
  ADD COLUMN "outputType" "AdvertisementOutputType";
