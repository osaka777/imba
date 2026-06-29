/*
  Warnings:

  - You are about to drop the column `cardType` on the `WithdrawRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WithdrawRequest" DROP COLUMN "cardType";

-- CreateTable
CREATE TABLE "slide" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "imagePath" TEXT,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "textPosition" TEXT NOT NULL DEFAULT 'center',
    "textVerticalPos" TEXT NOT NULL DEFAULT 'center',
    "textOffsetX" INTEGER NOT NULL DEFAULT 0,
    "textOffsetY" INTEGER NOT NULL DEFAULT 0,
    "titlePosXPct" INTEGER,
    "titlePosYPct" INTEGER,
    "descPosXPct" INTEGER,
    "descPosYPct" INTEGER,
    "showTitle" BOOLEAN NOT NULL DEFAULT true,
    "showDesc" BOOLEAN NOT NULL DEFAULT true,
    "showButton" BOOLEAN NOT NULL DEFAULT false,
    "buttonText" TEXT,
    "buttonPosXPct" INTEGER,
    "buttonPosYPct" INTEGER,
    "titleColor" TEXT NOT NULL DEFAULT '#ffffff',
    "titleSize" INTEGER NOT NULL DEFAULT 28,
    "descColor" TEXT NOT NULL DEFAULT '#ffffff',
    "descSize" INTEGER NOT NULL DEFAULT 13,
    "textShadow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slide_isActive_order_idx" ON "slide"("isActive", "order");
