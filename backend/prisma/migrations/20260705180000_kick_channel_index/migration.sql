-- AlterTable
ALTER TABLE "Affilator" ADD COLUMN "kickChannelSlug" TEXT,
ADD COLUMN "kickBroadcasterUserId" INTEGER;

-- CreateIndex
CREATE INDEX "Affilator_kickChannelSlug_idx" ON "Affilator"("kickChannelSlug");

-- CreateIndex
CREATE INDEX "Affilator_kickBroadcasterUserId_idx" ON "Affilator"("kickBroadcasterUserId");
