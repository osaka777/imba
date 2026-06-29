-- CreateEnum
CREATE TYPE "WcOddsPick" AS ENUM ('HOME', 'DRAW', 'AWAY');

-- CreateEnum
CREATE TYPE "WcOddsBetStatus" AS ENUM ('PENDING', 'WIN', 'LOSE', 'VOID');

-- AlterEnum
ALTER TYPE "OperationSource" ADD VALUE 'WC_BET';

-- CreateTable
CREATE TABLE "WcOddsEvent" (
    "id" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL DEFAULT 'soccer_fifa_world_cup',
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "oddsHome" DECIMAL(8,2),
    "oddsDraw" DECIMAL(8,2),
    "oddsAway" DECIMAL(8,2),
    "bookmakerKey" TEXT,
    "bookmakerTitle" TEXT,
    "oddsUpdatedAt" TIMESTAMP(3),
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WcOddsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WcOddsBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "pick" "WcOddsPick" NOT NULL,
    "odds" DECIMAL(8,2) NOT NULL,
    "stake" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'KZT',
    "status" "WcOddsBetStatus" NOT NULL DEFAULT 'PENDING',
    "potentialPayout" DECIMAL(16,2) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WcOddsBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WcOddsEvent_commenceTime_idx" ON "WcOddsEvent"("commenceTime");

-- CreateIndex
CREATE INDEX "WcOddsEvent_completed_idx" ON "WcOddsEvent"("completed");

-- CreateIndex
CREATE INDEX "WcOddsBet_userId_idx" ON "WcOddsBet"("userId");

-- CreateIndex
CREATE INDEX "WcOddsBet_eventId_idx" ON "WcOddsBet"("eventId");

-- CreateIndex
CREATE INDEX "WcOddsBet_status_idx" ON "WcOddsBet"("status");

-- AddForeignKey
ALTER TABLE "WcOddsBet" ADD CONSTRAINT "WcOddsBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WcOddsBet" ADD CONSTRAINT "WcOddsBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WcOddsEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
