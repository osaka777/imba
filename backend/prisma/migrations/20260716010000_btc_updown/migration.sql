-- AlterEnum
ALTER TYPE "OperationSource" ADD VALUE IF NOT EXISTS 'BTC_UPDOWN';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BtcUpdownRoundStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BtcUpdownSide" AS ENUM ('UP', 'DOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BtcUpdownBetStatus" AS ENUM ('PENDING', 'WIN', 'LOSE', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BtcUpdownRound" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT 'BTCUSDT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "openPrice" DECIMAL(18,8),
    "closePrice" DECIMAL(18,8),
    "status" "BtcUpdownRoundStatus" NOT NULL DEFAULT 'OPEN',
    "result" "BtcUpdownSide",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BtcUpdownRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BtcUpdownRound_symbol_startsAt_key" ON "BtcUpdownRound"("symbol", "startsAt");
CREATE INDEX IF NOT EXISTS "BtcUpdownRound_status_endsAt_idx" ON "BtcUpdownRound"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "BtcUpdownRound_endsAt_idx" ON "BtcUpdownRound"("endsAt");

CREATE TABLE IF NOT EXISTS "BtcUpdownBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "side" "BtcUpdownSide" NOT NULL,
    "stake" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "odds" DECIMAL(8,2) NOT NULL,
    "potentialPayout" DECIMAL(16,2) NOT NULL,
    "status" "BtcUpdownBetStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BtcUpdownBet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BtcUpdownBet_userId_status_idx" ON "BtcUpdownBet"("userId", "status");
CREATE INDEX IF NOT EXISTS "BtcUpdownBet_roundId_status_idx" ON "BtcUpdownBet"("roundId", "status");
CREATE INDEX IF NOT EXISTS "BtcUpdownBet_userId_createdAt_idx" ON "BtcUpdownBet"("userId", "createdAt");

ALTER TABLE "BtcUpdownBet" DROP CONSTRAINT IF EXISTS "BtcUpdownBet_userId_fkey";
ALTER TABLE "BtcUpdownBet" ADD CONSTRAINT "BtcUpdownBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BtcUpdownBet" DROP CONSTRAINT IF EXISTS "BtcUpdownBet_roundId_fkey";
ALTER TABLE "BtcUpdownBet" ADD CONSTRAINT "BtcUpdownBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BtcUpdownRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
