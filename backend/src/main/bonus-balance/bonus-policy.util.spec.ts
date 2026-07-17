import {
  calcDepositBonusAmount,
  calcMaxCashout,
  calcRequiredWager,
  parsePromoBonusPolicy,
} from './bonus-policy.util';

describe('bonus-policy', () => {
  it('calculates deposit bonus with cap', () => {
    const policy = parsePromoBonusPolicy(
      { percentage: 50, maxBonusAmount: 5000 },
      'DEPOSIT_BONUS',
    );
    expect(calcDepositBonusAmount(10000, policy)).toBe(5000);
    expect(calcDepositBonusAmount(1000, policy)).toBe(500);
  });

  it('calculates wager on deposit plus bonus', () => {
    const policy = parsePromoBonusPolicy(
      { percentage: 50, wagerMultiplier: 6, wagerOnDepositPlusBonus: true },
      'DEPOSIT_BONUS',
    );
    const bonus = calcDepositBonusAmount(1000, policy);
    expect(calcRequiredWager(1000, bonus, policy)).toBe(9000);
  });

  it('calculates max cashout', () => {
    const policy = parsePromoBonusPolicy(
      { maxCashoutMultiplier: 2 },
      'DEPOSIT_BONUS',
    );
    expect(calcMaxCashout(1000, policy)).toBe(2000);
  });
});
