import { PrismaService } from '~/prisma/prisma.service';
import { USDT_PAY_AMOUNT_TOLERANCE } from './usdt-trc20.constants';

export function generatePayAmountSuffix(): number {
  return (Math.floor(Math.random() * 90) + 10) / 100;
}

export function buildPayAmount(baseAmount: number, suffix: number): number {
  return Math.round((baseAmount + suffix) * 100) / 100;
}

export function amountsMatch(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) <= USDT_PAY_AMOUNT_TOLERANCE;
}

export function usdtToSun(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

export function sunToUsdt(value: string | number): number {
  const raw = typeof value === 'string' ? value : String(value);
  return Number(raw) / 1_000_000;
}

export async function createUniquePayAmount(
  prisma: PrismaService,
  baseAmount: number,
): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const payAmount = buildPayAmount(baseAmount, generatePayAmountSuffix());
    const collision = await prisma.deposit.findFirst({
      where: {
        paymentSystem: 'USDT_TRC20',
        status: { in: ['PENDING', 'PROCESSING'] as any },
        meta: {
          path: ['payAmount'],
          equals: payAmount,
        },
      },
      select: { id: true },
    });
    if (!collision) return payAmount;
  }
  throw new Error('Could not generate unique pay amount');
}
