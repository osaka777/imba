-- Bonus priority features: expiry notify cursors, welcome anti-abuse, free bet, weekly cashback

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registrationDeviceId" TEXT;

ALTER TABLE "BonusBalance" ADD COLUMN IF NOT EXISTS "isFreeBet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BonusBalance" ADD COLUMN IF NOT EXISTS "freeBetStake" DECIMAL(16,2);

ALTER TYPE "PromoType" ADD VALUE IF NOT EXISTS 'FREE_BET';

CREATE TABLE IF NOT EXISTS "WelcomeBonusClaim" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "registrationIp" TEXT,
  "deviceId" TEXT,
  "paymentFingerprint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WelcomeBonusClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeBonusClaim_userId_key" ON "WelcomeBonusClaim"("userId");
CREATE INDEX IF NOT EXISTS "WelcomeBonusClaim_registrationIp_idx" ON "WelcomeBonusClaim"("registrationIp");
CREATE INDEX IF NOT EXISTS "WelcomeBonusClaim_deviceId_idx" ON "WelcomeBonusClaim"("deviceId");
CREATE INDEX IF NOT EXISTS "WelcomeBonusClaim_paymentFingerprint_idx" ON "WelcomeBonusClaim"("paymentFingerprint");

ALTER TABLE "WelcomeBonusClaim" DROP CONSTRAINT IF EXISTS "WelcomeBonusClaim_userId_fkey";
ALTER TABLE "WelcomeBonusClaim" ADD CONSTRAINT "WelcomeBonusClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "BonusExpiryNotifyCursor" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "cursorKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BonusExpiryNotifyCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BonusExpiryNotifyCursor_userId_currencyCode_expiresAt_cursorKey_key"
  ON "BonusExpiryNotifyCursor"("userId", "currencyCode", "expiresAt", "cursorKey");
CREATE INDEX IF NOT EXISTS "BonusExpiryNotifyCursor_expiresAt_idx" ON "BonusExpiryNotifyCursor"("expiresAt");

ALTER TABLE "BonusExpiryNotifyCursor" DROP CONSTRAINT IF EXISTS "BonusExpiryNotifyCursor_userId_fkey";
ALTER TABLE "BonusExpiryNotifyCursor" ADD CONSTRAINT "BonusExpiryNotifyCursor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WeeklyCashbackGrant" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "netLoss" DECIMAL(16,2) NOT NULL,
  "cashbackAmount" DECIMAL(16,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyCashbackGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyCashbackGrant_userId_currencyCode_weekStart_key"
  ON "WeeklyCashbackGrant"("userId", "currencyCode", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyCashbackGrant_weekStart_idx" ON "WeeklyCashbackGrant"("weekStart");

ALTER TABLE "WeeklyCashbackGrant" DROP CONSTRAINT IF EXISTS "WeeklyCashbackGrant_userId_fkey";
ALTER TABLE "WeeklyCashbackGrant" ADD CONSTRAINT "WeeklyCashbackGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
