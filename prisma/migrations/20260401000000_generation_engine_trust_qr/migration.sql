-- AlterEnum: new AiOperationType values for image generation (each ADD VALUE
-- commits independently under psql's default autocommit-per-statement, so
-- they're safely usable by the INSERTs/DEFAULTs later in this same script)
ALTER TYPE "AiOperationType" ADD VALUE 'FULL_AD_GENERATION';
ALTER TYPE "AiOperationType" ADD VALUE 'SECTION_REGENERATION';
ALTER TYPE "AiOperationType" ADD VALUE 'THEME_VARIATION';
ALTER TYPE "AiOperationType" ADD VALUE 'RETRY';
ALTER TYPE "AiOperationType" ADD VALUE 'SYSTEM_RETRY';

-- CreateEnum
CREATE TYPE "AdvertisementDensity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AdvertisementSection" AS ENUM ('HEADER', 'COUNTRY_INDUSTRY', 'POSITIONS', 'BENEFITS', 'INTERVIEW', 'CONTACT', 'AGENCY_FOOTER', 'VERIFICATION_BADGE');
CREATE TYPE "RegenerationMethod" AS ENUM ('AI_REGENERATED', 'MANUAL_EDIT');
CREATE TYPE "AdvertisementTrustStatus" AS ENUM ('TRUST_READY', 'REVIEW_RECOMMENDED', 'BLOCKED');
CREATE TYPE "AgencyVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'SUSPENDED', 'REVERIFICATION_REQUIRED');

-- AlterTable: advertisements
ALTER TABLE "advertisements" ADD COLUMN "platformFormat" TEXT;
ALTER TABLE "advertisements" ADD COLUMN "density" "AdvertisementDensity";
ALTER TABLE "advertisements" ADD COLUMN "generatedAssetUrl" TEXT;
ALTER TABLE "advertisements" ADD COLUMN "badgeConfig" JSONB;
ALTER TABLE "advertisements" ADD COLUMN "trustStatus" "AdvertisementTrustStatus";
ALTER TABLE "advertisements" ADD COLUMN "trustWarnings" JSONB;

-- AlterTable: advertisement_versions
ALTER TABLE "advertisement_versions" ADD COLUMN "changedSection" "AdvertisementSection";
ALTER TABLE "advertisement_versions" ADD COLUMN "regenerationMethod" "RegenerationMethod";
ALTER TABLE "advertisement_versions" ADD COLUMN "previousSectionData" JSONB;
ALTER TABLE "advertisement_versions" ADD COLUMN "newSectionData" JSONB;

-- AlterTable: ai_usage_logs
ALTER TABLE "ai_usage_logs" ADD COLUMN "imageSize" TEXT;
ALTER TABLE "ai_usage_logs" ADD COLUMN "imageQuality" TEXT;
ALTER TABLE "ai_usage_logs" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ai_usage_logs" ADD COLUMN "advertisementId" TEXT;
ALTER TABLE "ai_usage_logs" ADD COLUMN "advertisementVersionId" TEXT;
CREATE INDEX "ai_usage_logs_advertisementId_idx" ON "ai_usage_logs"("advertisementId");

-- CreateTable
CREATE TABLE "agency_verifications" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" "AgencyVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "officialVerificationUrl" TEXT,
    "verificationDate" TIMESTAMP(3),
    "verifiedById" TEXT,
    "evidenceReference" TEXT,
    "licenseValidUntil" TIMESTAMP(3),
    "reverificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agency_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agency_generation_quotas" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "totalQuota" INTEGER NOT NULL DEFAULT 10,
    "successfulGenerationsUsed" INTEGER NOT NULL DEFAULT 0,
    "sectionRegenerationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agency_generation_quotas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "qr_scan_events" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "advertisementVersionId" TEXT,
    "sourcePlatform" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "deviceCategory" TEXT,
    "referrer" TEXT,
    "destinationUrl" TEXT,
    "redirectSuccess" BOOLEAN NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_verifications_agencyId_key" ON "agency_verifications"("agencyId");
CREATE INDEX "agency_verifications_status_idx" ON "agency_verifications"("status");

CREATE UNIQUE INDEX "agency_generation_quotas_agencyId_key" ON "agency_generation_quotas"("agencyId");

CREATE INDEX "qr_scan_events_advertisementId_scannedAt_idx" ON "qr_scan_events"("advertisementId", "scannedAt");

-- AddForeignKey
ALTER TABLE "agency_verifications" ADD CONSTRAINT "agency_verifications_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_verifications" ADD CONSTRAINT "agency_verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agency_generation_quotas" ADD CONSTRAINT "agency_generation_quotas_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
