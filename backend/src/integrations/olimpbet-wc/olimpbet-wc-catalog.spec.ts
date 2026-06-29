import {
  formatOutcomeLabel,
  humanizeCatalogMarketName,
  resolveVirtualCategoryName,
  type OlimpbetMarketCatalog,
} from './olimpbet-wc-catalog';
import type { OlimpbetProbability } from './olimpbet-wc.types';

function buildCatalog(
  marketId: number,
  marketName: string,
  outcomes: Array<{ id: number; code: string; name: string }>,
): OlimpbetMarketCatalog {
  const outcomesMap = new Map<number, { id: number; code: string; shortName: string; name: string }>();
  for (const outcome of outcomes) {
    outcomesMap.set(outcome.id, {
      id: outcome.id,
      code: outcome.code,
      shortName: outcome.code,
      name: outcome.name,
    });
  }

  return {
    markets: new Map([
      [
        marketId,
        {
          id: marketId,
          name: marketName,
          outcomes: outcomesMap,
        },
      ],
    ]),
    marketLabels: new Map([[marketId, marketName]]),
    virtualCategoryRefs: new Map(),
    loadedAtMs: Date.now(),
  };
}

describe('olimpbet-wc-catalog tennis labels', () => {
  it('maps ОчкоП1/ОчкоП2 outcome codes to П1/П2', () => {
    const catalog = buildCatalog(1182, 'NEXT_POINTS_GAME', [
      { id: 1461, code: 'ОчкоП1_Гейм[]', name: 'ОчкоП1_Гейм[]' },
      { id: 1462, code: 'ОчкоП2_Гейм[]', name: 'ОчкоП2_Гейм[]' },
    ]);

    const probBase: OlimpbetProbability = {
      outcomeTypeId: 1461,
      odd: 2.1,
      parameters: [
        { type: 'PARAMETER_SET_NUMBER', value: '3' },
        { type: 'PARAMETER_GAME_NUMBER', value: '6' },
        { type: 'PARAMETER_POINT_NUMBER', value: '2' },
      ],
    };

    expect(formatOutcomeLabel(catalog, 1182, probBase)).toBe('П1');
    expect(
      formatOutcomeLabel(catalog, 1182, { ...probBase, outcomeTypeId: 1462 }),
    ).toBe('П2');
  });

  it('humanizes DEUSE_POINT catalog name', () => {
    expect(humanizeCatalogMarketName('DEUSE_POINT')).toBe('Дьюс');
  });

  it('keeps Да/Нет without set context for DEUSE_POINT', () => {
    const catalog = buildCatalog(1164, 'DEUSE_POINT', [
      { id: 1401, code: 'Да_Гейм[]', name: 'Да_Гейм[]' },
      { id: 1402, code: 'Нет_Гейм[]', name: 'Нет_Гейм[]' },
    ]);

    const prob: OlimpbetProbability = {
      outcomeTypeId: 1401,
      odd: 2.9,
      parameters: [
        { type: 'PARAMETER_SET_NUMBER', value: '3' },
        { type: 'PARAMETER_GAME_NUMBER', value: '8' },
      ],
    };

    expect(formatOutcomeLabel(catalog, 1164, prob)).toBe('Да');
  });

  it('returns only point score for SCORE_SET without redundant context', () => {
    const catalog = buildCatalog(2100, 'SCORE_SET', [
      { id: 1501, code: '40_0', name: 'Счет[]' },
    ]);

    const prob: OlimpbetProbability = {
      outcomeTypeId: 1501,
      odd: 12,
      parameters: [
        { type: 'PARAMETER_SET_NUMBER', value: '1' },
        { type: 'PARAMETER_GAME_NUMBER', value: '9' },
        { type: 'PARAMETER_HOME_SCORE', value: '40' },
        { type: 'PARAMETER_AWAY_SCORE', value: '0' },
      ],
    };

    expect(formatOutcomeLabel(catalog, 2100, prob)).toBe('40:0');
  });

  it('formats SCORE_SET 40:15 and advantage as 40:A', () => {
    const catalog = buildCatalog(2100, 'SCORE_SET', [
      { id: 1502, code: '40_15', name: 'Счет[]' },
      { id: 1503, code: '40_50', name: 'Счет[]' },
    ]);

    expect(
      formatOutcomeLabel(catalog, 2100, {
        outcomeTypeId: 1502,
        odd: 6.9,
        parameters: [
          { type: 'PARAMETER_HOME_SCORE', value: '40' },
          { type: 'PARAMETER_AWAY_SCORE', value: '15' },
        ],
      }),
    ).toBe('40:15');

    expect(
      formatOutcomeLabel(catalog, 2100, {
        outcomeTypeId: 1503,
        odd: 3.5,
        parameters: [
          { type: 'PARAMETER_HOME_SCORE', value: '40' },
          { type: 'PARAMETER_AWAY_SCORE', value: '50' },
        ],
      }),
    ).toBe('40:A');
  });

  it('formats MULTISCORE_SET outcome as score list', () => {
    const catalog = buildCatalog(1965, 'MULTISCORE_SET', [
      { id: 2001, code: 'РазСчет7:5,7:6_Сет', name: '7:5, 7:6' },
    ]);

    const prob: OlimpbetProbability = {
      outcomeTypeId: 2001,
      odd: 5.5,
      parameters: [{ type: 'PARAMETER_SET_NUMBER', value: '1' }],
    };

    expect(formatOutcomeLabel(catalog, 1965, prob)).toBe('7:5, 7:6');
  });

  it('formats GOAL_RANGE from PARAMETER_GOALS_RANGE', () => {
    const catalog = buildCatalog(1382, 'GOAL_RANGE', [
      { id: 1928, code: 'ДиапГолов', name: 'Диапазон голов' },
    ]);

    expect(
      formatOutcomeLabel(catalog, 1382, {
        outcomeTypeId: 1928,
        odd: 1.67,
        parameters: [{ type: 'PARAMETER_GOALS_RANGE', value: '2-3' }],
      }),
    ).toBe('2–3');

    expect(
      formatOutcomeLabel(catalog, 1382, {
        outcomeTypeId: 1928,
        odd: 13.5,
        parameters: [{ type: 'PARAMETER_GOALS_RANGE', value: '6+' }],
      }),
    ).toBe('6+');
  });

  it('falls back to default virtual category when score params do not match refs', () => {
    const catalog: OlimpbetMarketCatalog = {
      ...buildCatalog(2130, 'SCORE_VARIANT', [
        { id: 3812, code: 'ТочныйСчет[]', name: 'Счет' },
      ]),
      virtualCategoryRefs: new Map([
        [
          2130,
          [
            {
              marketId: 2130,
              categoryName: 'Точный счет',
              parameters: [],
            },
          ],
        ],
      ]),
    };

    expect(
      resolveVirtualCategoryName(catalog, 2130, [
        { type: 'PARAMETER_HOME_SCORE', value: '2' },
        { type: 'PARAMETER_AWAY_SCORE', value: '1' },
      ]),
    ).toBe('Точный счет');
  });
});
