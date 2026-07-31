-- CreateTable
CREATE TABLE IF NOT EXISTS "footer_badge" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT,
    "imagePath" TEXT,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "footer_badge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "footer_badge_isActive_order_idx" ON "footer_badge"("isActive", "order");

-- Seed default 1win-style trust badges (frontend static assets)
INSERT INTO "footer_badge" ("title", "imageUrl", "linkUrl", "isActive", "order", "updatedAt")
SELECT * FROM (VALUES
  ('Award Mascot', '/images/trust/badge-mascot.svg', NULL::text, true, 1, CURRENT_TIMESTAMP),
  ('Seal of Approval', '/images/trust/badge-seal.svg', NULL::text, true, 2, CURRENT_TIMESTAMP),
  ('Best Casino', '/images/trust/badge-casino.svg', NULL::text, true, 3, CURRENT_TIMESTAMP),
  ('Sports Award', '/images/trust/badge-shield.svg', NULL::text, true, 4, CURRENT_TIMESTAMP)
) AS v(title, "imageUrl", "linkUrl", "isActive", "order", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "footer_badge" LIMIT 1);
