-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionCommentLike" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionBookmark" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PredictionCommentLike_commentId_userId_key" ON "PredictionCommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionCommentLike_userId_createdAt_idx" ON "PredictionCommentLike"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionCommentLike_commentId_idx" ON "PredictionCommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PredictionBookmark_eventId_userId_key" ON "PredictionBookmark"("eventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionBookmark_userId_createdAt_idx" ON "PredictionBookmark"("userId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PredictionCommentLike" ADD CONSTRAINT "PredictionCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PredictionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionCommentLike" ADD CONSTRAINT "PredictionCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionBookmark" ADD CONSTRAINT "PredictionBookmark_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PredictionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionBookmark" ADD CONSTRAINT "PredictionBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
