-- AlterTable
ALTER TABLE "WcOddsEvent" ADD COLUMN IF NOT EXISTS "marketsJson" JSONB;

-- AlterTable
ALTER TABLE "WcOddsBet" ADD COLUMN IF NOT EXISTS "marketKey" TEXT NOT NULL DEFAULT 'h2h';
ALTER TABLE "WcOddsBet" ADD COLUMN IF NOT EXISTS "outcomeKey" TEXT;
ALTER TABLE "WcOddsBet" ADD COLUMN IF NOT EXISTS "line" TEXT;
ALTER TABLE "WcOddsBet" ADD COLUMN IF NOT EXISTS "outcomeName" TEXT;

-- h2h legacy: backfill outcomeKey from pick
UPDATE "WcOddsBet" SET "outcomeKey" = "pick"::text WHERE "outcomeKey" IS NULL AND "pick" IS NOT NULL;

ALTER TABLE "WcOddsBet" ALTER COLUMN "pick" DROP NOT NULL;
