-- Добавляем поля для интеграции с BetAPI в таблицу Bet
ALTER TABLE "Bet" ADD COLUMN "couponId" INTEGER;
ALTER TABLE "Bet" ADD COLUMN "ocId" INTEGER;
ALTER TABLE "Bet" ADD COLUMN "gameIdExternal" INTEGER;
ALTER TABLE "Bet" ADD COLUMN "betApiStatus" INTEGER DEFAULT 1;
ALTER TABLE "Bet" ADD COLUMN "betApiResponse" JSONB;

-- Добавляем поля для экспресс-ставок
ALTER TABLE "ExpressBet" ADD COLUMN "couponId" INTEGER;
ALTER TABLE "ExpressBet" ADD COLUMN "betApiStatus" INTEGER DEFAULT 1;
ALTER TABLE "ExpressBet" ADD COLUMN "betApiResponse" JSONB;

-- Индексы для оптимизации
CREATE INDEX "Bet_couponId_idx" ON "Bet"("couponId");
CREATE INDEX "Bet_betApiStatus_idx" ON "Bet"("betApiStatus");
CREATE INDEX "ExpressBet_couponId_idx" ON "ExpressBet"("couponId");
CREATE INDEX "ExpressBet_betApiStatus_idx" ON "ExpressBet"("betApiStatus");

-- Обновляем существующие ставки, помечая их как legacy (статус 0)
UPDATE "Bet" SET "betApiStatus" = 0 WHERE "couponId" IS NULL;
UPDATE "ExpressBet" SET "betApiStatus" = 0 WHERE "couponId" IS NULL;