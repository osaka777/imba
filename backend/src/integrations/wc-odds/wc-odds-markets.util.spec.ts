import {
  collectGroupedMarketsWarnings,
  countWcMarketOutcomes,
  extractMainTotalLine,
  finalizeGroupedMarkets,
  findOutcomeOdds,
  isWcBetPlacementAllowed,
  mergeFullGroupedMarketsPreservingOdds,
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

  it('maps goals-in-both-halves display keys separately from btts', () => {
    expect(normalizeWcMarketKey('display_GOALS_BOTHHALF')).toBe('goals_both_half');
    expect(normalizeWcMarketKey('display_GOALS_BOTH_HALF')).toBe('goals_both_half');
    expect(normalizeWcMarketKey('display_GOALS_BOTH_BOTHHALF')).toBe('goals_both_teams_both_halves');
    expect(normalizeWcMarketKey('display_GOALS_BOTH')).toBe('btts');
  });

  it('does not collapse specialty TOTAL_* display keys into totals', () => {
    expect(normalizeWcMarketKey('display_TOTAL_GOALS_MINUTES')).toBe('display_TOTAL_GOALS_MINUTES');
    expect(normalizeWcMarketKey('display_TOTAL_FOULS_BEFORE_1ST_YELLOW_CARD')).toBe(
      'display_TOTAL_FOULS_BEFORE_1ST_YELLOW_CARD',
    );
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

  it('ignores team/half totals and picks the balanced main match line', () => {
    const grouped: WcGroupedMarkets = {
      'Индивидуальный тотал': [
        {
          key: 'ind',
          marketKey: 'totals',
          label: '2-й тайм · Тотал · 2.5',
          outcomes: [
            { name: 'ТМ', price: 1.02, point: 2.5, outcomeKey: 'UNDER_2.5' },
            { name: 'ТБ', price: 9.75, point: 2.5, outcomeKey: 'OVER_2.5' },
          ],
        },
      ],
      Тотал: [
        {
          key: 't20',
          marketKey: 'totals',
          label: 'Тотал · 2.0',
          outcomes: [
            { name: 'ТМ', price: 2.12, point: 2, outcomeKey: 'UNDER_2.0' },
            { name: 'ТБ', price: 1.74, point: 2, outcomeKey: 'OVER_2.0' },
          ],
        },
        {
          key: 't25',
          marketKey: 'totals',
          label: 'Тотал · 2.5',
          outcomes: [
            { name: 'ТМ', price: 1.6, point: 2.5, outcomeKey: 'UNDER_2.5' },
            { name: 'ТБ', price: 2.35, point: 2.5, outcomeKey: 'OVER_2.5' },
          ],
        },
      ],
      Угловые: [
        {
          key: 'corners',
          marketKey: 'totals',
          label: 'Тотал угловых · 2.5',
          outcomes: [
            { name: 'ТМ', price: 1.9, point: 2.5, outcomeKey: 'UNDER_2.5' },
            { name: 'ТБ', price: 1.85, point: 2.5, outcomeKey: 'OVER_2.5' },
          ],
        },
      ],
    };

    expect(extractMainTotalLine(grouped)).toEqual({
      totalLine: 2,
      oddsOver: 1.74,
      oddsUnder: 2.12,
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

describe('isWcBetPlacementAllowed', () => {
  it('rejects blocked OR and HOW_WILL markets even with DISPLAY outcomes', () => {
    expect(isWcBetPlacementAllowed('display_WIN1_OR_OVER', 'DISPLAY_1_2_3')).toBe(false);
    expect(isWcBetPlacementAllowed('display_HOW_WILL_GOAL_BE_SCORED', 'DISPLAY_9_9_9')).toBe(false);
    expect(isWcBetPlacementAllowed('display_SERIESPENALTY_YES_NO', 'DISPLAY_1_1_1')).toBe(false);
    expect(isWcBetPlacementAllowed('display_CORNERS_TOTAL', 'DISPLAY_1_1_1')).toBe(false);
  });

  it('rejects handicap fallback outcome keys', () => {
    expect(isWcBetPlacementAllowed('handicap', 'HCP_12_-1.5')).toBe(false);
    expect(isWcBetPlacementAllowed('handicap', 'HOME_HCP_-1.5')).toBe(true);
  });

  it('still allows verified display markets', () => {
    expect(isWcBetPlacementAllowed('display_WIN1_AND_TOTAL', 'DISPLAY_1_2_3')).toBe(true);
    expect(isWcBetPlacementAllowed('display_NEXT_GOAL', 'DISPLAY_1_2_3')).toBe(true);
    expect(isWcBetPlacementAllowed('display_GOALS_BOTH_HALF', 'YES')).toBe(true);
  });
});

describe('mergeFullGroupedMarketsPreservingOdds', () => {
  it('drops stale categories when labels change and prefers full-snapshot prices', () => {
    const full: WcGroupedMarkets = {
      'Все голы в ворота одной стороны поля (команда 1)': [
        {
          key: '2337__base',
          marketKey: 'display_ALLGOALS_SCORED_AGAINST_ONESIDE_OF_FIELD_TEAM1_YES_NO',
          label: 'Все голы в ворота одной стороны поля (команда 1)',
          outcomes: [
            { name: 'Да', price: 1.9, outcomeKey: 'YES' },
            { name: 'Нет', price: 1.8, outcomeKey: 'NO' },
          ],
        },
      ],
    };
    const cached: WcGroupedMarkets = {
      'ALLGOALS SCORED AGAINST ONESIDE OF FIELD команда 1: да/нет': [
        {
          key: '2337__base',
          marketKey: 'display_ALLGOALS_SCORED_AGAINST_ONESIDE_OF_FIELD_TEAM1_YES_NO',
          label: 'ALLGOALS SCORED AGAINST ONESIDE OF FIELD команда 1: да/нет',
          outcomes: [
            { name: 'Да', price: 2.0, outcomeKey: 'YES' },
            { name: 'Нет', price: 1.72, outcomeKey: 'NO' },
          ],
        },
      ],
    };

    const merged = mergeFullGroupedMarketsPreservingOdds(full, cached);

    expect(Object.keys(merged)).toEqual(['Все голы в ворота одной стороны поля (команда 1)']);
    expect(merged['Все голы в ворота одной стороны поля (команда 1)']![0]!.outcomes).toEqual([
      { name: 'Да', price: 1.9, outcomeKey: 'YES' },
      { name: 'Нет', price: 1.8, outcomeKey: 'NO' },
    ]);
  });

  it('does not let stale cached prices overwrite a fresher full snapshot (live flash regression)', () => {
    const full: WcGroupedMarkets = {
      '1X2': [
        {
          key: 'h2h__base',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 1.64, outcomeKey: 'HOME' },
            { name: 'X', price: 4.2, outcomeKey: 'DRAW' },
            { name: 'П2', price: 5.5, outcomeKey: 'AWAY' },
          ],
        },
      ],
    };
    const cached: WcGroupedMarkets = {
      '1X2': [
        {
          key: 'h2h__base',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 1.15, outcomeKey: 'HOME' },
            { name: 'X', price: 7.0, outcomeKey: 'DRAW' },
            { name: 'П2', price: 12.0, outcomeKey: 'AWAY' },
          ],
        },
      ],
    };

    const merged = mergeFullGroupedMarketsPreservingOdds(full, cached);
    expect(merged['1X2']![0]!.outcomes.map((o) => o.price)).toEqual([1.64, 4.2, 5.5]);
  });
});
