-- CreateTable
CREATE TABLE "GameMarkets" (
    "eventId" TEXT NOT NULL,
    "markets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameMarkets_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "GameMarkets_updatedAt_idx" ON "GameMarkets"("updatedAt");

-- CreateIndex
CREATE INDEX "Game_eventId_idx" ON "Game"("eventId");

-- CreateIndex
CREATE INDEX "Game_createdAt_idx" ON "Game"("createdAt");

-- AddForeignKey
ALTER TABLE "GameMarkets" ADD CONSTRAINT "GameMarkets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Game"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
