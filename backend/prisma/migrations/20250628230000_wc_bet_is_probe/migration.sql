-- Probe bets (wc-bet-probe script) are hidden from user coupons and admin lists.
ALTER TABLE "WcOddsBet" ADD COLUMN "isProbe" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "WcOddsBet_isProbe_idx" ON "WcOddsBet"("isProbe");
-- Probe bets (wc-bet-probe script) are hidden from user coupons and admin lists.
ALTER TABLE "WcOddsBet" ADD COLUMN "isProbe" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "WcOddsBet_isProbe_idx" ON "WcOddsBet"("isProbe");
