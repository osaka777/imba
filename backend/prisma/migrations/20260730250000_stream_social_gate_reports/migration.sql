-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StreamCommentStatus" AS ENUM ('VISIBLE', 'HIDDEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "StreamComment" ADD COLUMN IF NOT EXISTS "status" "StreamCommentStatus" NOT NULL DEFAULT 'VISIBLE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "StreamCommentReport" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamCommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StreamCommentHide" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamCommentHide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamComment_streamKey_status_createdAt_idx" ON "StreamComment"("streamKey", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StreamCommentReport_commentId_userId_key" ON "StreamCommentReport"("commentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamCommentReport_commentId_idx" ON "StreamCommentReport"("commentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamCommentReport_userId_createdAt_idx" ON "StreamCommentReport"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StreamCommentHide_commentId_userId_key" ON "StreamCommentHide"("commentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamCommentHide_userId_commentId_idx" ON "StreamCommentHide"("userId", "commentId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StreamCommentReport" ADD CONSTRAINT "StreamCommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "StreamComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StreamCommentReport" ADD CONSTRAINT "StreamCommentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StreamCommentHide" ADD CONSTRAINT "StreamCommentHide_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "StreamComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StreamCommentHide" ADD CONSTRAINT "StreamCommentHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
