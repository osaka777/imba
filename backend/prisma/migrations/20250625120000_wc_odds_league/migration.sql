ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "leagueName" TEXT;
ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "tournamentId" INTEGER;

CREATE INDEX IF NOT EXISTS "WcOddsEvent_leagueName_commenceTime_idx"
  ON "WcOddsEvent"("leagueName", "commenceTime");

CREATE INDEX IF NOT EXISTS "WcOddsEvent_sportKey_commenceTime_idx"
  ON "WcOddsEvent"("sportKey", "commenceTime");
