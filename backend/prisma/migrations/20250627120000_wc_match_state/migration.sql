-- Persist live match state for self-sufficient micro-market settlement
ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "matchStateJson" JSONB;
-- Persist live match state for self-sufficient micro-market settlement
ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "matchStateJson" JSONB;
