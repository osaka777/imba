import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying migration...');
    
    // Add currencyCode column to Banner table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Banner" 
        ADD COLUMN IF NOT EXISTS "buttonPosXPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "buttonPosYPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "buttonText" TEXT,
        ADD COLUMN IF NOT EXISTS "descPosXPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "descPosYPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "showButton" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "showDesc" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "showTitle" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "titlePosXPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "titlePosYPct" INTEGER;
    `);
    console.log('✅ Banner columns added');

    // Add currencyCode column to Promo table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Promo" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT;
    `);
    console.log('✅ Promo.currencyCode column added');

    // Create index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Promo_currencyCode_idx" ON "Promo"("currencyCode");
    `);
    console.log('✅ Index created');

    // Add foreign key
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Promo_currencyCode_fkey'
        ) THEN
          ALTER TABLE "Promo" ADD CONSTRAINT "Promo_currencyCode_fkey" 
          FOREIGN KEY ("currencyCode") REFERENCES "Currency"("isoCode") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END$$;
    `);
    console.log('✅ Foreign key added');

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
