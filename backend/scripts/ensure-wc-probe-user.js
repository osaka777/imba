#!/usr/bin/env node
/**
 * Service account for wc-bet-probe — not used by real users in the UI.
 * Prints numeric user id to stdout.
 */
const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');
const bcrypt = require('bcrypt');

const PROBE_EMAIL = process.env.WC_BET_PROBE_USER_EMAIL || 'wc-probe@imba.internal';
const PROBE_BALANCE = Number(process.env.WC_BET_PROBE_BALANCE || '500000');

async function main() {
  const prisma = new PrismaClient();
  try {
    let user = await prisma.user.findUnique({
      where: { email: PROBE_EMAIL },
      select: { id: true },
    });

    if (!user) {
      const password = await bcrypt.hash(`probe-${Date.now()}`, 10);
      user = await prisma.user.create({
        data: {
          email: PROBE_EMAIL,
          password,
          defaultCurrencyCode: 'KZT',
        },
        select: { id: true },
      });
    }

    await prisma.balance.upsert({
      where: {
        userId_currencyCode: {
          userId: user.id,
          currencyCode: 'KZT',
        },
      },
      create: {
        userId: user.id,
        currencyCode: 'KZT',
        amount: new Decimal(PROBE_BALANCE),
      },
      update: {},
    });

    const balance = await prisma.balance.findUnique({
      where: {
        userId_currencyCode: { userId: user.id, currencyCode: 'KZT' },
      },
      select: { amount: true },
    });
    if (balance && balance.amount.lessThan(new Decimal(10000))) {
      await prisma.balance.update({
        where: {
          userId_currencyCode: { userId: user.id, currencyCode: 'KZT' },
        },
        data: { amount: new Decimal(PROBE_BALANCE) },
      });
    }

    process.stdout.write(String(user.id));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
#!/usr/bin/env node
/**
 * Service account for wc-bet-probe — not used by real users in the UI.
 * Prints numeric user id to stdout.
 */
const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');
const bcrypt = require('bcrypt');

const PROBE_EMAIL = process.env.WC_BET_PROBE_USER_EMAIL || 'wc-probe@imba.internal';
const PROBE_BALANCE = Number(process.env.WC_BET_PROBE_BALANCE || '500000');

async function main() {
  const prisma = new PrismaClient();
  try {
    let user = await prisma.user.findUnique({
      where: { email: PROBE_EMAIL },
      select: { id: true },
    });

    if (!user) {
      const password = await bcrypt.hash(`probe-${Date.now()}`, 10);
      user = await prisma.user.create({
        data: {
          email: PROBE_EMAIL,
          password,
          defaultCurrencyCode: 'KZT',
        },
        select: { id: true },
      });
    }

    await prisma.balance.upsert({
      where: {
        userId_currencyCode: {
          userId: user.id,
          currencyCode: 'KZT',
        },
      },
      create: {
        userId: user.id,
        currencyCode: 'KZT',
        amount: new Decimal(PROBE_BALANCE),
      },
      update: {},
    });

    const balance = await prisma.balance.findUnique({
      where: {
        userId_currencyCode: { userId: user.id, currencyCode: 'KZT' },
      },
      select: { amount: true },
    });
    if (balance && balance.amount.lessThan(new Decimal(10000))) {
      await prisma.balance.update({
        where: {
          userId_currencyCode: { userId: user.id, currencyCode: 'KZT' },
        },
        data: { amount: new Decimal(PROBE_BALANCE) },
      });
    }

    process.stdout.write(String(user.id));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
