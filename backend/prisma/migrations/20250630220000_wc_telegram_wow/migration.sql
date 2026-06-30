ALTER TABLE "User"
ADD COLUMN "telegramNotifyLiveMatch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "telegramNotifyPreMatch" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "WcEventSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "notifyGoals" BOOLEAN NOT NULL DEFAULT true,
    "notifyStart" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WcEventSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WcTelegramNotifyCursor" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "cursorKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WcTelegramNotifyCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WcEventSubscription_userId_eventId_key" ON "WcEventSubscription"("userId", "eventId");
CREATE INDEX "WcEventSubscription_eventId_idx" ON "WcEventSubscription"("eventId");
CREATE UNIQUE INDEX "WcTelegramNotifyCursor_userId_eventId_cursorKey_key" ON "WcTelegramNotifyCursor"("userId", "eventId", "cursorKey");
CREATE INDEX "WcTelegramNotifyCursor_eventId_idx" ON "WcTelegramNotifyCursor"("eventId");

ALTER TABLE "WcEventSubscription" ADD CONSTRAINT "WcEventSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WcEventSubscription" ADD CONSTRAINT "WcEventSubscription_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WcOddsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WcTelegramNotifyCursor" ADD CONSTRAINT "WcTelegramNotifyCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
