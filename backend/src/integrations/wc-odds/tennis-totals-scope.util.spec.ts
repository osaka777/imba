import { WcOddsBetStatus } from '@prisma/client';

import { resolveWcBetResult } from './wc-odds-settlement.util';
import { resolveDeterminateBetResult, resolveTotalsScopeTotal } from './wc-verified-settlement.util';
import {
  isMatchLevelTennisGamesTotal,
  isTennisGamePointsTotalsScope,
  parseTennisTotalsScopeFromText,
  resolveTennisMatchGamesTotal,
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

  it('does not treat match-level games total as set scope', () => {
    expect(parseTennisTotalsScopeFromText('Тотал геймов · 22.5')).toBeNull();
  });
});

describe('match-level tennis games totals', () => {
  const bet = {
    pick: null,
    marketKey: 'totals',
    outcomeKey: 'OVER_22.5',
    line: '22.5',
    outcomeName: 'Тотал геймов · 22.5 — Больше',
    placementContext: {
      totalsGroupLabel: 'Тотал геймов · 22.5',
      settlementProfile: 'SCORE' as const,
    },
  };

  const finishedDetail = {
    id: 8416715,
    competitors: [],
    eventDate: '2026-07-20T10:00:00.000Z',
    live: false,
    status: 'EVENT_CLOSED',
    statistics: [
      { code: 'score', value: '0:2' },
      { code: 'scores_by_periods', value: '5:7,5:7' },
      { code: 'match_phase', value: '100' },
    ],
  };

  const matchState = {
    v: 1 as const,
    updatedAt: '2026-07-20T21:00:00.000Z',
    result: {
      periodScores: [
        { home: 5, away: 7 },
        { home: 5, away: 7 },
      ],
      capturedAt: '2026-07-20T21:00:00.000Z',
    },
    tennis: { games: {}, gamesCompletedBySet: { '1': 12, '2': 12 } },
  };

  it('detects match-level games total label', () => {
    expect(isMatchLevelTennisGamesTotal('Тотал геймов · 22.5')).toBe(true);
    expect(isMatchLevelTennisGamesTotal('3-й сет · Тотал геймов · 12.5')).toBe(false);
  });

  it('sums games across sets (24), not set score (0+2)', () => {
    expect(resolveTennisMatchGamesTotal(finishedDetail as never, matchState)).toBe(24);
    expect(
      resolveTotalsScopeTotal(bet as never, {
        homeScore: 0,
        awayScore: 2,
        detail: finishedDetail as never,
        matchState,
      }),
    ).toBe(24);
  });

  it('settles OVER 22.5 as WIN from period games, not LOSE from sets', () => {
    expect(
      resolveWcBetResult(bet as never, 0, 2, finishedDetail as never, matchState),
    ).toBe(WcOddsBetStatus.WIN);
    expect(
      resolveDeterminateBetResult(bet as never, 0, 2, finishedDetail as never, matchState),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('settles from persisted matchState when live detail is gone', () => {
    const closedShell = {
      id: 8416715,
      competitors: [],
      eventDate: '2026-07-20T10:00:00.000Z',
      live: false,
      status: 'EVENT_CLOSED',
      statistics: [
        { code: 'score', value: '0:2' },
        { code: 'match_phase', value: '100' },
      ],
    };
    expect(
      resolveWcBetResult(bet as never, 0, 2, closedShell as never, matchState),
    ).toBe(WcOddsBetStatus.WIN);
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
      resolveDeterminateBetResult(bet as never, 1, 2, detail7games as never, matchStateOnePoint as never),
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
      resolveDeterminateBetResult(setGamesBet as never, 1, 2, detail7games as never, null),
    ).toBe(WcOddsBetStatus.WIN);
  });
});
