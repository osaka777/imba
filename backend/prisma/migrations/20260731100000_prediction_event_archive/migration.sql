-- AlterTable
ALTER TABLE "PredictionEvent" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PredictionEvent_archivedAt_idx" ON "PredictionEvent"("archivedAt");
