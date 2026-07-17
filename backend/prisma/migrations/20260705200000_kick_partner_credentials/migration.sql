-- CreateTable
CREATE TABLE "KickPartnerCredential" (
    "partnerUserId" INTEGER NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenRefreshFailedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickPartnerCredential_pkey" PRIMARY KEY ("partnerUserId")
);

-- AddForeignKey
ALTER TABLE "KickPartnerCredential" ADD CONSTRAINT "KickPartnerCredential_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "Affilator"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
