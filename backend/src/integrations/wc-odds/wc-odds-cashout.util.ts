import { WcOddsBetStatus } from '@prisma/client';

export type WcCashoutCalculationInput = {
  stake: number;
  placedOdds: number;
  potentialPayout: number;
  currentOdds: number | null;
  outcomeSuspended: boolean;
  determinateResult: WcOddsBetStatus | null;
  bettingClosed: boolean;
  margin: number;
  winMargin: number;
  minStakeRatio: number;
};

export type WcCashoutCalculationResult =
  | { available: false; reason: string; code: string }
  | {
      available: true;
      amount: number;
      currentOdds: number;
      placedOdds: number;
      mode: 'determinate_win' | 'determinate_void' | 'live_odds';
    };

export function roundCashoutAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Fair cashout from live odds: stake × (placedOdds / currentOdds) × (1 − margin), capped by potential payout. */
export function calculateWcCashoutOffer(
  input: WcCashoutCalculationInput,
): WcCashoutCalculationResult {
  const {
    stake,
    placedOdds,
    potentialPayout,
    currentOdds,
    outcomeSuspended,
    determinateResult,
    bettingClosed,
    margin,
    winMargin,
    minStakeRatio,
  } = input;

  if (bettingClosed && determinateResult == null) {
    return { available: false, reason: 'Приём ставок закрыт', code: 'betting_closed' };
  }

  if (determinateResult === WcOddsBetStatus.LOSE) {
    return { available: false, reason: 'Ставка проигрывает', code: 'losing' };
  }

  if (determinateResult === WcOddsBetStatus.WIN) {
    const raw = potentialPayout * (1 - winMargin);
    const amount = roundCashoutAmount(
      Math.min(potentialPayout, Math.max(stake, raw)),
    );
    if (amount < stake * minStakeRatio) {
      return { available: false, reason: 'Продажа недоступна', code: 'amount_too_low' };
    }
    return {
      available: true,
      amount,
      currentOdds: placedOdds,
      placedOdds,
      mode: 'determinate_win',
    };
  }

  if (determinateResult === WcOddsBetStatus.VOID) {
    const amount = roundCashoutAmount(stake * (1 - margin));
    if (amount < stake * minStakeRatio) {
      return { available: false, reason: 'Продажа недоступна', code: 'amount_too_low' };
    }
    return {
      available: true,
      amount,
      currentOdds: 1,
      placedOdds,
      mode: 'determinate_void',
    };
  }

  if (bettingClosed) {
    return { available: false, reason: 'Приём ставок закрыт', code: 'betting_closed' };
  }

  if (outcomeSuspended) {
    return { available: false, reason: 'Исход временно приостановлен', code: 'suspended' };
  }

  if (currentOdds == null || !Number.isFinite(currentOdds) || currentOdds <= 1) {
    return { available: false, reason: 'Коэффициент недоступен', code: 'odds_unavailable' };
  }

  if (!Number.isFinite(placedOdds) || placedOdds <= 1) {
    return { available: false, reason: 'Некорректные данные ставки', code: 'invalid_bet' };
  }

  const fairValue = stake * (placedOdds / currentOdds);
  let amount = fairValue * (1 - margin);
  amount = Math.min(potentialPayout, amount);
  amount = Math.max(0, amount);
  amount = roundCashoutAmount(amount);

  if (amount < stake * minStakeRatio) {
    return { available: false, reason: 'Продажа недоступна', code: 'amount_too_low' };
  }

  return {
    available: true,
    amount,
    currentOdds,
    placedOdds,
    mode: 'live_odds',
  };
}
