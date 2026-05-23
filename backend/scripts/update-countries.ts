import { PrismaClient } from '@prisma/client';
import { countriesData } from '../src/data/countries';

async function updateSubcategoriesFlags() {
  console.log('Starting subcategories flags update...');
  const prisma = new PrismaClient();

  try {
    const sports = [
      'soccer', 'basketball', 'hockey', 'tennis',
      'volleyball', 'table-tennis', 'baseball', 'esports.cs',
      'esports.dota2'
    ];

    // Сначала проверим подкатегории без флагов
    const subcategoriesWithoutFlags = await prisma.subcategory.findMany({
      where: {
        OR: [
          { flag: null },
          { flag: '' },
          { flag: { not: { startsWith: '/flags/' } } }
        ]
      }
    });

    console.log(`Found ${subcategoriesWithoutFlags.length} subcategories without proper flags`);
    
    // Обновляем подкатегории без флагов
    for (const sub of subcategoriesWithoutFlags) {
      try {
        // Ищем соответствующие данные о стране
        const countryData = countriesData.find(c => c.code === sub.code);
        let flagPath = '/flags/other.webp'; // Дефолтный флаг

        // Если это специальная подкатегория
        if (['nhl', 'khl', 'wta', 'atp', 'itf'].includes(sub.code)) {
          flagPath = `/flags/${sub.code}.webp`;
        } 
        // Если это международная подкатегория
        else if (sub.code === 'international') {
          flagPath = '/flags/international.webp';
        }
        // Если это all или other
        else if (sub.code === 'all' || sub.code === 'other') {
          flagPath = `/flags/${sub.code}.webp`;
        }
        // Если нашли данные о стране
        else if (countryData) {
          flagPath = countryData.flag;
        }

        await prisma.subcategory.update({
          where: { id: sub.id },
          data: { 
            flag: flagPath,
            type: countryData ? 'country' : (
              ['nhl', 'khl', 'wta', 'atp', 'itf'].includes(sub.code) ? 'league' :
              sub.code === 'international' ? 'international' :
              sub.code === 'all' || sub.code === 'other' ? sub.code : 'other'
            )
          }
        });

        console.log(`Updated subcategory ${sub.code} (${sub.name}) with flag: ${flagPath}`);
      } catch (error) {
        console.error(`Error updating subcategory ${sub.code}:`, error);
      }
    }

    // Теперь обновляем все остальные подкатегории
    for (const sport of sports) {

      for (const country of countriesData) {
        try {
          // First, try to find existing subcategory
          const existing = await prisma.subcategory.findFirst({
            where: {
              code: country.code,
              sport: sport
            }
          });

          if (existing) {
            // Update existing subcategory
            await prisma.subcategory.update({
              where: { id: existing.id },
              data: {
                flag: country.flag,
                type: 'country'
              }
            });
          } else {
            // Create new subcategory with retry logic
            let retries = 3;
            while (retries > 0) {
              try {
                await prisma.subcategory.create({
                  data: {
                    code: country.code,
                    name: country.name,
                    sport: sport,
                    flag: country.flag,
                    type: 'country'
                  }
                });
                break; // Success, exit retry loop
              } catch (createError: any) {
                retries--;
                
                if (createError.code === 'P2002' && createError.meta?.target?.includes('code')) {
                  // Unique constraint violation - try to find existing
                  console.log(`Unique constraint violation for ${country.code}/${sport}, retries left: ${retries}`);
                  
                  // Wait a bit before retry
                  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
                  
                  // Try to find the existing record again
                  const existingAfterError = await prisma.subcategory.findFirst({
                    where: {
                      code: country.code,
                      sport: sport
                    }
                  });
                  
                  if (existingAfterError) {
                    console.log(`Found existing subcategory after constraint error: ${country.code}/${sport}`);
                    // Update it instead
                    await prisma.subcategory.update({
                      where: { id: existingAfterError.id },
                      data: {
                        flag: country.flag,
                        type: 'country'
                      }
                    });
                    break; // Success, exit retry loop
                  }
                  
                  // If we still can't find it and have retries left, continue the loop
                  if (retries > 0) {
                    console.log(`Retrying create for ${country.code}/${sport}`);
                    continue;
                  }
                }
                
                // If it's not a unique constraint error or we're out of retries, throw
                console.error(`Failed to create subcategory ${country.code}/${sport} after ${3 - retries} attempts:`, createError.message);
                throw createError;
              }
            }
          }
        } catch (error) {
          console.error(`Error updating subcategory for ${country.name} in ${sport}:`, error);
        }
      }

    }

    // Обновляем специальные флаги
    const specialFlags = {
      'nhl': '/flags/nhl.webp',
      'khl': '/flags/khl.webp',
      'wta': '/flags/wta.webp',
      'atp': '/flags/atp.webp',
      'itf': '/flags/itf.webp',
      'international': '/flags/international.webp',
      'all': '/flags/all.webp',
      'other': '/flags/other.webp'
    };

    for (const [code, flag] of Object.entries(specialFlags)) {
      for (const sport of sports) {
        try {
          await prisma.subcategory.updateMany({
            where: {
              code: code,
              sport: sport
            },
            data: {
              flag: flag,
              type: ['nhl', 'khl', 'wta', 'atp', 'itf'].includes(code) ? 'league' :
                    code === 'international' ? 'international' : code
            }
          });
        } catch (error) {
          console.error(`Error updating special flag for ${code} in ${sport}:`, error);
        }
      }
    }

    console.log('\nSubcategories flags update completed');
  } catch (error) {
    console.error('Error running subcategories flags update:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateSubcategoriesFlags();
