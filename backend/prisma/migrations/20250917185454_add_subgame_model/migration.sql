-- CreateTable
CREATE TABLE "SubGame" (
    "id" SERIAL NOT NULL,
    "parentEventId" TEXT NOT NULL,
    "subEventId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "gameNum" INTEGER NOT NULL,
    "gameName" TEXT NOT NULL,
    "gameStart" INTEGER,
    "status" TEXT,
    "score" TEXT,
    "markets" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubGame_subEventId_key" ON "SubGame"("subEventId");

-- CreateIndex
CREATE INDEX "SubGame_parentEventId_idx" ON "SubGame"("parentEventId");

-- CreateIndex
CREATE INDEX "SubGame_subEventId_idx" ON "SubGame"("subEventId");

-- CreateIndex
CREATE INDEX "SubGame_gameId_idx" ON "SubGame"("gameId");

-- CreateIndex
CREATE INDEX "SubGame_createdAt_idx" ON "SubGame"("createdAt");

-- CreateIndex
CREATE INDEX "SubGame_updatedAt_idx" ON "SubGame"("updatedAt");

-- AddForeignKey
ALTER TABLE "SubGame" ADD CONSTRAINT "SubGame_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "Game"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
