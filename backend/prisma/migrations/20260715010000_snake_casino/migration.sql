-- AlterEnum
ALTER TYPE "OperationSource" ADD VALUE IF NOT EXISTS 'SNAKE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SnakeRoundStatus" AS ENUM ('PENDING', 'CASHED_OUT', 'LOST', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SnakeRound" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "stake" DECIMAL(16,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "status" "SnakeRoundStatus" NOT NULL DEFAULT 'PENDING',
    "multiplier" DECIMAL(10,2),
    "payout" DECIMAL(16,2),
    "lengthAtEnd" INTEGER,
    "killsAtEnd" INTEGER,
    "elapsedMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnakeRound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SnakeRound_userId_status_idx" ON "SnakeRound"("userId", "status");
CREATE INDEX IF NOT EXISTS "SnakeRound_status_startedAt_idx" ON "SnakeRound"("status", "startedAt");

ALTER TABLE "SnakeRound" DROP CONSTRAINT IF EXISTS "SnakeRound_userId_fkey";
ALTER TABLE "SnakeRound" ADD CONSTRAINT "SnakeRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
