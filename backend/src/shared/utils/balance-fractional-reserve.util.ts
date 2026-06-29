import { Decimal } from '@prisma/client/runtime/library';

/** Минимальный остаток «копеек» (тиын), если на счёте целая сумма. */
export const DEFAULT_MIN_FRACTIONAL_RESERVE = new Decimal('0.01');

/** Дробная часть баланса (тиын после запятой). */
export function getBalanceFractionalPart(balance: Decimal): Decimal {
  const floored = balance.floor();
  const fractional = balance.minus(floored);
  return fractional.lessThan(0) ? new Decimal(0) : fractional;
}

/**
 * Сумма списания с основного счёта: снимаем только целую часть ставки,
 * на счёте остаётся дробный хвост (или минимум 0.01 при полном «олл-ине»).
 */
export function computeMainAccountBetDebit(
  balance: Decimal,
  requestedStake: Decimal | number,
  minFractionalReserve: Decimal = DEFAULT_MIN_FRACTIONAL_RESERVE,
): Decimal {
  const stake = requestedStake instanceof Decimal ? requestedStake : new Decimal(requestedStake);
  if (stake.lessThanOrEqualTo(0)) return new Decimal(0);

  let fractionalKeep = getBalanceFractionalPart(balance);
  if (fractionalKeep.isZero() && stake.greaterThanOrEqualTo(balance.minus(minFractionalReserve))) {
    fractionalKeep = Decimal.min(minFractionalReserve, balance);
  }

  const maxDebit = balance.minus(fractionalKeep);
  if (maxDebit.lessThanOrEqualTo(0)) return new Decimal(0);

  return Decimal.min(stake, maxDebit);
}

/** Округляет сумму ставки до 2 знаков для BetAPI / БД. */
export function toStakeNumber(debit: Decimal): number {
  return Number(debit.toDecimalPlaces(2, Decimal.ROUND_DOWN).toString());
}
