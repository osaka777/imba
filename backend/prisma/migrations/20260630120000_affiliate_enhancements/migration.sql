-- SubID attribution on players
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliateSubs" JSONB;

-- CPA payout settings per partner
ALTER TABLE "Affilator" ADD COLUMN IF NOT EXISTS "cpaPayoutAmount" DECIMAL(16,2);
ALTER TABLE "Affilator" ADD COLUMN IF NOT EXISTS "cpaCurrencyCode" TEXT;

-- New postback event (idempotent)
DO $$ BEGIN
  ALTER TYPE "AffiliatePostbackEvent" ADD VALUE 'promo_redeemed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
