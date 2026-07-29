-- Agency Profile: the single source of truth for branding.
--
-- Contact details previously lived only on each advertisement, so a
-- recruiter retyped their own phone, email and address for every campaign
-- and any typo shipped on the artwork. These belong to the agency once.
--
-- All nullable: existing agencies keep generating before they complete
-- their profile, and an advertisement-level value still overrides.
ALTER TABLE "agencies" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "agencies" ADD COLUMN "phone" TEXT;
ALTER TABLE "agencies" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "agencies" ADD COLUMN "officeAddress" TEXT;
ALTER TABLE "agencies" ADD COLUMN "brandColours" JSONB;
ALTER TABLE "agencies" ADD COLUMN "socialLinks" JSONB;
