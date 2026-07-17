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

  it('offers fair live odds cashout with margin when bet is winning', () => {
    const result = calculateWcCashoutOffer(base);
    expect(result.available).toBe(true);
    if (!result.available) return;
    // 1000 * (2.5/2.0) * 0.95 = 1187.5
    expect(result.amount).toBe(1187.5);
    expect(result.mode).toBe('live_odds');
  });

  it('caps cashout at potential payout', () => {
    const result = calculateWcCashoutOffer({
      ...base,
      placedOdds: 2.5,
      potentialPayout: 2000,
      currentOdds: 1.05,
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    // 1000 * (2.5/1.05) * 0.95 = 2261.90… → capped at 2000
    expect(result.amount).toBe(2000);
  });

  it('lowers cashout when bet is losing (current odds rose)', () => {
    const result = calculateWcCashoutOffer({
      stake: 3499.99,
      placedOdds: 5.22,
      potentialPayout: 18269.95,
      currentOdds: 13.25,
      outcomeSuspended: false,
      determinateResult: null,
      bettingClosed: false,
      margin: 0.05,
      winMargin: 0.02,
      minStakeRatio: 0.05,
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    // 3499.99 * (5.22/13.25) * 0.95 ≈ 1309.92
    expect(result.amount).toBe(1309.92);
  });

  it('rejects losing determinate bets', () => {
    const result = calculateWcCashoutOffer({
      ...base,
      determinateResult: WcOddsBetStatus.LOSE,
    });
    expect(result).toEqual(
      expect.objectContaining({ available: false, code: 'losing' }),
    );
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
    expect(result).toEqual(
      expect.objectContaining({ available: false, code: 'suspended' }),
    );
  });
});
