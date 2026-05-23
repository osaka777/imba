-- CreateTable
CREATE TABLE "EventMarkets" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "markets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMarkets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventMarkets_eventId_key" ON "EventMarkets"("eventId");

-- CreateIndex
CREATE INDEX "EventMarkets_updatedAt_idx" ON "EventMarkets"("updatedAt");

-- AddForeignKey
ALTER TABLE "EventMarkets" ADD CONSTRAINT "EventMarkets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Game"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
