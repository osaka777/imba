-- Reload/welcome bonuses may not reference a Promo row.
ALTER TABLE "BonusHistory" ALTER COLUMN "promoId" DROP NOT NULL;

ALTER TABLE "BonusHistory" DROP CONSTRAINT IF EXISTS "BonusHistory_promoId_fkey";

ALTER TABLE "BonusHistory"
  ADD CONSTRAINT "BonusHistory_promoId_fkey"
  FOREIGN KEY ("promoId") REFERENCES "Promo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
