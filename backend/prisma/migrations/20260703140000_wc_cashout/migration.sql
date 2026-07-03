-- AlterEnum
ALTER TYPE "WcOddsBetStatus" ADD VALUE 'CASHED_OUT';

-- AlterTable
ALTER TABLE "WcOddsBet" ADD COLUMN "cashoutAmount" DECIMAL(16,2);
