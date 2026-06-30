ALTER TABLE "User"
ADD COLUMN "telegramNotifyDeposit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "telegramNotifyWithdraw" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "telegramNotifyBets" BOOLEAN NOT NULL DEFAULT true;
