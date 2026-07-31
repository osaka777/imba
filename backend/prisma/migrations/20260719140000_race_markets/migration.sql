-- AlterEnum
ALTER TYPE "OperationSource" ADD VALUE IF NOT EXISTS 'RACE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RaceRoundStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RaceSide" AS ENUM ('A', 'B');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RaceBetStatus" AS ENUM ('PENDING', 'WIN', 'LOSE', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RaceRound" (
    "id" SERIAL NOT NULL,
    "pairKey" TEXT NOT NULL,
    "symbolA" TEXT NOT NULL,
    "symbolB" TEXT NOT NULL,
    "roundMs" INTEGER NOT NULL DEFAULT 300000,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "openPriceA" DECIMAL(18,8),
    "openPriceB" DECIMAL(18,8),
    "closePriceA" DECIMAL(18,8),
    "closePriceB" DECIMAL(18,8),
    "status" "RaceRoundStatus" NOT NULL DEFAULT 'OPEN',
    "result" "RaceSide",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RaceRound_pairKey_startsAt_roundMs_key" ON "RaceRound"("pairKey", "startsAt", "roundMs");
CREATE INDEX IF NOT EXISTS "RaceRound_status_endsAt_idx" ON "RaceRound"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "RaceRound_pairKey_roundMs_startsAt_idx" ON "RaceRound"("pairKey", "roundMs", "startsAt");

CREATE TABLE IF NOT EXISTS "RaceBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "side" "RaceSide" NOT NULL,
    "stake" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "odds" DECIMAL(8,2) NOT NULL,
    "potentialPayout" DECIMAL(16,2) NOT NULL,
    "status" "RaceBetStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceBet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RaceBet_userId_status_idx" ON "RaceBet"("userId", "status");
CREATE INDEX IF NOT EXISTS "RaceBet_roundId_status_idx" ON "RaceBet"("roundId", "status");
CREATE INDEX IF NOT EXISTS "RaceBet_userId_createdAt_idx" ON "RaceBet"("userId", "createdAt");

ALTER TABLE "RaceBet" DROP CONSTRAINT IF EXISTS "RaceBet_userId_fkey";
ALTER TABLE "RaceBet" ADD CONSTRAINT "RaceBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceBet" DROP CONSTRAINT IF EXISTS "RaceBet_roundId_fkey";
ALTER TABLE "RaceBet" ADD CONSTRAINT "RaceBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "RaceRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
