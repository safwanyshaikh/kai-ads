-- CreateEnum
CREATE TYPE "AiOperationType" AS ENUM ('REQUIREMENT_EXTRACTION', 'TRADE_SUMMARY', 'INDUSTRY_DETECTION', 'COUNTRY_DETECTION', 'EMPLOYER_DETECTION', 'SALARY_DETECTION', 'INTERVIEW_DETECTION', 'COMPOSITE_EXTRACTION');

-- CreateTable
CREATE TABLE "agency_contacts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "designation" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "operationType" "AiOperationType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(10,6),
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "agencyId" TEXT,
    "userId" TEXT,
    "advertisementDraftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_contacts_agencyId_deletedAt_idx" ON "agency_contacts"("agencyId", "deletedAt");

CREATE INDEX "ai_usage_logs_agencyId_createdAt_idx" ON "ai_usage_logs"("agencyId", "createdAt");
CREATE INDEX "ai_usage_logs_operationType_idx" ON "ai_usage_logs"("operationType");

-- AddForeignKey
ALTER TABLE "agency_contacts" ADD CONSTRAINT "agency_contacts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_contacts" ADD CONSTRAINT "agency_contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
