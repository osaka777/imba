import {
  estimateTennisPointsPlayed,
  isMarketScopeFinalized,
  parseMarketScopeFromText,
  resolveTennisLiveGameCursor,
} from './olimpbet-score-scope.util';
import type { OlimpbetEventDetail } from './olimpbet-wc.types';

function tennisDetail(
  scoresByPeriods: string,
  gameScore: string,
): OlimpbetEventDetail {
  return {
    id: 1,
    competitors: [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ],
    eventDate: new Date().toISOString(),
    tournament: { sportId: 101 },
    statistics: [
      { code: 'scores_by_periods', value: scoresByPeriods },
      { code: 'game_score', value: gameScore },
    ],
    probabilities: { eventId: 1, markets: [] },
  } as OlimpbetEventDetail;
}

describe('tennis game/point market scope', () => {
  it('parses point > game > set from labels', () => {
    expect(parseMarketScopeFromText('1-й сет, 7-й гейм, 3-е очко')).toEqual({
      kind: 'point',
      setIndex: 1,
      gameIndex: 7,
      pointIndex: 3,
    });
    expect(parseMarketScopeFromText('1-й сет, 7-й гейм')).toEqual({
      kind: 'game',
      setIndex: 1,
      gameIndex: 7,
    });
    expect(parseMarketScopeFromText('1-й сет')).toEqual({ kind: 'set', index: 1 });
  });

  it('estimates points played from game_score', () => {
    expect(estimateTennisPointsPlayed('0:0')).toBe(0);
    expect(estimateTennisPointsPlayed('30:15')).toBe(3);
    expect(estimateTennisPointsPlayed('40:40')).toBe(6);
    expect(estimateTennisPointsPlayed('50:40')).toBe(7);
    expect(estimateTennisPointsPlayed('A:40')).toBe(7);
  });

  it('resolves live game cursor from set score + game_score', () => {
    const cursor = resolveTennisLiveGameCursor(tennisDetail('4:4', '30:15'));
    expect(cursor).toEqual({
      setIndex: 1,
      gamesCompleted: 8,
      currentGameIndex: 9,
      pointsPlayed: 3,
    });
  });

  it('finalizes past games and already-played points in the live game', () => {
    const detail = tennisDetail('4:4', '30:15');

    expect(isMarketScopeFinalized(detail, { kind: 'game', setIndex: 1, gameIndex: 7 })).toBe(true);
    expect(isMarketScopeFinalized(detail, { kind: 'game', setIndex: 1, gameIndex: 8 })).toBe(true);
    expect(isMarketScopeFinalized(detail, { kind: 'game', setIndex: 1, gameIndex: 9 })).toBe(false);
    expect(isMarketScopeFinalized(detail, { kind: 'game', setIndex: 1, gameIndex: 10 })).toBe(false);

    expect(
      isMarketScopeFinalized(detail, {
        kind: 'point',
        setIndex: 1,
        gameIndex: 9,
        pointIndex: 2,
      }),
    ).toBe(true);
    expect(
      isMarketScopeFinalized(detail, {
        kind: 'point',
        setIndex: 1,
        gameIndex: 9,
        pointIndex: 3,
      }),
    ).toBe(true);
    expect(
      isMarketScopeFinalized(detail, {
        kind: 'point',
        setIndex: 1,
        gameIndex: 9,
        pointIndex: 4,
      }),
    ).toBe(false);
    expect(
      isMarketScopeFinalized(detail, {
        kind: 'point',
        setIndex: 1,
        gameIndex: 6,
        pointIndex: 5,
      }),
    ).toBe(true);
  });

  it('uses matchState when feed strips scores_by_periods', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: new Date().toISOString(),
      statistics: [],
      probabilities: { eventId: 1, markets: [] },
    } as OlimpbetEventDetail;

    const matchState = {
      tennis: {
        setScores: [{ home: 0, away: 4 }],
        gamesCompletedBySet: { '1': 4 },
        games: {
          '1:5': { completed: false, lastGameScore: '40:40' },
        },
      },
    };

    const cursor = resolveTennisLiveGameCursor(detail, matchState);
    expect(cursor).toEqual({
      setIndex: 1,
      gamesCompleted: 4,
      currentGameIndex: 5,
      pointsPlayed: 6,
    });

    expect(
      isMarketScopeFinalized(detail, { kind: 'game', setIndex: 1, gameIndex: 4 }, matchState),
    ).toBe(true);
    expect(
      isMarketScopeFinalized(detail, { kind: 'point', setIndex: 1, gameIndex: 5, pointIndex: 5 }, matchState),
    ).toBe(true);
    expect(
      isMarketScopeFinalized(detail, { kind: 'point', setIndex: 1, gameIndex: 5, pointIndex: 7 }, matchState),
    ).toBe(false);
  });
});
