import { WcOddsBetStatus } from '@prisma/client';

import { calculateWcCashoutOffer } from './wc-odds-cashout.util';

describe('calculateWcCashoutOffer', () => {
  const base = {
    stake: 1000,
    placedOdds: 2.5,
    potentialPayout: 2500,
    currentOdds: 2.0,
    outcomeSuspended: false,
    determinateResult: null,
    bettingClosed: false,
    margin: 0.05,
    winMargin: 0.02,
    minStakeRatio: 0.05,
  };

  it('offers fair live odds cashout with margin', () => {
    const result = calculateWcCashoutOffer(base);
    expect(result.available).toBe(true);
    if (!result.available) return;
    // 1000 * (2/2.5) * 0.95 = 760
    expect(result.amount).toBe(760);
    expect(result.mode).toBe('live_odds');
  });

  it('caps cashout at potential payout', () => {
    const result = calculateWcCashoutOffer({
      ...base,
      currentOdds: 4,
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.amount).toBe(2500);
  });

  it('rejects losing determinate bets', () => {
    const result = calculateWcCashoutOffer({
      ...base,
      determinateResult: WcOddsBetStatus.LOSE,
    });
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.code).toBe('losing');
  });

  it('offers near-full payout on determinate win', () => {
    const result = calculateWcCashoutOffer({
      ...base,
      determinateResult: WcOddsBetStatus.WIN,
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.amount).toBe(2450);
    expect(result.mode).toBe('determinate_win');
  });

  it('rejects suspended outcomes', () => {
    const result = calculateWcCashoutOffer({
      ...base,
      outcomeSuspended: true,
    });
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.code).toBe('suspended');
  });
});
