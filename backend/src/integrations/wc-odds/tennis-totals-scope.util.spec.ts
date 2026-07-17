import { WcOddsBetStatus } from '@prisma/client';

import { resolveDeterminateBetResult } from './wc-verified-settlement.util';
import {
  isTennisGamePointsTotalsScope,
  parseTennisTotalsScopeFromText,
  tennisGamePointsPlayed,
} from './tennis-totals-scope.util';
import { tennisGameKey } from './wc-match-state.types';

describe('parseTennisTotalsScopeFromText', () => {
  it('parses game points total scope', () => {
    expect(
      parseTennisTotalsScopeFromText('3-й сет, 6-й гейм · Тотал очков · 6.5'),
    ).toEqual({ setNum: 3, gameNum: 6, unit: 'points' });
  });

  it('parses set games total scope', () => {
    expect(parseTennisTotalsScopeFromText('3-й сет · Тотал геймов · 12.5')).toEqual({
      setNum: 3,
      unit: 'games',
    });
  });
});

describe('tennis game points totals settlement', () => {
  const bet = {
    pick: null,
    marketKey: 'totals',
    outcomeKey: 'OVER_6.5',
    line: '6.5',
    outcomeName: '3-й сет, 6-й гейм · Тотал очков · 6.5 — Больше',
    placementContext: { totalsGroupLabel: '3-й сет, 6-й гейм · Тотал очков · 6.5' },
  };

  const detail7games = {
    statistics: [{ code: 'scores_by_periods', value: '6:4,3:6,4:3' }],
  };

  const matchStateOnePoint = {
    tennis: {
      games: {
        [tennisGameKey(3, 6)]: {
          completed: true,
          pointsWon: { home: 0, away: 1 },
          pointWinners: { '1': 'away' },
          trackedFromStart: true,
        },
      },
      gamesCompletedBySet: {},
      setScores: [],
    },
  };

  it('detects game points scope', () => {
    expect(isTennisGamePointsTotalsScope(bet.placementContext.totalsGroupLabel)).toBe(true);
  });

  it('does not treat set games count as game points', () => {
    expect(
      resolveDeterminateBetResult(bet, 1, 2, detail7games as never, matchStateOnePoint as never),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('reads points from match state', () => {
    expect(tennisGamePointsPlayed(matchStateOnePoint as never, 3, 6)).toBe(1);
  });

  it('still settles set games totals on set game count', () => {
    const setGamesBet = {
      ...bet,
      outcomeName: '3-й сет · Тотал геймов · 6.5 — Больше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 6.5' },
    };
    expect(
      resolveDeterminateBetResult(setGamesBet, 1, 2, detail7games as never, null),
    ).toBe(WcOddsBetStatus.WIN);
  });
});
