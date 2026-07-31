ALTER TABLE "PredictionEvent" ADD COLUMN IF NOT EXISTS "titleEn" TEXT;
ALTER TABLE "PredictionEvent" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;
ALTER TABLE "PredictionEvent" ADD COLUMN IF NOT EXISTS "resolveRuleEn" TEXT;
ALTER TABLE "PredictionOutcome" ADD COLUMN IF NOT EXISTS "labelEn" TEXT;
