-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nickname" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_nickname_key" ON "User"("nickname");
