import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

import configuration from '../src/config/configuration';
import { currencies } from './seed-data';

const prisma = new PrismaClient();

async function main() {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      create: currency,
      update: {},
      where: { isoCode: currency.isoCode },
    });
  }
  await prisma.user.upsert({
    create: {
      balances: {
        create: [
          {
            id: 1,
            amount: 10000,
            currencyCode: 'USD',
          },
          {
            id: 2,
            amount: 5000,        // например, 5000 KZT
            currencyCode: 'KZT',
          },
        ],
      },
      email: 'test@test.com',
      id: 1,
      password: await hash('closeD', configuration().PASSWORD_HASH_SALT),
    },
    update: {},
    where: { id: 1 },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
