CREATE TABLE "WcOddsExpressBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "stake" DECIMAL(16,2) NOT NULL,
    "combinedOdds" DECIMAL(8,2) NOT NULL,
    "potentialPayout" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'KZT',
    "status" "WcOddsBetStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WcOddsExpressBet_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WcOddsBet" ADD COLUMN "wcExpressBetId" INTEGER;

CREATE INDEX "WcOddsExpressBet_userId_idx" ON "WcOddsExpressBet"("userId");
CREATE INDEX "WcOddsExpressBet_status_idx" ON "WcOddsExpressBet"("status");
CREATE INDEX "WcOddsBet_wcExpressBetId_idx" ON "WcOddsBet"("wcExpressBetId");

ALTER TABLE "WcOddsExpressBet" ADD CONSTRAINT "WcOddsExpressBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WcOddsBet" ADD CONSTRAINT "WcOddsBet_wcExpressBetId_fkey" FOREIGN KEY ("wcExpressBetId") REFERENCES "WcOddsExpressBet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
