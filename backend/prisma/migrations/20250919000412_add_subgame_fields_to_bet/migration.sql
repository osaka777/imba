-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "subGameId" INTEGER,
ADD COLUMN     "subGameName" TEXT;

-- CreateIndex
CREATE INDEX "Bet_subGameId_idx" ON "Bet"("subGameId");

-- CreateIndex
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_betApiStatus_updatedAt_idx" ON "Bet"("betApiStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "Bet_status_betApiStatus_idx" ON "Bet"("status", "betApiStatus");

-- CreateIndex
CREATE INDEX "Bet_gameId_userId_status_idx" ON "Bet"("gameId", "userId", "status");

-- CreateIndex
CREATE INDEX "Bet_currencyCode_status_createdAt_idx" ON "Bet"("currencyCode", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_gameId_subGameId_status_idx" ON "Bet"("gameId", "subGameId", "status");

-- CreateIndex
CREATE INDEX "BonusHistory_status_appliedAt_idx" ON "BonusHistory"("status", "appliedAt");

-- CreateIndex
CREATE INDEX "BonusHistory_userId_promoType_status_idx" ON "BonusHistory"("userId", "promoType", "status");

-- CreateIndex
CREATE INDEX "BonusHistory_promoId_status_appliedAt_idx" ON "BonusHistory"("promoId", "status", "appliedAt");

-- CreateIndex
CREATE INDEX "BonusHistory_currencyCode_status_appliedAt_idx" ON "BonusHistory"("currencyCode", "status", "appliedAt");

-- CreateIndex
CREATE INDEX "Game_sport_leagueName_status_idx" ON "Game"("sport", "leagueName", "status");

-- CreateIndex
CREATE INDEX "Game_status_priority_createdAt_idx" ON "Game"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Game_sport_priority_createdAt_idx" ON "Game"("sport", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Operation_userId_type_status_idx" ON "Operation"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "Operation_source_status_createdAt_idx" ON "Operation"("source", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Operation_currencyCode_status_idx" ON "Operation"("currencyCode", "status");

-- CreateIndex
CREATE INDEX "Operation_type_createdAt_idx" ON "Operation"("type", "createdAt");
