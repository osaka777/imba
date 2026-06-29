-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "processedCallbacks" TEXT[] DEFAULT ARRAY[]::TEXT[];
