-- Multi-asset / multi-timeframe rounds
ALTER TABLE "BtcUpdownRound" ADD COLUMN IF NOT EXISTS "roundMs" INTEGER NOT NULL DEFAULT 300000;

-- Drop old unique and recreate with roundMs
DROP INDEX IF EXISTS "BtcUpdownRound_symbol_startsAt_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BtcUpdownRound_symbol_startsAt_roundMs_key"
  ON "BtcUpdownRound"("symbol", "startsAt", "roundMs");

CREATE INDEX IF NOT EXISTS "BtcUpdownRound_symbol_roundMs_startsAt_idx"
  ON "BtcUpdownRound"("symbol", "roundMs", "startsAt");
