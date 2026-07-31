-- AlterTable
ALTER TABLE "WcOddsBet" ADD COLUMN IF NOT EXISTS "isBonus" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WcOddsBet_isBonus_idx" ON "WcOddsBet"("isBonus");
