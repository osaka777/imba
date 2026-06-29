import {
  extractRegulationScore,
  isMarketScopeFinalized,
  looksLikePointSetSportPeriods,
  looksLikeTennisSetPeriods,
  pickSettlementScores,
} from './olimpbet-score-scope.util';

describe('looksLikeTennisSetPeriods', () => {
  it('detects tennis set score pairs', () => {
    expect(looksLikeTennisSetPeriods([{ home: 4, away: 6 }, { home: 0, away: 4 }])).toBe(true);
  });

  it('does not treat low soccer halves as tennis sets', () => {
    expect(looksLikeTennisSetPeriods([{ home: 1, away: 0 }, { home: 2, away: 1 }])).toBe(false);
  });
});

describe('looksLikePointSetSportPeriods', () => {
  it('detects volleyball set score pairs', () => {
    expect(looksLikePointSetSportPeriods([{ home: 25, away: 21 }, { home: 19, away: 25 }])).toBe(true);
  });

  it('does not treat tennis game totals as point-set sport', () => {
    expect(looksLikePointSetSportPeriods([{ home: 4, away: 6 }, { home: 0, away: 4 }])).toBe(false);
  });
});

describe('extractRegulationScore', () => {
  it('sums two halves from scores_by_periods', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '1:0,2:1' }],
    };
    expect(extractRegulationScore(detail)).toEqual({ homeScore: 3, awayScore: 1 });
  });

  it('does not sum two tennis sets', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '4:6,0:4' }],
    };
    expect(extractRegulationScore(detail)).toBeNull();
  });

  it('sums all volleyball sets for match totals', () => {
    const detail = {
      id: 8278479,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '25:21,19:25,21:24' }],
    };
    expect(extractRegulationScore(detail)).toEqual({ homeScore: 65, awayScore: 70 });
  });
});

describe('isMarketScopeFinalized', () => {
  it('does not finalize in-play volleyball set when match_phase is unrelated status code', () => {
    const detail = {
      id: 8278479,
      competitors: [],
      eventDate: '',
      status: 'EVENT_TRADING',
      live: true,
      statistics: [
        { code: 'scores_by_periods', value: '25:21,19:25,11:20' },
        { code: 'match_phase', value: '7' },
      ],
    };

    expect(isMarketScopeFinalized(detail, { kind: 'set', index: 3 })).toBe(false);
  });

  it('finalizes set when the next set appears in scores_by_periods', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '25:21,19:25,25:20,5:3' }],
    };

    expect(isMarketScopeFinalized(detail, { kind: 'set', index: 3 })).toBe(true);
  });
});

describe('pickSettlementScores', () => {
  const detail = {
    id: 1,
    competitors: [],
    eventDate: '',
    score: { home: 3, away: 2 },
    statistics: [{ code: 'scores_by_periods', value: '1:0,1:1,1:1' }],
  };

  it('uses regulation score for regular totals', () => {
    expect(pickSettlementScores(detail, 3, 2, 'totals')).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it('uses final score for overtime totals', () => {
    expect(pickSettlementScores(detail, 3, 2, 'totals_ot')).toEqual({ homeScore: 3, awayScore: 2 });
  });

  it('uses quarter score when scope hint is present', () => {
    expect(
      pickSettlementScores(detail, 3, 2, 'handicap', 'Фора 3-я четверть 1.5: Ф1 (1.5)'),
    ).toEqual({ homeScore: 1, awayScore: 1 });
  });

  it('uses first-half score from four quarters', () => {
    const basketballDetail = {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 80, away: 70 },
      statistics: [{ code: 'scores_by_periods', value: '20:18,22:17,19:18,19:17' }],
    };
    expect(
      pickSettlementScores(basketballDetail, 80, 70, 'handicap', 'Фора 1-й тайм 1.5: Ф1 (1.5)'),
    ).toEqual({ homeScore: 42, awayScore: 35 });
  });

  it('uses all volleyball sets for unscoped match totals', () => {
    const volleyballDetail = {
      id: 8278479,
      competitors: [],
      eventDate: '',
      score: { home: 1, away: 1 },
      statistics: [{ code: 'scores_by_periods', value: '25:21,19:25,21:24' }],
    };
    expect(pickSettlementScores(volleyballDetail, 1, 1, 'totals')).toEqual({
      homeScore: 65,
      awayScore: 70,
    });
  });

  it('h2h on volleyball uses sets won not point sum', () => {
    const volleyballDetail = {
      id: 8278479,
      competitors: [],
      eventDate: '',
      score: { home: 2, away: 1 },
      statistics: [{ code: 'scores_by_periods', value: '25:21,19:25,21:24,15:25,10:25' }],
    };
    expect(pickSettlementScores(volleyballDetail, 2, 1, 'h2h')).toEqual({
      homeScore: 2,
      awayScore: 1,
    });
  });

  it('handicap on volleyball uses sets won when unscoped', () => {
    const volleyballDetail = {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 1, away: 1 },
      statistics: [{ code: 'scores_by_periods', value: '25:21,19:25,11:20' }],
    };
    expect(pickSettlementScores(volleyballDetail, 1, 1, 'handicap')).toEqual({
      homeScore: 1,
      awayScore: 1,
    });
  });
});
