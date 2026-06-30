import { WcOddsBetStatus } from '@prisma/client';

import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import { emptyMatchState, tennisGameKey } from './wc-match-state.types';
import {
  resolveDeucePointBet,
  resolveDeterminateBetResult,
  resolveExactGoalsBet,
  resolveGoalIntervalYesNoBet,
  resolveGoalsTeamBet,
  resolveLastEventBet,
  resolveNextGoalBet,
  resolveNextGoalHalfBet,
  resolveNextPointGameBet,
  resolveRaceToGameBet,
  resolveRaceToPointGameBet,
  resolveScoreSetGameBet,
  resolveMultiscoreSetBet,
  resolveMatchCorrectScoreBet,
  resolveWinAndTotalBet,
  resolveTimeWindowBet,
  resolveToQualifyBet,
  resolveVerifiedBetResult,
  resolveWinner2GamesSetBet,
  resolveWinnerGameBet,
  resolveWinnerSetBet,
} from './wc-verified-settlement.util';

describe('resolveDeucePointBet', () => {
  const betYes = {
    pick: null,
    marketKey: 'display_DEUSE_POINT',
    outcomeKey: 'DISPLAY_1164_1382_PARAMETER_GAME_NUMBER:8|PARAMETER_SET_NUMBER:3',
    line: null,
    outcomeName: 'Дьюс 3-й сет 8-й гейм: Да',
  };

  const betNo = {
    ...betYes,
    outcomeName: 'Дьюс 3-й сет 8-й гейм: Нет',
  };

  it('wins Yes immediately when deuce flag set', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(3, 8)] = { deuce: true, completed: false };

    expect(resolveDeucePointBet(betYes, { homeScore: 1, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('wins No when game completed without deuce', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(3, 8)] = { deuce: false, completed: true };

    expect(resolveDeucePointBet(betNo, { homeScore: 1, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('loses Yes when game completed without deuce', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(3, 8)] = { deuce: false, completed: true };

    expect(resolveDeucePointBet(betYes, { homeScore: 1, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.LOSE);
  });
});

describe('resolveNextPointGameBet', () => {
  const betP1 = {
    pick: null,
    marketKey: 'display_NEXT_POINTS_GAME',
    outcomeKey: 'DISPLAY_1182_1461_PARAMETER_GAME_NUMBER:6|PARAMETER_POINT_NUMBER:2|PARAMETER_SET_NUMBER:3',
    line: null,
    outcomeName: 'Следующее очко в gейме: П1',
  };

  it('wins when tracked point winner matches pick', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(3, 6)] = {
      deuce: false,
      completed: false,
      trackedFromStart: true,
      pointWinners: { '2': 'home' },
    };

    expect(resolveNextPointGameBet(betP1, { homeScore: 1, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('returns null without trackedFromStart', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(3, 6)] = {
      deuce: false,
      completed: true,
      pointWinners: { '2': 'home' },
    };

    expect(resolveNextPointGameBet(betP1, { homeScore: 1, awayScore: 1, matchState: state }))
      .toBeNull();
  });

  it('loses when game ended before point was played', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(3, 6)] = {
      deuce: false,
      completed: true,
      trackedFromStart: true,
      pointWinners: { '1': 'away' },
    };

    expect(resolveNextPointGameBet(betP1, { homeScore: 1, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.LOSE);
  });
});

describe('resolveRaceToPointGameBet', () => {
  const betP1 = {
    pick: null,
    marketKey: 'display_RACE_TO_POINT_GAME',
    outcomeKey: 'DISPLAY_1_2_PARAMETER_GAME_NUMBER:4|PARAMETER_POINT_NUMBER:3|PARAMETER_SET_NUMBER:2',
    line: null,
    outcomeName: 'Гонка по очкам: П1',
  };

  it('wins when side reaches target points first', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(2, 4)] = {
      deuce: false,
      completed: false,
      trackedFromStart: true,
      pointsWon: { home: 3, away: 1 },
    };

    expect(resolveRaceToPointGameBet(betP1, { homeScore: 1, awayScore: 0, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('loses when opponent reaches target first', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(2, 4)] = {
      deuce: false,
      completed: false,
      trackedFromStart: true,
      pointsWon: { home: 1, away: 3 },
    };

    expect(resolveRaceToPointGameBet(betP1, { homeScore: 1, awayScore: 0, matchState: state }))
      .toBe(WcOddsBetStatus.LOSE);
  });
});

describe('resolveRaceToGameBet', () => {
  const betP2 = {
    pick: null,
    marketKey: 'display_RACE_TO_GAME',
    outcomeKey: 'DISPLAY_1_2_PARAMETER_NUMBER:3|PARAMETER_SET_NUMBER:1',
    line: null,
    outcomeName: 'Гонка по геймам: П2',
  };

  it('wins when away reaches target games in set', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '2:3' }],
    };

    expect(
      resolveRaceToGameBet(betP2, {
        homeScore: 0,
        awayScore: 0,
        detail,
        matchState: emptyMatchState(),
      }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveNextGoalHalfBet', () => {
  const betFirstHalfHome = {
    pick: null,
    marketKey: 'display_NEXT_GOAL_HALF',
    outcomeKey: 'DISPLAY_1192_1481_PARAMETER_GOAL_NUMBER:1|PARAMETER_HALF_NUMBER:1',
    line: null,
    outcomeName: '1-й тайм: П1',
  };

  it('loses when first-half goal never came but second half had goals', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 1,
      lastAway: 1,
      initialized: true,
      goalScorers: { '1': 'home', '2': 'away' },
      goalMinutes: { '1': 72, '2': 90 },
    };

    expect(
      resolveNextGoalHalfBet(betFirstHalfHome, {
        homeScore: 1,
        awayScore: 1,
        matchState: state,
      }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('wins when scoped first-half goal matches pick', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 1,
      lastAway: 0,
      initialized: true,
      goalScorers: { '1': 'home' },
      goalMinutes: { '1': 12 },
    };

    expect(
      resolveNextGoalHalfBet(betFirstHalfHome, {
        homeScore: 1,
        awayScore: 0,
        matchState: state,
      }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveToQualifyBet', () => {
  const betHomeQualify = {
    pick: null,
    marketKey: 'display_TO_QUALIFY',
    outcomeKey: 'DISPLAY_1006_1012_base',
    line: null,
    outcomeName: 'Проход: П1',
  };

  it('settles from penalty shootout snapshot when feed is stripped', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 1,
      lastAway: 1,
      initialized: true,
      penaltyScore: { home: 2, away: 3 },
    };

    expect(
      resolveToQualifyBet(betHomeQualify, {
        homeScore: 1,
        awayScore: 1,
        matchState: state,
      }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('settles from outright winner when scores differ', () => {
    expect(
      resolveToQualifyBet(betHomeQualify, {
        homeScore: 2,
        awayScore: 1,
        detail: {
          id: 1,
          competitors: [],
          eventDate: '',
          status: 'EVENT_CLOSED',
        },
      }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveNextGoalBet', () => {
  const betHomeGoal2 = {
    pick: null,
    marketKey: 'display_NEXT_GOAL',
    outcomeKey: 'DISPLAY_1_2_PARAMETER_NUMBER:2',
    line: null,
    outcomeName: 'Следующий гол: П1',
  };

  it('wins when tracked goal matches pick', () => {
    const state = emptyMatchState();
    state.soccer = { lastHome: 2, lastAway: 0, initialized: true, goalScorers: { '1': 'home', '2': 'home' } };

    expect(resolveNextGoalBet(betHomeGoal2, { homeScore: 2, awayScore: 0, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('ignores timing goal markets', () => {
    expect(
      resolveNextGoalBet(
        {
          pick: null,
          marketKey: 'display_NEXT_GOAL_TIME_10MIN',
          outcomeKey: 'DISPLAY_2019_3502_PARAMETER_FROM:71|PARAMETER_GOAL_NUMBER:2|PARAMETER_TO:80',
          line: null,
          outcomeName: 'Гол 71-80',
        },
        { homeScore: 1, awayScore: 1, matchState: emptyMatchState() },
      ),
    ).toBeNull();
  });

  it('returns null without goal param or placement context', () => {
    expect(
      resolveNextGoalBet(
        {
          pick: null,
          marketKey: 'display_NEXT_GOAL',
          outcomeKey: 'DISPLAY_1_2',
          line: null,
          outcomeName: 'Следующий гол: П1',
        },
        { homeScore: 1, awayScore: 0, matchState: emptyMatchState() },
      ),
    ).toBeNull();
  });
});

describe('resolveGoalIntervalYesNoBet', () => {
  const yesBet = {
    pick: null,
    marketKey: 'display_GOAL15MIN_YES_NO',
    outcomeKey: 'DISPLAY_1995_3381_PARAMETER_FROM:1|PARAMETER_TO:15',
    line: null,
    outcomeName: 'GOAL15MIN: да/нет 1–15 мин: Да',
  };

  const noBet = {
    ...yesBet,
    outcomeKey: 'DISPLAY_1995_3382_PARAMETER_FROM:1|PARAMETER_TO:15',
    outcomeName: 'GOAL15MIN: да/нет 1–15 мин: Нет',
  };

  it('wins YES when any goal falls inside the interval', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 1,
      lastAway: 0,
      initialized: true,
      goalScorers: { '1': 'home' },
      goalMinutes: { '1': 1 },
    };

    expect(resolveGoalIntervalYesNoBet(yesBet, { homeScore: 1, awayScore: 0, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('loses YES after the interval closes without a goal', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 0,
      lastAway: 0,
      initialized: true,
      goalScorers: {},
      goalMinutes: {},
    };

    expect(
      resolveGoalIntervalYesNoBet(yesBet, {
        homeScore: 0,
        awayScore: 0,
        matchState: state,
        detail: {
          id: 1,
          competitors: [],
          eventDate: '',
          statistics: [{ code: 'current_time', value: '16' }],
        },
      }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('wins NO after the interval closes without a goal', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 0,
      lastAway: 0,
      initialized: true,
      goalScorers: {},
      goalMinutes: {},
    };

    expect(
      resolveGoalIntervalYesNoBet(noBet, {
        homeScore: 0,
        awayScore: 0,
        matchState: state,
        detail: {
          id: 1,
          competitors: [],
          eventDate: '',
          statistics: [{ code: 'current_time', value: '16' }],
        },
      }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveTimeWindowBet', () => {
  const inWindowBet = {
    pick: null,
    marketKey: 'display_NEXT_GOAL_TIME_10MIN',
    outcomeKey: 'DISPLAY_2019_3502_PARAMETER_FROM:71|PARAMETER_GOAL_NUMBER:2|PARAMETER_TO:80',
    line: null,
    outcomeName: '2-й гол 71-80',
  };

  it('wins in_window when goal minute is inside range', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 2,
      lastAway: 0,
      initialized: true,
      goalScorers: { '1': 'home', '2': 'home' },
      goalMinutes: { '1': 55, '2': 75 },
    };

    expect(
      resolveTimeWindowBet(inWindowBet, { homeScore: 2, awayScore: 0, matchState: state }),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('loses in_window when goal minute is outside range', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 2,
      lastAway: 0,
      initialized: true,
      goalScorers: { '1': 'home', '2': 'home' },
      goalMinutes: { '1': 55, '2': 65 },
    };

    expect(
      resolveTimeWindowBet(inWindowBet, { homeScore: 2, awayScore: 0, matchState: state }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('loses in_window after window closes without goal', () => {
    const state = emptyMatchState();
    state.soccer = { lastHome: 1, lastAway: 0, initialized: true, goalScorers: { '1': 'home' } };
    const detail: OlimpbetEventDetail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'current_time', value: '85:00' }],
    };

    expect(
      resolveTimeWindowBet(inWindowBet, { homeScore: 1, awayScore: 0, detail, matchState: state }),
    ).toBe(WcOddsBetStatus.LOSE);
  });
});

describe('resolveGoalsTeamBet', () => {
  it('wins YES on TEAM1 when home goal tracked after baseline', () => {
    const state = emptyMatchState();
    state.soccer = { lastHome: 1, lastAway: 0, initialized: true, goalScorers: { '1': 'home' } };

    expect(
      resolveGoalsTeamBet(
        {
          pick: null,
          marketKey: 'display_GOALS_TEAM1',
          outcomeKey: 'YES',
          line: null,
          outcomeName: 'Забьёт команда 1: Да',
        },
        { homeScore: 1, awayScore: 0, matchState: state },
      ),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveWinner2GamesSetBet', () => {
  const bet = {
    pick: null,
    marketKey: 'display_WINNER_2GAMES_SET_4WAY',
    outcomeKey: 'DISPLAY_1837_2940_PARAMETER_GAME_NUMBER:6|PARAMETER_NUMBER:7|PARAMETER_SET_NUMBER:1',
    line: null,
    outcomeName: '6-й гейм: П2, П1',
  };

  const state = emptyMatchState();
  state.tennis!.games['1:6'] = {
    deuce: false,
    completed: true,
    pointsWon: { home: 4, away: 2 },
    pointWinners: { '1': 'away', '2': 'home', '3': 'away', '4': 'home', '5': 'home', '6': 'home' },
    lastGameScore: '40:30',
    trackedFromStart: true,
  };
  state.tennis!.games['1:7'] = {
    deuce: false,
    completed: true,
    pointsWon: { home: 0, away: 3 },
    pointWinners: { '1': 'away', '2': 'away', '3': 'away' },
    lastGameScore: '0:40',
    trackedFromStart: true,
  };

  it('loses when first game winner differs from combo', () => {
    expect(
      resolveWinner2GamesSetBet(bet, { homeScore: 0, awayScore: 2, matchState: state }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('wins when both games match combo П1, П2', () => {
    const winningBet = { ...bet, outcomeName: '6-й гейм: П1, П2' };
    expect(
      resolveWinner2GamesSetBet(winningBet, { homeScore: 0, awayScore: 2, matchState: state }),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('settles via resolveVerifiedBetResult for Vukic vs Brooksby bet #323', () => {
    expect(
      resolveVerifiedBetResult(bet, { homeScore: 0, awayScore: 2, matchState: state }),
    ).toBe(WcOddsBetStatus.LOSE);
  });
});

describe('resolveWinnerGameBet', () => {
  const betHome = {
    pick: null,
    marketKey: 'display_WINNER_GAME',
    outcomeKey: 'DISPLAY_1000_2000_PARAMETER_GAME_NUMBER:6|PARAMETER_SET_NUMBER:1',
    line: null,
    outcomeName: '6-й гейм: П1',
  };

  it('wins when scoped game winner matches pick', () => {
    const state = emptyMatchState();
    state.tennis!.games['1:6'] = {
      deuce: false,
      completed: true,
      pointsWon: { home: 4, away: 2 },
      lastGameScore: '40:30',
    };

    expect(
      resolveWinnerGameBet(betHome, { homeScore: 0, awayScore: 1, matchState: state }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveWinnerSetBet', () => {
  const detail = {
    id: 8264905,
    competitors: [],
    eventDate: '',
    statistics: [{ code: 'scores_by_periods', value: '6:4,3:6,6:4' }],
    status: 'EVENT_CLOSED',
  } as OlimpbetEventDetail;

  const betHome = {
    pick: null,
    marketKey: 'display_WINNER_SET',
    outcomeKey: 'DISPLAY_1016_1049_PARAMETER_SET_NUMBER:2',
    line: null,
    outcomeName: '2-й сет 2-й сет: П1 (2-м сете)',
  };

  const betAway = {
    ...betHome,
    outcomeName: '2-й сет 2-й сет: П2 (2-м сете)',
  };

  it('loses when away wins the scoped set', () => {
    expect(resolveWinnerSetBet(betHome, { homeScore: 1, awayScore: 2, detail }))
      .toBe(WcOddsBetStatus.LOSE);
  });

  it('wins when away picked and away wins the scoped set', () => {
    expect(resolveWinnerSetBet(betAway, { homeScore: 1, awayScore: 2, detail }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('settles final set when match ends without starting next set', () => {
    const twoSetDetail = {
      ...detail,
      statistics: [{ code: 'scores_by_periods', value: '6:4,6:3' }],
      status: 'EVENT_CLOSED',
    } as OlimpbetEventDetail;

    expect(resolveWinnerSetBet(betHome, { homeScore: 2, awayScore: 0, detail: twoSetDetail }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('settles from match state when feed strips scores_by_periods', () => {
    const closedDetail = {
      id: 8264905,
      competitors: [],
      eventDate: '2026-06-27T10:00:00.000Z',
      status: 'EVENT_CLOSED',
      statistics: [],
    } as OlimpbetEventDetail;

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
    for (let i = 1; i <= 8; i += 1) {
      const key = `2:${i}`;
      if (!state.tennis!.games[key]) {
        state.tennis!.games[key] = { deuce: false, completed: true, lastGameScore: '0:0' };
      }
    }

    expect(
      resolveWinnerSetBet(betHome, {
        homeScore: 1,
        awayScore: 2,
        detail: closedDetail,
        matchState: state,
      }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveWinAndTotalBet', () => {
  const tableTennisBet = {
    pick: null,
    marketKey: 'display_WIN1_AND_TOTAL_SET',
    outcomeKey: 'DISPLAY_1297_1729_PARAMETER_SET_NUMBER:1|PARAMETER_VALUE:18.5',
    line: '18.5',
    outcomeName: 'Результат + тотал 18.5 1-й сет: ТМ',
  };

  const liveDetail = {
    id: 8284166,
    competitors: [],
    eventDate: '',
    status: 'EVENT_TRADING',
    live: true,
    score: { home: 0, away: 2 },
    statistics: [{ code: 'scores_by_periods', value: '6:11,8:11,6:3' }],
  } as OlimpbetEventDetail;

  it('loses WIN1+under when P1 lost set 1 even though total is under line', () => {
    const state = emptyMatchState();
    state.tennis!.setScores = [{ home: 6, away: 11 }, { home: 8, away: 11 }, { home: 6, away: 3 }];

    expect(
      resolveWinAndTotalBet(tableTennisBet, {
        homeScore: 0,
        awayScore: 2,
        detail: liveDetail,
        matchState: state,
      }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('wins WIN1+under when P1 wins set and total stays under line', () => {
    const detail = {
      ...liveDetail,
      statistics: [{ code: 'scores_by_periods', value: '11:6,0:0' }],
    } as OlimpbetEventDetail;

    expect(
      resolveWinAndTotalBet(tableTennisBet, {
        homeScore: 1,
        awayScore: 0,
        detail,
        matchState: emptyMatchState(),
      }),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('stays pending while scoped set is still in play', () => {
    const detail = {
      ...liveDetail,
      statistics: [{ code: 'scores_by_periods', value: '6:8' }],
    } as OlimpbetEventDetail;

    expect(
      resolveWinAndTotalBet(tableTennisBet, {
        homeScore: 0,
        awayScore: 0,
        detail,
        matchState: emptyMatchState(),
      }),
    ).toBeNull();
  });

  it('early-loses under when scoped set total already exceeds line', () => {
    const detail = {
      ...liveDetail,
      statistics: [{ code: 'scores_by_periods', value: '10:10' }],
    } as OlimpbetEventDetail;

    expect(
      resolveWinAndTotalBet(tableTennisBet, {
        homeScore: 0,
        awayScore: 0,
        detail,
        matchState: emptyMatchState(),
      }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('settles scoped football half combo after first half ends', () => {
    const bet = {
      pick: null,
      marketKey: 'display_WIN1_AND_TOTAL',
      outcomeKey: 'DISPLAY_1500_1502_PARAMETER_VALUE:2.5',
      line: '2.5',
      outcomeName: '1-й тайм — Результат + тотал 2.5: ТБ',
    };
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      status: 'EVENT_TRADING',
      statistics: [
        { code: 'match_phase', value: '7' },
        { code: 'scores_by_periods', value: '2:1,0:0' },
      ],
    } as OlimpbetEventDetail;

    expect(
      resolveWinAndTotalBet(bet, { homeScore: 2, awayScore: 1, detail, matchState: emptyMatchState() }),
    ).toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveScoreSetGameBet', () => {
  const bet40_0 = {
    pick: null,
    marketKey: 'display_SCORE_WINNER',
    outcomeKey: 'DISPLAY_1211_1533_PARAMETER_GAME_NUMBER:10|PARAMETER_SET_NUMBER:1',
    line: null,
    outcomeName: '10-й гейм — 40:0',
  };

  it('wins when scoped game ends 40:0 without deuce', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(1, 10)] = {
      deuce: false,
      completed: true,
      lastGameScore: '40:0',
      pointsWon: { home: 4, away: 0 },
      trackedFromStart: true,
    };

    expect(resolveScoreSetGameBet(bet40_0, { homeScore: 0, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });

  it('loses when game completed through deuce', () => {
    const state = emptyMatchState();
    state.tennis!.games[tennisGameKey(1, 10)] = {
      deuce: true,
      completed: true,
      lastGameScore: '50:40',
      pointsWon: { home: 5, away: 4 },
      trackedFromStart: true,
    };

    expect(resolveScoreSetGameBet(bet40_0, { homeScore: 0, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.LOSE);
  });

  it('settles from finalized set when game flag lags behind feed', () => {
    const state = emptyMatchState();
    state.tennis!.setScores = [{ home: 4, away: 6 }];
    state.tennis!.gamesCompletedBySet = { '2': 1 };
    state.tennis!.games[tennisGameKey(1, 10)] = {
      deuce: true,
      completed: false,
      lastGameScore: '40:50',
      pointsWon: { home: 2, away: 3 },
      trackedFromStart: true,
    };

    expect(resolveScoreSetGameBet(bet40_0, { homeScore: 0, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.LOSE);
  });
});

describe('resolveMultiscoreSetBet', () => {
  const bet75 = {
    pick: null,
    marketKey: 'display_MULTISCORE_SET',
    outcomeKey: 'DISPLAY_1965_3312_PARAMETER_SET_NUMBER:1',
    line: null,
    outcomeName: '7:5',
  };

  it('loses when finalized set score differs', () => {
    const state = emptyMatchState();
    state.tennis!.setScores = [{ home: 4, away: 6 }];
    state.tennis!.gamesCompletedBySet = { '2': 1 };

    expect(resolveMultiscoreSetBet(bet75, { homeScore: 0, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.LOSE);
  });

  it('wins when finalized set score matches', () => {
    const state = emptyMatchState();
    state.tennis!.setScores = [{ home: 7, away: 5 }];
    state.tennis!.gamesCompletedBySet = { '2': 1 };

    expect(resolveMultiscoreSetBet(bet75, { homeScore: 0, awayScore: 1, matchState: state }))
      .toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveExactGoalsBet', () => {
  const betSixPlus = {
    pick: null,
    marketKey: 'display_EXACT_GOALS_WITHPARAMS',
    outcomeKey: 'DISPLAY_1372_1898_PARAMETER_EXACT_GOALS:6+',
    line: null,
    outcomeName: 'Точное число голов: 6+ голов',
  };

  const completedDetail: OlimpbetEventDetail = {
    id: 1,
    competitors: [],
    eventDate: '',
    status: 'finished',
    match_phase: 'finished',
  };

  it('loses 6+ when match ends with fewer goals', () => {
    expect(
      resolveExactGoalsBet(betSixPlus, {
        homeScore: 1,
        awayScore: 3,
        detail: completedDetail,
      }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('wins exact goal count on completed match', () => {
    expect(
      resolveExactGoalsBet(
        {
          ...betSixPlus,
          outcomeKey: 'DISPLAY_1372_1898_PARAMETER_EXACT_GOALS:4',
        },
        {
          homeScore: 1,
          awayScore: 3,
          detail: completedDetail,
        },
      ),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('stays pending before match completion', () => {
    expect(
      resolveExactGoalsBet(betSixPlus, {
        homeScore: 1,
        awayScore: 3,
        detail: { id: 1, competitors: [], eventDate: '', live: true },
      }),
    ).toBeNull();
  });
});

describe('resolveMatchCorrectScoreBet', () => {
  const bet12 = {
    pick: null,
    marketKey: 'display_SCORE',
    outcomeKey: 'DISPLAY_1002_1005_PARAMETER_AWAY_SCORE:2|PARAMETER_HOME_SCORE:1',
    line: null,
    outcomeName: 'Счет: 1:2',
  };

  it('stays pending while target score remains reachable', () => {
    expect(resolveMatchCorrectScoreBet(bet12, { homeScore: 0, awayScore: 1 }))
      .toBeNull();
  });

  it('loses early when away already has two sets with wrong home count', () => {
    expect(resolveMatchCorrectScoreBet(bet12, { homeScore: 0, awayScore: 2 }))
      .toBe(WcOddsBetStatus.LOSE);
  });

  it('wins when match ends with exact score', () => {
    expect(resolveMatchCorrectScoreBet(bet12, { homeScore: 1, awayScore: 2 }))
      .toBe(WcOddsBetStatus.WIN);
  });
});

describe('resolveDeterminateBetResult', () => {
  it('wins OVER when first-half total exceeds line', () => {
    const detail: OlimpbetEventDetail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '1:0' }],
    };

    expect(
      resolveDeterminateBetResult(
        {
          pick: null,
          marketKey: 'totals',
          outcomeKey: 'OVER_0.5',
          line: '0.5',
          outcomeName: 'Тотал 1-й тайм 0.5',
        },
        1,
        0,
        detail,
      ),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('returns null for DISPLAY without verified data instead of void', () => {
    expect(
      resolveVerifiedBetResult(
        {
          pick: null,
          marketKey: 'display_DEUSE_POINT',
          outcomeKey: 'DISPLAY_1164_1382_PARAMETER_GAME_NUMBER:8|PARAMETER_SET_NUMBER:3',
          line: null,
          outcomeName: 'Дьюс 3-й сет 8-й гейм: Да',
        },
        {
          homeScore: 2,
          awayScore: 1,
          detail: { id: 1, competitors: [], eventDate: '', status: 'EVENT_ENDED' },
          matchState: emptyMatchState(),
        },
      ),
    ).toBeNull();
  });

  it('does not early-win unscoped tennis totals from summed set games', () => {
    const state = emptyMatchState();
    state.tennis!.setScores = [{ home: 4, away: 6 }, { home: 0, away: 4 }];

    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 0, away: 1 },
      statistics: [{ code: 'scores_by_periods', value: '4:6,0:4' }],
    } as OlimpbetEventDetail;

    expect(
      resolveDeterminateBetResult(
        {
          pick: null,
          marketKey: 'totals',
          outcomeKey: 'OVER_12.5',
          line: '12.5',
          outcomeName: 'Тотал 12.5 — Больше',
        },
        0,
        1,
        detail,
        state,
      ),
    ).toBeNull();
  });

  it('early-wins scoped set total when set games exceed line', () => {
    const state = emptyMatchState();
    state.tennis!.setScores = [{ home: 4, away: 6 }];

    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 0, away: 1 },
      statistics: [{ code: 'scores_by_periods', value: '4:6' }],
    } as OlimpbetEventDetail;

    expect(
      resolveDeterminateBetResult(
        {
          pick: null,
          marketKey: 'totals',
          outcomeKey: 'OVER_9.5',
          line: '9.5',
          outcomeName: '1-й сет — Тотал 9.5 — Больше',
        },
        0,
        1,
        detail,
        state,
      ),
    ).toBe(WcOddsBetStatus.WIN);
  });

  it('keeps in-play volleyball set total pending despite unrelated match_phase code', () => {
    const detail = {
      id: 8278479,
      competitors: [],
      eventDate: '',
      status: 'EVENT_TRADING',
      live: true,
      score: { home: 1, away: 1 },
      statistics: [
        { code: 'scores_by_periods', value: '25:21,19:25,11:20' },
        { code: 'match_phase', value: '7' },
      ],
    } as OlimpbetEventDetail;

    expect(
      resolveDeterminateBetResult(
        {
          pick: null,
          marketKey: 'totals',
          outcomeKey: 'UNDER_40.5',
          line: '40.5',
          outcomeName: '3-й сет · Тотал геймов · 40.5 — Меньше',
          placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 40.5' },
        },
        1,
        1,
        detail,
        emptyMatchState(),
      ),
    ).toBeNull();
  });
});

describe('resolveLastEventBet', () => {
  const offsideBet = {
    pick: null,
    marketKey: 'display_LAST_EVENT',
    outcomeKey: 'DISPLAY_1565_2355_base',
    line: null,
    outcomeName: 'Специальные ставки: Офсайд',
  };

  const goalBet = {
    ...offsideBet,
    outcomeKey: 'DISPLAY_1565_2356_base',
    outcomeName: 'Специальные ставки: Гол',
  };

  const closedDetail = {
    id: 7762686,
    competitors: [],
    eventDate: '2026-06-28T02:00:00Z',
    status: 'EVENT_CLOSED',
  } as OlimpbetEventDetail;

  it('loses offside when probability snapshot shows goal won', () => {
    const state = emptyMatchState();
    state.probabilitySnapshots = { '1565:2356:': 'WIN' };

    expect(
      resolveLastEventBet(offsideBet, { homeScore: 3, awayScore: 2, detail: closedDetail, matchState: state }),
    ).toBe(WcOddsBetStatus.LOSE);
  });

  it('wins goal when late stoppage-time goal was last tracked feed event', () => {
    const state = emptyMatchState();
    state.soccer = {
      lastHome: 3,
      lastAway: 2,
      initialized: true,
      goalScorers: { '5': 'home' },
      goalMinutes: { '5': 93 },
    };

    expect(
      resolveLastEventBet(goalBet, { homeScore: 3, awayScore: 2, detail: closedDetail, matchState: state }),
    ).toBe(WcOddsBetStatus.WIN);

    expect(
      resolveLastEventBet(offsideBet, { homeScore: 3, awayScore: 2, detail: closedDetail, matchState: state }),
    ).toBe(WcOddsBetStatus.LOSE);
  });
});
