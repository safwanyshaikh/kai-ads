-- CreateTable
CREATE TABLE "fat_pipeline_runs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "sourceType" "AdvertisementDraftSourceType" NOT NULL,
    "sourceLabel" TEXT,
    "draftId" TEXT,
    "advertisementId" TEXT,
    "stages" JSONB NOT NULL,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fat_pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fat_pipeline_runs_createdAt_idx" ON "fat_pipeline_runs"("createdAt");
