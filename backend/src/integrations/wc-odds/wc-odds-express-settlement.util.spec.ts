import { WcOddsBetStatus } from '@prisma/client';

import {
  computeExpressWinPayout,
  resolveExpressCombinedOdds,
  resolveWcExpressStatus,
} from './wc-odds-express-settlement.util';

describe('resolveWcExpressStatus', () => {
  it('returns LOSE if any leg lost', () => {
    expect(
      resolveWcExpressStatus([
        WcOddsBetStatus.WIN,
        WcOddsBetStatus.LOSE,
        WcOddsBetStatus.PENDING,
      ]),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('returns null while any leg pending', () => {
    expect(
      resolveWcExpressStatus([WcOddsBetStatus.WIN, WcOddsBetStatus.PENDING]),
    ).toBeNull();
  });

  it('returns WIN when all legs won', () => {
    expect(
      resolveWcExpressStatus([WcOddsBetStatus.WIN, WcOddsBetStatus.WIN]),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('returns WIN for win+void mix (void leg = odds 1.0)', () => {
    expect(
      resolveWcExpressStatus([WcOddsBetStatus.WIN, WcOddsBetStatus.VOID]),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('returns VOID when every leg voided', () => {
    expect(
      resolveWcExpressStatus([WcOddsBetStatus.VOID, WcOddsBetStatus.VOID]),
    ).toBe(WcOddsBetStatus.VOID);
  });
});

describe('resolveExpressCombinedOdds', () => {
  it('skips void legs (multiply by 1.0)', () => {
    expect(
      resolveExpressCombinedOdds([
        { status: WcOddsBetStatus.WIN, odds: 2 },
        { status: WcOddsBetStatus.VOID, odds: 3.5 },
        { status: WcOddsBetStatus.WIN, odds: 2 },
      ]),
    ).toBe(4);
  });

  it('returns 1 when all legs void', () => {
    expect(
      resolveExpressCombinedOdds([
        { status: WcOddsBetStatus.VOID, odds: 2 },
        { status: WcOddsBetStatus.VOID, odds: 1.5 },
      ]),
    ).toBe(1);
  });
});

describe('computeExpressWinPayout', () => {
  it('recalculates payout without void leg odds', () => {
    expect(
      computeExpressWinPayout(1000, [
        { status: WcOddsBetStatus.WIN, odds: 2 },
        { status: WcOddsBetStatus.VOID, odds: 4 },
        { status: WcOddsBetStatus.WIN, odds: 2 },
      ]),
    ).toBe(4000);
  });
});
