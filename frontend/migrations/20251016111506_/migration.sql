-- AlterTable
ALTER TABLE "Banner" 
  ADD COLUMN IF NOT EXISTS     "buttonPosXPct" INTEGER,
  ADD COLUMN IF NOT EXISTS     "buttonPosYPct" INTEGER,
  ADD COLUMN IF NOT EXISTS     "buttonText" TEXT,
  ADD COLUMN IF NOT EXISTS     "descPosXPct" INTEGER,
  ADD COLUMN IF NOT EXISTS     "descPosYPct" INTEGER,
  ADD COLUMN IF NOT EXISTS     "showButton" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS     "showDesc" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS     "showTitle" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS     "titlePosXPct" INTEGER,
  ADD COLUMN IF NOT EXISTS     "titlePosYPct" INTEGER;

-- AlterTable
ALTER TABLE "Promo" ADD COLUMN IF NOT EXISTS    "currencyCode" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Promo_currencyCode_idx" ON "Promo"("currencyCode");

-- AddForeignKey (only if it does not already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Promo_currencyCode_fkey'
  ) THEN
    ALTER TABLE "Promo" ADD CONSTRAINT "Promo_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
