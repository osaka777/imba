import { parseDisplayOutcomeParameters } from '../olimpbet-wc/olimpbet-probability-settlement.util';

import {
  parseRaceTargetFromParams,
  parseTennisScopedGameParams,
} from './tennis-market-params.util';

describe('parseTennisScopedGameParams', () => {
  it('parses set, game and point from outcomeKey', () => {
    expect(
      parseTennisScopedGameParams(
        'DISPLAY_1182_1461_PARAMETER_GAME_NUMBER:6|PARAMETER_POINT_NUMBER:2|PARAMETER_SET_NUMBER:3',
      ),
    ).toEqual({ setNum: 3, gameNum: 6, pointNum: 2 });
  });
});

describe('parseRaceTargetFromParams', () => {
  it('reads race target from PARAMETER_NUMBER', () => {
    const bet = {
      pick: null,
      marketKey: 'display_RACE_TO_GAME',
      outcomeKey: 'DISPLAY_1_2_PARAMETER_NUMBER:3|PARAMETER_SET_NUMBER:1',
      line: null,
    };
    expect(parseRaceTargetFromParams(bet, ['PARAMETER_NUMBER', 'PARAMETER_VALUE'])).toBe(3);
  });

  it('returns null when no target param', () => {
    expect(
      parseRaceTargetFromParams(
        { pick: null, marketKey: 'x', outcomeKey: 'DISPLAY_1_2', line: null },
        ['PARAMETER_NUMBER'],
      ),
    ).toBeNull();
  });
});

describe('parameter key compatibility', () => {
  it('parses without underscore after outcome type id', () => {
    expect(
      parseDisplayOutcomeParameters('DISPLAY_1164_1382_PARAMETER_GAME_NUMBER:8|PARAMETER_SET_NUMBER:3'),
    ).toEqual({
      PARAMETER_GAME_NUMBER: '8',
      PARAMETER_SET_NUMBER: '3',
    });
  });
});
