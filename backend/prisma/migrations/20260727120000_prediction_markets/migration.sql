-- AlterEnum
ALTER TYPE "OperationSource" ADD VALUE IF NOT EXISTS 'PREDICTION';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionEventStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'SETTLED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PredictionBetStatus" AS ENUM ('PENDING', 'WIN', 'LOSE', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionEvent" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "resolveRule" TEXT,
    "status" "PredictionEventStatus" NOT NULL DEFAULT 'DRAFT',
    "closesAt" TIMESTAMP(3),
    "resolvesAt" TIMESTAMP(3),
    "winningOutcomeId" INTEGER,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PredictionEvent_slug_key" ON "PredictionEvent"("slug");
CREATE INDEX IF NOT EXISTS "PredictionEvent_status_closesAt_idx" ON "PredictionEvent"("status", "closesAt");
CREATE INDEX IF NOT EXISTS "PredictionEvent_category_status_idx" ON "PredictionEvent"("category", "status");

CREATE TABLE IF NOT EXISTS "PredictionOutcome" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "odds" DECIMAL(8,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PredictionOutcome_eventId_key_key" ON "PredictionOutcome"("eventId", "key");
CREATE INDEX IF NOT EXISTS "PredictionOutcome_eventId_sortOrder_idx" ON "PredictionOutcome"("eventId", "sortOrder");

CREATE TABLE IF NOT EXISTS "PredictionBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "outcomeId" INTEGER NOT NULL,
    "stake" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "odds" DECIMAL(8,2) NOT NULL,
    "potentialPayout" DECIMAL(16,2) NOT NULL,
    "status" "PredictionBetStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionBet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PredictionBet_userId_status_idx" ON "PredictionBet"("userId", "status");
CREATE INDEX IF NOT EXISTS "PredictionBet_eventId_status_idx" ON "PredictionBet"("eventId", "status");
CREATE INDEX IF NOT EXISTS "PredictionBet_outcomeId_status_idx" ON "PredictionBet"("outcomeId", "status");
CREATE INDEX IF NOT EXISTS "PredictionBet_userId_createdAt_idx" ON "PredictionBet"("userId", "createdAt");

ALTER TABLE "PredictionOutcome" DROP CONSTRAINT IF EXISTS "PredictionOutcome_eventId_fkey";
ALTER TABLE "PredictionOutcome" ADD CONSTRAINT "PredictionOutcome_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PredictionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PredictionBet" DROP CONSTRAINT IF EXISTS "PredictionBet_userId_fkey";
ALTER TABLE "PredictionBet" ADD CONSTRAINT "PredictionBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PredictionBet" DROP CONSTRAINT IF EXISTS "PredictionBet_eventId_fkey";
ALTER TABLE "PredictionBet" ADD CONSTRAINT "PredictionBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PredictionEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PredictionBet" DROP CONSTRAINT IF EXISTS "PredictionBet_outcomeId_fkey";
ALTER TABLE "PredictionBet" ADD CONSTRAINT "PredictionBet_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "PredictionOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
