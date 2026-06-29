import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import {
  advanceMatchState,
  advanceSoccerMatchState,
  advanceTennisMatchState,
  getTennisSetGames,
  inferTennisSetGamesFromMatchState,
  isTennisSetFinalized,
} from './wc-match-state-tracker.util';
import { emptyMatchState, tennisGameKey } from './wc-match-state.types';

function tennisDetail(
  periods: string,
  gameScore?: string,
  matchPhase?: string,
): OlimpbetEventDetail {
  const statistics: Array<{ code: string; value: string }> = [
    { code: 'scores_by_periods', value: periods },
  ];
  if (gameScore) statistics.push({ code: 'game_score', value: gameScore });
  if (matchPhase) statistics.push({ code: 'match_phase', value: matchPhase });

  return {
    id: 1,
    competitors: [],
    eventDate: '',
    statistics,
  };
}

describe('advanceTennisMatchState', () => {
  it('marks deuce when 40:40 seen in current game', () => {
    const state = emptyMatchState();
    advanceTennisMatchState(state, tennisDetail('6:4,3:6,4:3', '40:40', '3'));

    const game = state.tennis?.games[tennisGameKey(3, 8)];
    expect(game?.deuce).toBe(true);
    expect(game?.completed).toBe(false);
  });

  it('finalizes completed games when set games count increases', () => {
    let state = emptyMatchState();
    state = advanceMatchState(state, tennisDetail('6:4,3:6,4:3', '30:15', '3'), 'tennis');
    state = advanceMatchState(state, tennisDetail('6:4,3:6,5:3', undefined, '3'), 'tennis');

    expect(state.tennis?.games[tennisGameKey(3, 8)]?.completed).toBe(true);
    expect(getTennisSetGames(tennisDetail('6:4,3:6,5:3'), 3)).toEqual({ home: 5, away: 3 });
  });

  it('tracks point winners from 0:0 when game observed from start', () => {
    let state = emptyMatchState();
    state = advanceMatchState(state, tennisDetail('0:0', '0:0', '1'), 'tennis');
    state = advanceMatchState(state, tennisDetail('0:0', '15:0', '1'), 'tennis');
    state = advanceMatchState(state, tennisDetail('0:0', '15:15', '1'), 'tennis');

    const game = state.tennis?.games[tennisGameKey(1, 1)];
    expect(game?.trackedFromStart).toBe(true);
    expect(game?.pointWinners).toEqual({ '1': 'home', '2': 'away' });
    expect(game?.pointsWon).toEqual({ home: 1, away: 1 });
  });

  it('does not track points when joining mid-game', () => {
    const state = advanceMatchState(
      emptyMatchState(),
      tennisDetail('0:0', '30:15', '1'),
      'tennis',
    );

    const game = state.tennis?.games[tennisGameKey(1, 1)];
    expect(game?.trackedFromStart).toBeFalsy();
    expect(game?.pointWinners).toBeUndefined();
  });

  it('captures probability snapshots from feed', () => {
    const state = advanceMatchState(
      emptyMatchState(),
      {
        id: 1,
        competitors: [],
        eventDate: '',
        probabilities: {
          eventId: 1,
          markets: [
            {
              marketId: 1164,
              probabilities: [
                {
                  outcomeTypeId: 1382,
                  odd: 1,
                  tradingStatus: 'WON',
                  parameters: [
                    { type: 'PARAMETER_SET_NUMBER', value: '3' },
                    { type: 'PARAMETER_GAME_NUMBER', value: '8' },
                  ],
                },
              ],
            },
          ],
        },
      },
      'tennis',
    );

    expect(Object.values(state.probabilitySnapshots ?? {})).toContain('WIN');
  });

  it('records soccer goals only on score increase after baseline', () => {
    let state = emptyMatchState();
    state = advanceSoccerMatchState(state, {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 0, away: 0 },
    });
    state = advanceSoccerMatchState(state, {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 1, away: 0 },
    });

    expect(state.soccer?.goalScorers).toEqual({ '1': 'home' });
    expect(state.soccer?.lastHome).toBe(1);
  });

  it('records match minute when goal is detected', () => {
    let state = emptyMatchState();
    state = advanceSoccerMatchState(state, {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 0, away: 0 },
      statistics: [{ code: 'current_time', value: '12:30' }],
    });
    state = advanceSoccerMatchState(state, {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 1, away: 0 },
      statistics: [{ code: 'current_time', value: '73:15' }],
    });

    expect(state.soccer?.goalMinutes).toEqual({ '1': 73 });
  });

  it('does not retroactively assign goals seen on first tick', () => {
    const state = advanceSoccerMatchState(emptyMatchState(), {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 2, away: 1 },
    });

    expect(state.soccer?.goalScorers).toEqual({});
    expect(state.soccer?.initialized).toBe(true);
  });
});

describe('isTennisSetFinalized', () => {
  it('returns true when next set started', () => {
    expect(
      isTennisSetFinalized(
        tennisDetail('6:4,2:1', undefined, '2'),
        1,
      ),
    ).toBe(true);
  });
});

describe('inferTennisSetGamesFromMatchState', () => {
  it('infers 6-2 from partial game tracking when constraints are unique', () => {
    const state = emptyMatchState();
    state.tennis!.gamesCompletedBySet = { '2': 8 };
    state.tennis!.games = {
      '2:1': { deuce: false, completed: true, lastGameScore: '0:0' },
      '2:2': { deuce: false, completed: true, lastGameScore: '30:40', pointsWon: { home: 0, away: 1 }, pointWinners: { '1': 'away' } },
      '2:3': { deuce: false, completed: true, lastGameScore: '30:15' },
      '2:4': { deuce: false, completed: true, lastGameScore: '30:15', pointsWon: { home: 1, away: 0 }, pointWinners: { '1': 'home' } },
      '2:5': { deuce: false, completed: true, lastGameScore: '15:15' },
      '2:6': { deuce: false, completed: true, lastGameScore: '0:40', pointsWon: { home: 0, away: 4 }, pointWinners: { '1': 'away', '2': 'away', '3': 'away', '4': 'away' } },
      '2:7': { deuce: false, completed: true, lastGameScore: '40:15', pointsWon: { home: 4, away: 1 }, pointWinners: { '1': 'away', '2': 'home', '3': 'home', '4': 'home', '5': 'home' } },
      '2:8': { deuce: false, completed: true, lastGameScore: '40:30', pointsWon: { home: 1, away: 0 }, pointWinners: { '1': 'home' } },
    };

    expect(inferTennisSetGamesFromMatchState(state, 2)).toEqual({ home: 6, away: 2 });
  });

  it('persists setScores during live sync', () => {
    const state = emptyMatchState();
    advanceTennisMatchState(state, tennisDetail('6:4,3:6,4:3', '30:15', '3'));
    expect(state.tennis?.setScores).toEqual([
      { home: 6, away: 4 },
      { home: 3, away: 6 },
      { home: 4, away: 3 },
    ]);
  });
});
