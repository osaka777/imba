/*
  Warnings:

  - Made the column `betApiStatus` on table `Bet` required. This step will fail if there are existing NULL values in that column.
  - Made the column `betApiStatus` on table `ExpressBet` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "betCode" TEXT,
ALTER COLUMN "betApiStatus" SET NOT NULL;

-- AlterTable
ALTER TABLE "ExpressBet" ADD COLUMN     "betCode" TEXT,
ALTER COLUMN "betApiStatus" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Bet_ocId_idx" ON "Bet"("ocId");

-- CreateIndex
CREATE INDEX "Bet_gameIdExternal_idx" ON "Bet"("gameIdExternal");

-- CreateIndex
CREATE INDEX "ExpressBet_betCode_idx" ON "ExpressBet"("betCode");
