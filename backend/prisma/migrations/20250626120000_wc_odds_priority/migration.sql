ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "priorityLevel" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "WcOddsEvent_priorityLevel_commenceTime_idx"
  ON "WcOddsEvent" ("priorityLevel" DESC, "commenceTime" ASC);
