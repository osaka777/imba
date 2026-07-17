import { alignH2hOddsWithScore, extractListH2hOdds } from './olimpbet-list-h2h.util';

describe('olimpbet-list-h2h.util', () => {
  it('swaps inverted odds when home leads on scoreboard', () => {
    const aligned = alignH2hOddsWithScore(
      { home: 15, draw: null, away: 1.08 },
      2,
      0,
    );
    expect(aligned.home).toBe(1.08);
    expect(aligned.away).toBe(15);
  });

  it('prefers 1X2 h2h market with HOME/AWAY keys', () => {
    const odds = extractListH2hOdds(
      {
        '1X2': [
          {
            key: 'h2h-main',
            marketKey: 'h2h',
            label: '1X2',
            outcomes: [
              { name: 'П1', price: 1.42, outcomeKey: 'HOME' },
              { name: 'П2', price: 8.5, outcomeKey: 'AWAY' },
            ],
          },
        ],
        Тотал: [
          {
            key: 'bad',
            marketKey: 'h2h',
            label: 'period',
            outcomes: [
              { name: 'П1', price: 15, outcomeKey: 'OUT_1' },
              { name: 'П2', price: 1.08, outcomeKey: 'OUT_2' },
            ],
          },
        ],
      },
      { homeScore: 2, awayScore: 0 },
    );

    expect(odds.home).toBe(1.42);
    expect(odds.away).toBe(8.5);
  });
});
