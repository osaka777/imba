-- CreateEnum
CREATE TYPE "AffilatorStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AffiliatePostbackEvent" AS ENUM ('registration', 'ftd', 'commission');

-- CreateEnum
CREATE TYPE "AffiliatePostbackStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Affilator" ADD COLUMN IF NOT EXISTS "status" "AffilatorStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "Affilator" SET "status" = 'ACTIVE';

ALTER TABLE "Affilator" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AffiliatePostbackLog" (
    "id" SERIAL NOT NULL,
    "partnerUserId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "event" "AffiliatePostbackEvent" NOT NULL,
    "url" TEXT NOT NULL,
    "payload" JSONB,
    "httpStatus" INTEGER,
    "responseBody" TEXT,
    "status" "AffiliatePostbackStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePostbackLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliatePostbackLog_partnerUserId_createdAt_idx" ON "AffiliatePostbackLog"("partnerUserId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliatePostbackLog_status_createdAt_idx" ON "AffiliatePostbackLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Affilator_status_idx" ON "Affilator"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffiliatePostbackLog" ADD CONSTRAINT "AffiliatePostbackLog_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "Affilator"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
