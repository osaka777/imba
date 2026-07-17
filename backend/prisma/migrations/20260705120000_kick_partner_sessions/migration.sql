CREATE TABLE "KickPartnerSession" (
    "id" TEXT NOT NULL,
    "partnerUserId" INTEGER NOT NULL,
    "kickChannel" TEXT NOT NULL,
    "broadcasterUserId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "hadBranding" BOOLEAN NOT NULL DEFAULT false,
    "lastStreamTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickPartnerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KickWebhookDelivery" (
    "messageId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KickWebhookDelivery_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX "KickPartnerSession_partnerUserId_startedAt_idx" ON "KickPartnerSession"("partnerUserId", "startedAt");
CREATE INDEX "KickPartnerSession_endedAt_idx" ON "KickPartnerSession"("endedAt");
CREATE INDEX "KickPartnerSession_kickChannel_idx" ON "KickPartnerSession"("kickChannel");

ALTER TABLE "KickPartnerSession" ADD CONSTRAINT "KickPartnerSession_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "Affilator"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
