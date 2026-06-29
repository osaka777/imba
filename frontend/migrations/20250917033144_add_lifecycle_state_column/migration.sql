-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BetStatus" ADD VALUE 'CALCULATED';
ALTER TYPE "BetStatus" ADD VALUE 'RECALCULATED';
ALTER TYPE "BetStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "amountOut" DECIMAL(16,2),
ADD COLUMN     "betApiExtStatus" INTEGER,
ADD COLUMN     "lastExtStatus" INTEGER,
ADD COLUMN     "lastStatus" INTEGER,
ADD COLUMN     "lifecycleState" "BetStatus" NOT NULL DEFAULT 'PENDING';
