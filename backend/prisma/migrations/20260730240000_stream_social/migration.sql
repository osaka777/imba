-- CreateTable
CREATE TABLE IF NOT EXISTS "StreamComment" (
    "id" SERIAL NOT NULL,
    "streamKey" VARCHAR(128) NOT NULL,
    "userId" INTEGER NOT NULL,
    "body" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StreamLike" (
    "id" SERIAL NOT NULL,
    "streamKey" VARCHAR(128) NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamComment_streamKey_createdAt_idx" ON "StreamComment"("streamKey", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamComment_userId_createdAt_idx" ON "StreamComment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StreamLike_streamKey_userId_key" ON "StreamLike"("streamKey", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamLike_streamKey_idx" ON "StreamLike"("streamKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamLike_userId_createdAt_idx" ON "StreamLike"("userId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StreamComment" ADD CONSTRAINT "StreamComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StreamLike" ADD CONSTRAINT "StreamLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
