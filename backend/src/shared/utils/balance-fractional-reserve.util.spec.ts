import { Decimal } from '@prisma/client/runtime/library';
import {
  computeMainAccountBetDebit,
  getBalanceFractionalPart,
  toStakeNumber,
} from './balance-fractional-reserve.util';

describe('balance-fractional-reserve', () => {
  it('keeps existing fractional part on full balance bet', () => {
    const balance = new Decimal('15000.43');
    expect(toStakeNumber(computeMainAccountBetDebit(balance, 15000.43))).toBe(15000);
    expect(getBalanceFractionalPart(balance)).toEqual(new Decimal('0.43'));
  });

  it('leaves 0.01 on whole balance all-in', () => {
    const balance = new Decimal('15000');
    expect(toStakeNumber(computeMainAccountBetDebit(balance, 15000))).toBe(14999.99);
  });

  it('does not change partial bet below floor', () => {
    const balance = new Decimal('15000.43');
    expect(toStakeNumber(computeMainAccountBetDebit(balance, 5000))).toBe(5000);
  });

  it('leaves fractional part on express-sized all-in', () => {
    const balance = new Decimal('999.87');
    expect(toStakeNumber(computeMainAccountBetDebit(balance, 999.87))).toBe(999);
  });
});
