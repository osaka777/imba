const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration fix...');
  
  try {
    // Add currencyCode to Promo
    await prisma.$executeRawUnsafe(`ALTER TABLE "Promo" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT;`);
    console.log('✅ Added currencyCode column to Promo');
    
    // Create index
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Promo_currencyCode_idx" ON "Promo"("currencyCode");`);
    console.log('✅ Created index on Promo.currencyCode');
    
    // Add foreign key
    const fkExists = await prisma.$queryRaw`SELECT 1 FROM pg_constraint WHERE conname = 'Promo_currencyCode_fkey'`;
    if (!fkExists || fkExists.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Promo" 
        ADD CONSTRAINT "Promo_currencyCode_fkey" 
        FOREIGN KEY ("currencyCode") 
        REFERENCES "Currency"("isoCode") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
      `);
      console.log('✅ Added foreign key constraint');
    } else {
      console.log('ℹ️  Foreign key already exists');
    }
    
    // Add Banner columns
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Banner" 
        ADD COLUMN IF NOT EXISTS "buttonPosXPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "buttonPosYPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "buttonText" TEXT,
        ADD COLUMN IF NOT EXISTS "descPosXPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "descPosYPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "showButton" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "showDesc" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "showTitle" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "titlePosXPct" INTEGER,
        ADD COLUMN IF NOT EXISTS "titlePosYPct" INTEGER;
    `);
    console.log('✅ Added Banner columns');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Now run: npx prisma migrate resolve --applied "20251016111506_"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
