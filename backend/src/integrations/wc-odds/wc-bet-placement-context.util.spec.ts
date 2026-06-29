import { buildBetPlacementContext, parseBetPlacementContext } from './wc-bet-placement-context.util';
import { emptyMatchState, tennisGameKey } from './wc-match-state.types';
import { resolveNextGoalBet } from './wc-verified-settlement.util';
import { WcOddsBetStatus } from '@prisma/client';

describe('buildBetPlacementContext', () => {
  it('stores expected goal index for NEXT_GOAL', () => {
    const ctx = buildBetPlacementContext({
      marketKey: 'display_NEXT_GOAL',
      outcomeKey: 'DISPLAY_1_2',
      homeScore: 1,
      awayScore: 0,
    });

    expect(ctx.totalGoals).toBe(1);
    expect(ctx.expectedGoalIndex).toBe(2);
  });

  it('stores tennis baseline when match state available', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(2, 5)] = {
      deuce: false,
      completed: false,
      trackedFromStart: true,
      pointWinners: { '1': 'home' },
      pointsWon: { home: 1, away: 0 },
    };

    const ctx = buildBetPlacementContext({
      marketKey: 'display_NEXT_POINTS_GAME',
      outcomeKey: 'DISPLAY_1_2_PARAMETER_GAME_NUMBER:5|PARAMETER_POINT_NUMBER:3|PARAMETER_SET_NUMBER:2',
      homeScore: 1,
      awayScore: 0,
      matchState: state,
    });

    expect(ctx.tennis).toEqual({
      setNum: 2,
      gameNum: 5,
      pointsInGameAtBet: 1,
      pointsWonAtBet: { home: 1, away: 0 },
      trackedFromStart: true,
    });
  });

  it('round-trips via parseBetPlacementContext', () => {
    const built = buildBetPlacementContext({
      marketKey: 'display_NEXT_GOAL',
      outcomeKey: null,
      homeScore: 0,
      awayScore: 0,
    });
    const parsed = parseBetPlacementContext(built);
    expect(parsed?.expectedGoalIndex).toBe(1);
    expect(parsed?.settlementProfile).toBe('SEQUENCE');
  });

  it('does not set expectedGoalIndex for timing goal markets', () => {
    const ctx = buildBetPlacementContext({
      marketKey: 'display_NEXT_GOAL_TIME_10MIN',
      outcomeKey: 'DISPLAY_2019_3502_PARAMETER_FROM:71|PARAMETER_GOAL_NUMBER:2|PARAMETER_TO:80',
      homeScore: 1,
      awayScore: 1,
    });

    expect(ctx.expectedGoalIndex).toBeUndefined();
    expect(ctx.settlementProfile).toBe('TIME_WINDOW');
    expect(ctx.fingerprint?.marketId).toBe(2019);
    expect(ctx.fingerprint?.parameters.PARAMETER_FROM).toBe('71');
  });
});

describe('resolveNextGoalBet with placement context', () => {
  it('settles next goal without explicit goal param using expectedGoalIndex', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 2,
      lastAway: 0,
      initialized: true,
      goalScorers: { '1': 'home', '2': 'away' },
    };

    expect(
      resolveNextGoalBet(
        {
          pick: null,
          marketKey: 'display_NEXT_GOAL',
          outcomeKey: 'DISPLAY_1_2',
          line: null,
          outcomeName: 'Следующий гол: П2',
          placementContext: {
            v: 1,
            homeScore: 1,
            awayScore: 0,
            totalGoals: 1,
            expectedGoalIndex: 2,
            capturedAt: new Date().toISOString(),
          },
        },
        { homeScore: 2, awayScore: 0, matchState: state },
      ),
    ).toBe(WcOddsBetStatus.WIN);
  });
});
