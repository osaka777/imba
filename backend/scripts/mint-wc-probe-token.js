#!/usr/bin/env node
/**
 * Mint short-lived JWT for WC bet probe (internal, uses JWT_SECRET + DB).
 * Usage: WC_BET_PROBE_USER_ID=46 node scripts/mint-wc-probe-token.js
 */
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const PROBE_EMAIL = process.env.WC_BET_PROBE_USER_EMAIL || 'wc-probe@imba.internal';

async function main() {
  const userId = Number(process.env.WC_BET_PROBE_USER_ID || '0');
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET missing');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = userId > 0
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
      : await prisma.user.findUnique({ where: { email: PROBE_EMAIL }, select: { id: true, email: true } });
    if (!user) {
      console.error(`User #${userId} not found`);
      process.exit(1);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      secret,
      { expiresIn: '2h' },
    );
    process.stdout.write(token);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
