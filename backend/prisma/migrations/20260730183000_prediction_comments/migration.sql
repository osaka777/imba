-- CreateEnum
CREATE TYPE "PredictionCommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

-- CreateTable
CREATE TABLE "PredictionComment" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "body" VARCHAR(280) NOT NULL,
    "status" "PredictionCommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PredictionComment_eventId_createdAt_idx" ON "PredictionComment"("eventId", "createdAt");
CREATE INDEX "PredictionComment_userId_createdAt_idx" ON "PredictionComment"("userId", "createdAt");
CREATE INDEX "PredictionComment_eventId_status_createdAt_idx" ON "PredictionComment"("eventId", "status", "createdAt");

ALTER TABLE "PredictionComment" ADD CONSTRAINT "PredictionComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PredictionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionComment" ADD CONSTRAINT "PredictionComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
