#!/usr/bin/env node
/**
 * Hide legacy probe bets that landed on real user accounts before wc-probe@imba.internal.
 * - Marks isProbe=true (hidden from /api/feed/bets/my)
 * - Voids PENDING bets and refunds stake
 */
const {
  PrismaClient,
  WcOddsBetStatus,
  OperationSource,
  OperationStatus,
  OperationType,
} = require('@prisma/client');

const PROBE_EMAIL = process.env.WC_BET_PROBE_USER_EMAIL || 'wc-probe@imba.internal';
const PROBE_STAKE = Number(process.env.WC_BET_PROBE_STAKE || '100');

async function refundVoidBet(tx, bet, reason) {
  await tx.wcOddsBet.update({
    where: { id: bet.id },
    data: {
      isProbe: true,
      status: WcOddsBetStatus.VOID,
      settledAt: new Date(),
    },
  });

  const balance = await tx.balance.findUnique({
    where: {
      userId_currencyCode: {
        userId: bet.userId,
        currencyCode: bet.currencyCode,
      },
    },
  });
  if (!balance) {
    throw new Error(`Balance missing for user ${bet.userId}`);
  }

  await tx.balance.update({
    where: { id: balance.id },
    data: { amount: balance.amount.add(bet.stake) },
  });

  await tx.operation.create({
    data: {
      userId: bet.userId,
      amount: bet.stake,
      currencyCode: bet.currencyCode,
      source: OperationSource.WC_BET,
      status: OperationStatus.SUCCESS,
      type: OperationType.INCOME,
      meta: {
        wcBetId: bet.id,
        eventId: bet.eventId,
        void: true,
        reason,
        legacyProbeCleanup: true,
      },
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const probeUser = await prisma.user.findUnique({
      where: { email: PROBE_EMAIL },
      select: { id: true },
    });
    if (!probeUser) {
      throw new Error(`Probe user not found: ${PROBE_EMAIL}`);
    }

    const legacy = await prisma.wcOddsBet.findMany({
      where: {
        isProbe: false,
        userId: { not: probeUser.id },
        stake: PROBE_STAKE,
        createdAt: {
          gte: new Date('2026-06-28T23:09:00.000Z'),
          lte: new Date('2026-06-28T23:13:00.000Z'),
        },
      },
      orderBy: { id: 'asc' },
    });

    if (legacy.length === 0) {
      console.log('No legacy probe bets to clean up');
      return;
    }

    let voided = 0;
    let marked = 0;

    for (const bet of legacy) {
      if (bet.status === WcOddsBetStatus.PENDING) {
        await prisma.$transaction((tx) => refundVoidBet(tx, bet, 'legacy_probe_cleanup'));
        voided += 1;
        console.log(`void+refund bet #${bet.id} user=${bet.userId} stake=${bet.stake}`);
      } else {
        await prisma.wcOddsBet.update({
          where: { id: bet.id },
          data: { isProbe: true },
        });
        marked += 1;
        console.log(`mark probe bet #${bet.id} user=${bet.userId} status=${bet.status}`);
      }
    }

    console.log(`Done: ${voided} voided/refunded, ${marked} marked hidden`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
