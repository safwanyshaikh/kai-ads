-- CreateEnum
CREATE TYPE "AdvertisementStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');
CREATE TYPE "AdvertisementStyle" AS ENUM ('VISUAL', 'TYPOGRAPHY', 'NEWSPAPER');
CREATE TYPE "AdvertisementDraftSourceType" AS ENUM ('PASTE_TEXT', 'PDF', 'DOCX', 'IMAGE', 'WHATSAPP_SCREENSHOT');
CREATE TYPE "AdvertisementDraftStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'EXTRACTED', 'EXTRACTION_FAILED', 'REVIEWED', 'STYLE_SELECTED', 'SAVED', 'DISCARDED');

-- CreateTable
CREATE TABLE "advertisement_drafts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "sourceType" "AdvertisementDraftSourceType" NOT NULL,
    "rawText" TEXT,
    "sourceFileUrl" TEXT,
    "extractedData" JSONB,
    "extractionError" TEXT,
    "reviewedData" JSONB,
    "selectedStyle" "AdvertisementStyle",
    "status" "AdvertisementDraftStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "advertisement_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advertisements" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "header" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "employer" TEXT,
    "positions" JSONB NOT NULL,
    "benefits" JSONB NOT NULL,
    "interview" JSONB NOT NULL,
    "contact" JSONB NOT NULL,
    "footer" TEXT,
    "theme" JSONB,
    "style" "AdvertisementStyle" NOT NULL DEFAULT 'VISUAL',
    "status" "AdvertisementStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "sourceDraftId" TEXT,
    "duplicatedFromId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advertisement_versions" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advertisement_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advertisement_history" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "AdvertisementStatus",
    "toStatus" "AdvertisementStatus",
    "metadata" JSONB,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advertisement_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advertisement_drafts_agencyId_status_idx" ON "advertisement_drafts"("agencyId", "status");
CREATE INDEX "advertisement_drafts_createdById_idx" ON "advertisement_drafts"("createdById");

CREATE UNIQUE INDEX "advertisements_sourceDraftId_key" ON "advertisements"("sourceDraftId");
CREATE INDEX "advertisements_agencyId_status_idx" ON "advertisements"("agencyId", "status");
CREATE INDEX "advertisements_agencyId_deletedAt_idx" ON "advertisements"("agencyId", "deletedAt");
CREATE INDEX "advertisements_agencyId_industry_idx" ON "advertisements"("agencyId", "industry");
CREATE INDEX "advertisements_agencyId_country_idx" ON "advertisements"("agencyId", "country");
CREATE INDEX "advertisements_agencyId_createdAt_idx" ON "advertisements"("agencyId", "createdAt");

CREATE UNIQUE INDEX "advertisement_versions_advertisementId_versionNumber_key" ON "advertisement_versions"("advertisementId", "versionNumber");
CREATE INDEX "advertisement_versions_advertisementId_idx" ON "advertisement_versions"("advertisementId");

CREATE INDEX "advertisement_history_advertisementId_createdAt_idx" ON "advertisement_history"("advertisementId", "createdAt");

-- AddForeignKey
ALTER TABLE "advertisement_drafts" ADD CONSTRAINT "advertisement_drafts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advertisement_drafts" ADD CONSTRAINT "advertisement_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "advertisement_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_duplicatedFromId_fkey" FOREIGN KEY ("duplicatedFromId") REFERENCES "advertisements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "advertisement_versions" ADD CONSTRAINT "advertisement_versions_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advertisement_versions" ADD CONSTRAINT "advertisement_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advertisement_history" ADD CONSTRAINT "advertisement_history_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advertisement_history" ADD CONSTRAINT "advertisement_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
