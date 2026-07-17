import { Decimal } from '@prisma/client/runtime/library';

type PrismaLike = {
  bonusBalance: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<unknown>;
  };
  balance: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  operation: {
    create: (args: unknown) => Promise<unknown>;
  };
  bonusHistory: {
    updateMany: (args: unknown) => Promise<unknown>;
  };
};

export async function completeBonusWageringIfNeeded(
  prisma: PrismaLike,
  userId: number,
  currencyCode: string,
  log?: (message: string) => void,
): Promise<void> {
  const bonusBalance = await prisma.bonusBalance.findUnique({
    where: { userId_currencyCode: { userId, currencyCode } },
  });

  if (!bonusBalance?.isActive || bonusBalance.isTokenBased) {
    return;
  }
  if (bonusBalance.requiresDeposit && !bonusBalance.depositActivated) {
    return;
  }
  if (bonusBalance.totalWagered.lessThan(bonusBalance.requiredWager)) {
    return;
  }

  let transferAmount = new Decimal(bonusBalance.amount);
  if (bonusBalance.maxCashout && bonusBalance.maxCashout.greaterThan(0)) {
    transferAmount = Decimal.min(transferAmount, bonusBalance.maxCashout);
  }

  if (transferAmount.greaterThan(0)) {
    await prisma.balance.upsert({
      where: { userId_currencyCode: { userId, currencyCode } },
      update: { amount: { increment: transferAmount } },
      create: { userId, currencyCode, amount: transferAmount },
    });
    await prisma.operation.create({
      data: {
        userId,
        type: 'INCOME',
        status: 'SUCCESS',
        source: 'BONUS_COMPLETE',
        amount: transferAmount,
        currencyCode,
        meta: {
          source: 'bonus_complete',
          bonusBalanceId: bonusBalance.id,
          totalWagered: bonusBalance.totalWagered.toString(),
          requiredWager: bonusBalance.requiredWager.toString(),
          maxCashout: bonusBalance.maxCashout?.toString() ?? null,
          note: 'Бонус отыгран — перевод на основной счёт',
        },
      },
    });
  }

  await prisma.bonusBalance.update({
    where: { userId_currencyCode: { userId, currencyCode } },
    data: { isActive: false, amount: 0, updatedAt: new Date() },
  });
  await prisma.bonusHistory.updateMany({
    where: {
      userId,
      currencyCode,
      isTokenBased: false,
      status: 'PENDING',
    },
    data: {
      status: 'WIN',
      completedAt: new Date(),
      notes: 'Бонус полностью отыгран',
    },
  });

  log?.(
    `User ${userId}: bonus wagering complete, transferred ${transferAmount} ${currencyCode}`,
  );
}
