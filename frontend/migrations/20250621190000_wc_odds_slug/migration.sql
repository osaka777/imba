ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "WcOddsEvent_slug_key" ON "WcOddsEvent"("slug");
