-- CreateEnum
CREATE TYPE "PartnerLandingTemplate" AS ENUM ('HERO_MATCH', 'EVENTS_GRID', 'PROMO_FOCUS');

-- CreateTable
CREATE TABLE "PartnerLanding" (
    "id" TEXT NOT NULL,
    "partnerUserId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template" "PartnerLandingTemplate" NOT NULL,
    "headline" TEXT,
    "subheadline" TEXT,
    "promoCode" TEXT,
    "eventRefs" TEXT[],
    "defaultSub1" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerLanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLanding_slug_key" ON "PartnerLanding"("slug");

-- CreateIndex
CREATE INDEX "PartnerLanding_partnerUserId_idx" ON "PartnerLanding"("partnerUserId");

-- CreateIndex
CREATE INDEX "PartnerLanding_slug_idx" ON "PartnerLanding"("slug");

-- AddForeignKey
ALTER TABLE "PartnerLanding" ADD CONSTRAINT "PartnerLanding_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "Affilator"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
