import { validateGroupedMarketsForSmoke } from './wc-markets-smoke.util';
import type { WcGroupedMarkets } from './wc-odds-markets.util';

describe('validateGroupedMarketsForSmoke', () => {
  it('passes for canonical basketball-style markets', () => {
    const grouped: WcGroupedMarkets = {
      '1X2': [
        {
          key: 'h2h',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 2.1, outcomeKey: 'HOME' },
            { name: 'X', price: 3.2, outcomeKey: 'DRAW' },
            { name: 'П2', price: 1.7, outcomeKey: 'AWAY' },
          ],
        },
      ],
      Тотал: [
        {
          key: 't1',
          marketKey: 'totals',
          label: 'Тотал 125.5',
          outcomes: [
            { name: 'ТМ', price: 1.9, point: 125.5, outcomeKey: 'UNDER_125.5' },
            { name: 'ТБ', price: 1.82, point: 125.5, outcomeKey: 'OVER_125.5' },
          ],
        },
      ],
      Фора: [
        {
          key: 'h1',
          marketKey: 'handicap',
          label: 'Фора 7.5',
          outcomes: [
            { name: 'Ф1 (7.5)', price: 1.85, point: 7.5, outcomeKey: 'HOME_HCP_7.5' },
            { name: 'Ф2 (-7.5)', price: 1.95, point: -7.5, outcomeKey: 'AWAY_HCP_-7.5' },
          ],
        },
      ],
    };

    const result = validateGroupedMarketsForSmoke(grouped);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when totals lack OVER/UNDER keys', () => {
    const grouped: WcGroupedMarkets = {
      Тотал: [
        {
          key: 'broken',
          marketKey: 'display_TOTAL_WITH_OT',
          label: 'Тотал 125.5',
          outcomes: [
            { name: 'Тотал', price: 1.9, point: 125.5, outcomeKey: 'DISPLAY_1' },
            { name: 'Тотал', price: 1.8, point: 125.5, outcomeKey: 'DISPLAY_2' },
          ],
        },
      ],
    };

    const result = validateGroupedMarketsForSmoke(grouped);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'totals_group_missing_over_under_keys')).toBe(true);
  });
});
