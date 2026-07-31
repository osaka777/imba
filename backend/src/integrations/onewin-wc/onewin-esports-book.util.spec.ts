import { isOneWinBookOpen } from './onewin-esports-book.util';

describe('onewin-esports-book.util', () => {
  it('closes when completed', () => {
    expect(isOneWinBookOpen({ hasOpenOdds: true, enabledOddsCount: 10 }, true)).toBe(
      false,
    );
  });

  it('respects hasOpenOdds', () => {
    expect(isOneWinBookOpen({ hasOpenOdds: false, enabledOddsCount: 5 })).toBe(false);
    expect(isOneWinBookOpen({ hasOpenOdds: true, enabledOddsCount: 0 })).toBe(true);
  });

  it('falls back to enabledOddsCount when hasOpenOdds unknown', () => {
    expect(isOneWinBookOpen({ hasOpenOdds: null, enabledOddsCount: 0 })).toBe(false);
    expect(isOneWinBookOpen({ hasOpenOdds: null, enabledOddsCount: 3 })).toBe(true);
  });

  it('stays open when snap missing (do not block bets on empty push)', () => {
    expect(isOneWinBookOpen(null)).toBe(true);
    expect(isOneWinBookOpen(undefined)).toBe(true);
  });
});
