import {
  collectGroupedMarketsWarnings,
  countWcMarketOutcomes,
  extractMainTotalLine,
  finalizeGroupedMarkets,
  findOutcomeOdds,
  normalizeWcMarketKey,
  type WcGroupedMarkets,
} from './wc-odds-markets.util';

describe('normalizeWcMarketKey', () => {
  it('normalizes display overtime totals', () => {
    expect(normalizeWcMarketKey('display_TOTAL_WITH_OT')).toBe('totals');
    expect(normalizeWcMarketKey('display_INDIVIDUAL_TOTAL_TEAM1_WITHOT')).toBe('totals_home');
    expect(normalizeWcMarketKey('display_INDIVIDUAL_TOTAL_TEAM2_WITHOT')).toBe('totals_away');
  });

  it('keeps canonical keys unchanged', () => {
    expect(normalizeWcMarketKey('totals')).toBe('totals');
    expect(normalizeWcMarketKey('handicap')).toBe('handicap');
    expect(normalizeWcMarketKey('h2h')).toBe('h2h');
  });
});

describe('countWcMarketOutcomes', () => {
  it('counts only groups with open outcomes', () => {
    const grouped: WcGroupedMarkets = {
      '1X2': [
        {
          key: 'closed',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 2.1, outcomeKey: 'HOME', suspended: true },
            { name: 'П2', price: 1.7, outcomeKey: 'AWAY', suspended: true },
          ],
        },
        {
          key: 'open',
          marketKey: 'totals',
          label: 'Тотал 2.5',
          outcomes: [
            { name: 'ТМ', price: 1.9, point: 2.5, outcomeKey: 'UNDER_2.5' },
            { name: 'ТБ', price: 1.82, point: 2.5, outcomeKey: 'OVER_2.5' },
          ],
        },
      ],
    };

    expect(countWcMarketOutcomes(grouped)).toBe(1);
  });
});

describe('extractMainTotalLine', () => {
  it('reads OVER/UNDER odds from canonical totals groups', () => {
    const grouped: WcGroupedMarkets = {
      Тотал: [
        {
          key: 'g1',
          marketKey: 'totals',
          label: 'Тотал 125.5',
          outcomes: [
            { name: 'ТМ', price: 1.9, point: 125.5, outcomeKey: 'UNDER_125.5' },
            { name: 'ТБ', price: 1.82, point: 125.5, outcomeKey: 'OVER_125.5' },
          ],
        },
      ],
    };

    expect(extractMainTotalLine(grouped)).toEqual({
      totalLine: 125.5,
      oddsOver: 1.82,
      oddsUnder: 1.9,
    });
  });
});

describe('finalizeGroupedMarkets', () => {
  it('dedupes identical market groups', () => {
    const group = {
      key: 'g1',
      marketKey: 'display_DEUSE_POINT',
      label: '9-й гейм',
      outcomes: [
        { name: 'Да', price: 3.02, outcomeKey: 'YES' },
        { name: 'Нет', price: 1.35, outcomeKey: 'NO' },
      ],
    };
    const grouped = finalizeGroupedMarkets({
      '40:40': [group, { ...group, key: 'g2' }],
    });
    expect(grouped['40:40']).toHaveLength(1);
  });

  it('keeps only three-way h2h when duplicate 1X2 groups exist', () => {
    const grouped = finalizeGroupedMarkets({
      '1X2': [
        {
          key: 'two-way',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 2.1, outcomeKey: 'HOME' },
            { name: 'П2', price: 1.7, outcomeKey: 'AWAY' },
          ],
        },
        {
          key: 'three-way',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 2.0, outcomeKey: 'HOME' },
            { name: 'X', price: 3.2, outcomeKey: 'DRAW' },
            { name: 'П2', price: 1.8, outcomeKey: 'AWAY' },
          ],
        },
      ],
    });

    expect(grouped['1X2']).toHaveLength(1);
    expect(grouped['1X2'][0].key).toBe('three-way');
  });
});

describe('collectGroupedMarketsWarnings', () => {
  it('warns when totals group lacks over/under keys', () => {
    const warnings = collectGroupedMarketsWarnings({
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
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe('totals_group_missing_over_under_keys');
  });
});

describe('findOutcomeOdds', () => {
  const grouped: WcGroupedMarkets = {
    Тотал: [
      {
        key: 'g1',
        marketKey: 'totals',
        label: 'Тотал 125.5',
        outcomes: [
          { name: 'ТМ', price: 1.9, point: 125.5, outcomeKey: 'UNDER_125.5' },
          { name: 'ТБ', price: 1.82, point: 125.5, outcomeKey: 'OVER_125.5' },
        ],
      },
    ],
  };

  it('finds odds by canonical outcome key', () => {
    expect(findOutcomeOdds(grouped, 'totals', 'OVER_125.5', '125.5')).toBe(1.82);
  });

  it('finds odds when stored market key is display_*', () => {
    const displayGrouped: WcGroupedMarkets = {
      Тотал: [
        {
          ...grouped['Тотал'][0],
          marketKey: 'display_TOTAL_WITH_OT',
        },
      ],
    };
    expect(findOutcomeOdds(displayGrouped, 'display_TOTAL_WITH_OT', 'OVER_125.5', '125.5')).toBe(1.82);
  });

  it('disambiguates even_odd groups by groupKey', () => {
    const evenOddGrouped: WcGroupedMarkets = {
      'Тотал (Чет/Нечет)': [
        {
          key: 'match__sig',
          marketKey: 'even_odd',
          label: 'Тотал (Чет/Нечет)',
          outcomes: [
            { name: 'Чет', price: 1.53, outcomeKey: 'EVEN' },
            { name: 'Нечет', price: 1.47, outcomeKey: 'ODD' },
          ],
        },
        {
          key: 'set4__sig',
          marketKey: 'even_odd',
          label: 'Тотал (Чет/Нечет) 4-й сет',
          outcomes: [
            { name: 'Чет', price: 1.4, outcomeKey: 'EVEN' },
            { name: 'Нечет', price: 1.55, outcomeKey: 'ODD' },
          ],
        },
      ],
    };

    expect(findOutcomeOdds(evenOddGrouped, 'even_odd', 'EVEN')).toBe(1.53);
    expect(findOutcomeOdds(evenOddGrouped, 'even_odd', 'EVEN', null, 'set4__sig')).toBe(1.4);
  });
});
