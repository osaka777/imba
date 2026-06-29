-- AlterTable
ALTER TABLE "SubGame" ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "leagueName" TEXT,
ADD COLUMN     "priority" INTEGER DEFAULT 0,
ADD COLUMN     "sport" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3),
ADD COLUMN     "team1" TEXT,
ADD COLUMN     "team2" TEXT;

-- CreateIndex
CREATE INDEX "SubGame_sport_idx" ON "SubGame"("sport");

-- CreateIndex
CREATE INDEX "SubGame_leagueName_idx" ON "SubGame"("leagueName");

-- CreateIndex
CREATE INDEX "SubGame_status_idx" ON "SubGame"("status");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_subGameId_fkey" FOREIGN KEY ("subGameId") REFERENCES "SubGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;
