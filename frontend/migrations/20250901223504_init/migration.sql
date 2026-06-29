-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PREMATCH', 'STARTING', 'IN_PROGRESS', 'FINISHED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('APPLIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('DIRECT_BONUS', 'DEPOSIT_BONUS', 'VOUCHER');

-- CreateEnum
CREATE TYPE "BetVariants" AS ENUM ('ORDINAR', 'EXPRESS');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('INCOME', 'OUTCOME');

-- CreateEnum
CREATE TYPE "AffilatorType" AS ENUM ('REVSHARE', 'CPA');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('WAITING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WIN', 'LOSE', 'RETURN');

-- CreateEnum
CREATE TYPE "OperationSource" AS ENUM ('BET', 'BONUS_BET', 'BONUS_COMPLETE', 'PAYMENT_SYSTEM', 'PROMO', 'AFFILIATE', 'AFFILIATE_BONUS');

-- CreateEnum
CREATE TYPE "GameBetApiType" AS ENUM ('LIVE', 'LINE');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('PENDING', 'WIN', 'LOSE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Currency" (
    "isoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("isoCode")
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusBalance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBonusReceived" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWagered" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "requiredWager" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minOdds" DECIMAL(65,30) NOT NULL DEFAULT 1.8,
    "consecutiveWins" INTEGER NOT NULL DEFAULT 0,
    "requiredConsecutiveWins" INTEGER NOT NULL DEFAULT 3,
    "currentBetAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "promoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "remainingTokens" INTEGER NOT NULL DEFAULT 0,
    "tokensPerBet" INTEGER NOT NULL DEFAULT 1,
    "isTokenBased" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BonusBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "affiliatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affilator" (
    "userId" INTEGER NOT NULL,
    "type" "AffilatorType" NOT NULL,
    "meta" JSONB,
    "trafficSource" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "percent" DECIMAL(16,2) NOT NULL DEFAULT 15,
    "affilatorsPercent" DECIMAL(16,2) NOT NULL DEFAULT 10,

    CONSTRAINT "Affilator_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Game" (
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "team1" TEXT NOT NULL,
    "team2" TEXT NOT NULL,
    "score" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'PREMATCH',
    "meta" JSONB,
    "priority" INTEGER DEFAULT 0,
    "subcategoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT,
    "flag" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "cf" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpressBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "betType" TEXT NOT NULL,
    "betVariant" "BetVariants" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "cf" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "expressBetId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promo" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 1,
    "type" "PromoType" NOT NULL,
    "value" JSONB NOT NULL,
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoOnUsers" (
    "promoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "PromoStatus" NOT NULL,

    CONSTRAINT "PromoOnUsers_pkey" PRIMARY KEY ("promoId","userId")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "source" "OperationSource" NOT NULL,
    "status" "OperationStatus" NOT NULL,
    "type" "OperationType" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "OperationStatus" NOT NULL,
    "type" TEXT NOT NULL,
    "bank" TEXT,
    "wallet" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreengoRequests" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "operationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreengoRequests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameBetApi" (
    "eventId" TEXT NOT NULL,
    "sgame_id" TEXT NOT NULL,
    "stat_id" TEXT NOT NULL,
    "ext_game_id" INTEGER,
    "game_id" INTEGER NOT NULL,
    "game_mid" INTEGER NOT NULL,
    "game_num" INTEGER NOT NULL,
    "game_dop_name" TEXT NOT NULL,
    "game_dop_name_langs" JSONB,
    "game_start" INTEGER NOT NULL,
    "game_oc_counter" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "country_name" TEXT NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "tournament_name" TEXT NOT NULL,
    "tournament_name_langs" JSONB,
    "opp_1_name" TEXT NOT NULL,
    "opp_1_name_langs" JSONB,
    "opp_2_name" TEXT NOT NULL,
    "opp_2_name_langs" JSONB,
    "opp_1_id" INTEGER NOT NULL,
    "opp_1_ids" INTEGER[],
    "opp_2_id" INTEGER NOT NULL,
    "opp_2_ids" INTEGER[],
    "opp_1_icon" TEXT NOT NULL,
    "opp_2_icon" TEXT NOT NULL,
    "sport_name" TEXT NOT NULL,
    "sport_name_langs" JSONB,
    "sport_id" INTEGER NOT NULL,
    "score_full" TEXT NOT NULL,
    "score_extra" TEXT NOT NULL,
    "score_period" TEXT NOT NULL,
    "period_name" TEXT NOT NULL,
    "stat_list" JSONB NOT NULL,
    "stat_list_extra" JSONB,
    "timer" INTEGER NOT NULL,
    "extra_time" TEXT NOT NULL,
    "pitch" TEXT,
    "game_plan" TEXT,
    "finale" BOOLEAN NOT NULL,
    "game_desk" TEXT NOT NULL,
    "game_oc_list" JSONB NOT NULL,
    "game_oc_list_id" INTEGER,
    "type" "GameBetApiType" NOT NULL,
    "status" "GameStatus" NOT NULL,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventName" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "sport" TEXT NOT NULL,

    CONSTRAINT "GameBetApi_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "BonusBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "betType" TEXT NOT NULL,
    "betVariant" "BetVariants" NOT NULL,
    "realAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "cf" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "promoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBonusAccount" (
    "id" SERIAL NOT NULL,
    "partnerId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "totalBonusGiven" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalBonusWagered" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalBonusWithdrawn" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "commissionEarned" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBonusAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "promoId" INTEGER NOT NULL,
    "promoCode" TEXT NOT NULL,
    "promoType" "PromoType" NOT NULL,
    "promoValue" JSONB NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalBonusReceived" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalWagered" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "requiredWager" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "consecutiveWins" INTEGER NOT NULL DEFAULT 0,
    "requiredConsecutiveWins" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "remainingTokens" INTEGER NOT NULL DEFAULT 0,
    "tokensPerBet" INTEGER NOT NULL DEFAULT 1,
    "isTokenBased" BOOLEAN NOT NULL DEFAULT false,
    "currencyCode" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "BonusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Balance_userId_idx" ON "Balance"("userId");

-- CreateIndex
CREATE INDEX "Balance_currencyCode_idx" ON "Balance"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_currencyCode_key" ON "Balance"("userId", "currencyCode");

-- CreateIndex
CREATE INDEX "BonusBalance_userId_idx" ON "BonusBalance"("userId");

-- CreateIndex
CREATE INDEX "BonusBalance_currencyCode_idx" ON "BonusBalance"("currencyCode");

-- CreateIndex
CREATE INDEX "BonusBalance_promoId_idx" ON "BonusBalance"("promoId");

-- CreateIndex
CREATE INDEX "BonusBalance_isActive_idx" ON "BonusBalance"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BonusBalance_userId_currencyCode_key" ON "BonusBalance"("userId", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Affilator_trafficSource_key" ON "Affilator"("trafficSource");

-- CreateIndex
CREATE UNIQUE INDEX "Affilator_uid_key" ON "Affilator"("uid");

-- CreateIndex
CREATE INDEX "Affilator_userId_idx" ON "Affilator"("userId");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "Game_sport_idx" ON "Game"("sport");

-- CreateIndex
CREATE INDEX "Game_sport_status_idx" ON "Game"("sport", "status");

-- CreateIndex
CREATE INDEX "Game_subcategoryId_idx" ON "Game"("subcategoryId");

-- CreateIndex
CREATE INDEX "Game_status_sport_subcategoryId_idx" ON "Game"("status", "sport", "subcategoryId");

-- CreateIndex
CREATE INDEX "Game_priority_createdAt_idx" ON "Game"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "Game_createdAt_updatedAt_idx" ON "Game"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Game_sport_priority_status_idx" ON "Game"("sport", "priority", "status");

-- CreateIndex
CREATE INDEX "Subcategory_sport_idx" ON "Subcategory"("sport");

-- CreateIndex
CREATE INDEX "Subcategory_isActive_idx" ON "Subcategory"("isActive");

-- CreateIndex
CREATE INDEX "Subcategory_isPriority_idx" ON "Subcategory"("isPriority");

-- CreateIndex
CREATE INDEX "Subcategory_sport_isActive_idx" ON "Subcategory"("sport", "isActive");

-- CreateIndex
CREATE INDEX "Subcategory_sport_isPriority_idx" ON "Subcategory"("sport", "isPriority");

-- CreateIndex
CREATE INDEX "Subcategory_sport_type_isActive_idx" ON "Subcategory"("sport", "type", "isActive");

-- CreateIndex
CREATE INDEX "Subcategory_code_idx" ON "Subcategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_code_sport_key" ON "Subcategory"("code", "sport");

-- CreateIndex
CREATE INDEX "ExpressBet_id_idx" ON "ExpressBet"("id");

-- CreateIndex
CREATE INDEX "ExpressBet_userId_idx" ON "ExpressBet"("userId");

-- CreateIndex
CREATE INDEX "ExpressBet_status_idx" ON "ExpressBet"("status");

-- CreateIndex
CREATE INDEX "ExpressBet_userId_status_idx" ON "ExpressBet"("userId", "status");

-- CreateIndex
CREATE INDEX "ExpressBet_status_createdAt_idx" ON "ExpressBet"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_id_idx" ON "Bet"("id");

-- CreateIndex
CREATE INDEX "Bet_gameId_idx" ON "Bet"("gameId");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_status_idx" ON "Bet"("status");

-- CreateIndex
CREATE INDEX "Bet_gameId_betType_idx" ON "Bet"("gameId", "betType");

-- CreateIndex
CREATE INDEX "Bet_gameId_betType_status_idx" ON "Bet"("gameId", "betType", "status");

-- CreateIndex
CREATE INDEX "Bet_userId_status_idx" ON "Bet"("userId", "status");

-- CreateIndex
CREATE INDEX "Bet_status_createdAt_idx" ON "Bet"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_expressBetId_idx" ON "Bet"("expressBetId");

-- CreateIndex
CREATE UNIQUE INDEX "Promo_code_key" ON "Promo"("code");

-- CreateIndex
CREATE INDEX "Promo_validUntil_idx" ON "Promo"("validUntil");

-- CreateIndex
CREATE INDEX "Promo_available_idx" ON "Promo"("available");

-- CreateIndex
CREATE INDEX "Promo_type_idx" ON "Promo"("type");

-- CreateIndex
CREATE INDEX "Promo_createdAt_idx" ON "Promo"("createdAt");

-- CreateIndex
CREATE INDEX "Promo_partnerId_idx" ON "Promo"("partnerId");

-- CreateIndex
CREATE INDEX "PromoOnUsers_status_idx" ON "PromoOnUsers"("status");

-- CreateIndex
CREATE INDEX "PromoOnUsers_userId_idx" ON "PromoOnUsers"("userId");

-- CreateIndex
CREATE INDEX "PromoOnUsers_promoId_status_idx" ON "PromoOnUsers"("promoId", "status");

-- CreateIndex
CREATE INDEX "Operation_userId_idx" ON "Operation"("userId");

-- CreateIndex
CREATE INDEX "Operation_type_idx" ON "Operation"("type");

-- CreateIndex
CREATE INDEX "Operation_status_idx" ON "Operation"("status");

-- CreateIndex
CREATE INDEX "Operation_userId_status_idx" ON "Operation"("userId", "status");

-- CreateIndex
CREATE INDEX "Operation_userId_type_idx" ON "Operation"("userId", "type");

-- CreateIndex
CREATE INDEX "Operation_status_createdAt_idx" ON "Operation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Operation_source_idx" ON "Operation"("source");

-- CreateIndex
CREATE INDEX "BonusBet_id_idx" ON "BonusBet"("id");

-- CreateIndex
CREATE INDEX "BonusBet_gameId_idx" ON "BonusBet"("gameId");

-- CreateIndex
CREATE INDEX "BonusBet_userId_idx" ON "BonusBet"("userId");

-- CreateIndex
CREATE INDEX "BonusBet_status_idx" ON "BonusBet"("status");

-- CreateIndex
CREATE INDEX "BonusBet_gameId_betType_idx" ON "BonusBet"("gameId", "betType");

-- CreateIndex
CREATE INDEX "BonusBet_gameId_betType_status_idx" ON "BonusBet"("gameId", "betType", "status");

-- CreateIndex
CREATE INDEX "BonusBet_userId_status_idx" ON "BonusBet"("userId", "status");

-- CreateIndex
CREATE INDEX "BonusBet_status_createdAt_idx" ON "BonusBet"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BonusBet_promoId_idx" ON "BonusBet"("promoId");

-- CreateIndex
CREATE INDEX "PartnerBonusAccount_partnerId_idx" ON "PartnerBonusAccount"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerBonusAccount_currencyCode_idx" ON "PartnerBonusAccount"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBonusAccount_partnerId_currencyCode_key" ON "PartnerBonusAccount"("partnerId", "currencyCode");

-- CreateIndex
CREATE INDEX "BonusHistory_userId_idx" ON "BonusHistory"("userId");

-- CreateIndex
CREATE INDEX "BonusHistory_status_idx" ON "BonusHistory"("status");

-- CreateIndex
CREATE INDEX "BonusHistory_appliedAt_idx" ON "BonusHistory"("appliedAt");

-- CreateIndex
CREATE INDEX "BonusHistory_userId_status_idx" ON "BonusHistory"("userId", "status");

-- CreateIndex
CREATE INDEX "BonusHistory_promoId_idx" ON "BonusHistory"("promoId");

-- CreateIndex
CREATE INDEX "BonusHistory_currencyCode_idx" ON "BonusHistory"("currencyCode");

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusBalance" ADD CONSTRAINT "BonusBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusBalance" ADD CONSTRAINT "BonusBalance_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusBalance" ADD CONSTRAINT "BonusBalance_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_affiliatedById_fkey" FOREIGN KEY ("affiliatedById") REFERENCES "Affilator"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affilator" ADD CONSTRAINT "Affilator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressBet" ADD CONSTRAINT "ExpressBet_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressBet" ADD CONSTRAINT "ExpressBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_expressBetId_fkey" FOREIGN KEY ("expressBetId") REFERENCES "ExpressBet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("eventId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoOnUsers" ADD CONSTRAINT "PromoOnUsers_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoOnUsers" ADD CONSTRAINT "PromoOnUsers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawRequest" ADD CONSTRAINT "WithdrawRequest_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawRequest" ADD CONSTRAINT "WithdrawRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusBet" ADD CONSTRAINT "BonusBet_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusBet" ADD CONSTRAINT "BonusBet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("eventId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BonusBet" ADD CONSTRAINT "BonusBet_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusBet" ADD CONSTRAINT "BonusBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBonusAccount" ADD CONSTRAINT "PartnerBonusAccount_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusHistory" ADD CONSTRAINT "BonusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusHistory" ADD CONSTRAINT "BonusHistory_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusHistory" ADD CONSTRAINT "BonusHistory_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") ON DELETE RESTRICT ON UPDATE CASCADE;
