import { WcOddsBetStatus } from '@prisma/client';

import { resolveWcExpressStatus } from './wc-odds-express-settlement.util';

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

  it('returns VOID for win+void mix', () => {
    expect(
      resolveWcExpressStatus([WcOddsBetStatus.WIN, WcOddsBetStatus.VOID]),
    ).toBe(WcOddsBetStatus.VOID);
  });
});
