import {
  parseDisplayOutcomeParameters,
  resolveDisplayOutcomeResult,
  resolveOlimpbetProbabilityResult,
} from './olimpbet-probability-settlement.util';
import type { OlimpbetEventDetail } from './olimpbet-wc.types';

function detailWithProbabilities(
  markets: NonNullable<OlimpbetEventDetail['probabilities']>['markets'],
): OlimpbetEventDetail {
  return {
    id: 1,
    competitors: [],
    eventDate: '',
    probabilities: { eventId: 1, markets },
  };
}

describe('parseDisplayOutcomeParameters', () => {
  it('parses set and game scope from outcomeKey tail', () => {
    expect(
      parseDisplayOutcomeParameters(
        'DISPLAY_1164_1382_x|PARAMETER_SET_NUMBER:3|PARAMETER_GAME_NUMBER:8',
      ),
    ).toEqual({
      PARAMETER_SET_NUMBER: '3',
      PARAMETER_GAME_NUMBER: '8',
    });
  });

  it('parses parameters without underscore after outcome type id', () => {
    expect(
      parseDisplayOutcomeParameters(
        'DISPLAY_1164_1382_PARAMETER_GAME_NUMBER:8|PARAMETER_SET_NUMBER:3',
      ),
    ).toEqual({
      PARAMETER_GAME_NUMBER: '8',
      PARAMETER_SET_NUMBER: '3',
    });
  });
});

describe('resolveOlimpbetProbabilityResult', () => {
  it('matches probability parameters before reading tradingStatus', () => {
    const detail = detailWithProbabilities([
      {
        marketId: 1164,
        probabilities: [
          {
            outcomeTypeId: 1382,
            odd: 1,
            tradingStatus: 'RESULTED',
            parameters: [
              { type: 'PARAMETER_SET_NUMBER', value: '3' },
              { type: 'PARAMETER_GAME_NUMBER', value: '8' },
            ],
          },
          {
            outcomeTypeId: 1382,
            odd: 2.5,
            tradingStatus: 'OPEN',
            parameters: [
              { type: 'PARAMETER_SET_NUMBER', value: '3' },
              { type: 'PARAMETER_GAME_NUMBER', value: '10' },
            ],
          },
        ],
      },
    ]);

    expect(
      resolveOlimpbetProbabilityResult(detail, 1164, 1382, {
        PARAMETER_SET_NUMBER: '3',
        PARAMETER_GAME_NUMBER: '8',
      }),
    ).toBe('WIN');

    expect(
      resolveOlimpbetProbabilityResult(detail, 1164, 1382, {
        PARAMETER_SET_NUMBER: '3',
        PARAMETER_GAME_NUMBER: '10',
      }),
    ).toBeNull();
  });
});

describe('resolveDisplayOutcomeResult', () => {
  it('uses outcomeKey scope so game 8 does not settle from game 10', () => {
    const detail = detailWithProbabilities([
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
          {
            outcomeTypeId: 1382,
            odd: 1,
            tradingStatus: 'LOST',
            parameters: [
              { type: 'PARAMETER_SET_NUMBER', value: '3' },
              { type: 'PARAMETER_GAME_NUMBER', value: '10' },
            ],
          },
        ],
      },
    ]);

    expect(
      resolveDisplayOutcomeResult(
        detail,
        'DISPLAY_1164_1382_x|PARAMETER_SET_NUMBER:3|PARAMETER_GAME_NUMBER:8',
      ),
    ).toBe('WIN');

    expect(
      resolveDisplayOutcomeResult(
        detail,
        'DISPLAY_1164_1382_x|PARAMETER_SET_NUMBER:3|PARAMETER_GAME_NUMBER:10',
      ),
    ).toBe('LOSE');
  });

  it('accepts _base suffix on outcome keys', () => {
    const detail = detailWithProbabilities([
      {
        marketId: 1565,
        probabilities: [
          {
            outcomeTypeId: 2355,
            odd: 1,
            tradingStatus: 'LOST',
            parameters: [],
          },
        ],
      },
    ]);

    expect(resolveDisplayOutcomeResult(detail, 'DISPLAY_1565_2355_base')).toBe('LOSE');
  });
});
