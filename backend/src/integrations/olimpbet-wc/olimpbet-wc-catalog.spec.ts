import {
  formatBttsAndOutcomeCode,
  formatFirstGoalAndWinnerCode,
  formatHalfWinYesNoLabel,
  formatNextGoalOutcome,
  formatOutcomeLabel,
  formatWinningMethodOutcome,
  humanizeCatalogMarketName,
  isTechnicalEnglishCatalogLabel,
  resolveNextGoalGroupLabel,
  resolveCleanWinTeamSideGroupLabel,
  resolveNumberFinalScoreCategoryName,
  resolveNumberFinalScoreGroupLabel,
  resolveScoringEventsGroupLabel,
  resolveSpecialBetsGroupLabel,
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

  it('humanizes half-win market catalog names', () => {
    expect(humanizeCatalogMarketName('DRAW_ONE_HALF')).toBe('Х хотя бы в одной половине');
    expect(humanizeCatalogMarketName('TEAM1_WIN_BOTHPART')).toBe('П1 в обеих половинах');
    expect(humanizeCatalogMarketName('TEAM2_WIN_ONE_PART')).toBe('П2 хотя бы в одной половине');
  });

  it('humanizes STRONG WILLED and team BOTH goals catalog names', () => {
    expect(humanizeCatalogMarketName('STRONG_WILLED_TEAM1')).toBe('П1: волевая победа');
    expect(humanizeCatalogMarketName('STRONG_WILLED_TEAM2')).toBe('П2: волевая победа');
    expect(humanizeCatalogMarketName('STRONG_WILLED_ANY_TEAM')).toBe('Волевая победа');
    expect(humanizeCatalogMarketName('TEAM1_GOALS_BOTH')).toBe('П1: голы в обоих таймах');
    expect(humanizeCatalogMarketName('TEAM2_GOALS_BOTH')).toBe('П2: голы в обоих таймах');
  });

  it('humanizes SCORE_AFTER goal and set markets', () => {
    expect(humanizeCatalogMarketName('SCORE_AFTER_X_GOALS')).toBe('Счет после X голов');
    expect(
      humanizeCatalogMarketName('SCORE_AFTER_X_GOALS', [
        { type: 'PARAMETER_GOAL_NUMBER', value: '3' },
      ]),
    ).toBe('Счет после 3 голов');
    expect(humanizeCatalogMarketName('SCORE_AFTER_2SETS')).toBe('Счет после 2-го сета');
  });

  it('formats half-win yes/no outcome codes as П1-Да / Х-Нет', () => {
    expect(formatHalfWinYesNoLabel('НичьяПолДа')).toBe('Х-Да');
    expect(formatHalfWinYesNoLabel('П1ОбеПолНет')).toBe('П1-Нет');
    expect(formatHalfWinYesNoLabel('П2ПолДа')).toBe('П2-Да');
  });

  it('formats half-win yes/no outcomes from catalog codes', () => {
    const catalog = buildCatalog(1379, 'DRAW_ONE_HALF', [
      { id: 1924, code: 'НичьяПолДа', name: 'Ничья хотя бы в одной половине' },
      { id: 1925, code: 'НичьяПолНет', name: 'Ничья хотя бы в одной половине' },
    ]);

    expect(formatOutcomeLabel(catalog, 1379, { outcomeTypeId: 1924, odd: 1.15 })).toBe('Х-Да');
    expect(formatOutcomeLabel(catalog, 1379, { outcomeTypeId: 1925, odd: 5.15 })).toBe('Х-Нет');
  });

  it('formats btts-and-outcome combo codes', () => {
    expect(formatBttsAndOutcomeCode('ОбеДаП1')).toBe('ОЗ·Да·П1');
    expect(formatBttsAndOutcomeCode('ОбеНетХ')).toBe('ОЗ·Нет·X');
    expect(formatBttsAndOutcomeCode('1Х_ОбеДа')).toBe('ОЗ·Да·1X');
    expect(formatBttsAndOutcomeCode('П1иОбеЗаб_Да')).toBe('ОЗ·Да·П1');
    expect(formatBttsAndOutcomeCode('НичиОбеЗаб_Да')).toBe('ОЗ·Да·X');
    expect(formatBttsAndOutcomeCode('12иОбеЗаб_Нет')).toBe('ОЗ·Нет·12');
  });

  it('formats first goal and winner combo codes', () => {
    expect(formatFirstGoalAndWinnerCode('ПерГ1_П1')).toBe('П1 · П1');
    expect(formatFirstGoalAndWinnerCode('ПерГ1_Х')).toBe('П1 · X');
    expect(formatFirstGoalAndWinnerCode('ПерГ2_П2')).toBe('П2 · П2');
    expect(formatFirstGoalAndWinnerCode('ПерГ_Нет')).toBe('Гола не будет');
    expect(humanizeCatalogMarketName('FIRST_GOAL_AND_WINNER')).toBe('Первый гол и победа');
  });

  it('formats owngoal, number final score and scoring events labels', () => {
    expect(humanizeCatalogMarketName('OWNGOAL_YES_NO')).toBe('Автогол в матче');
    expect(humanizeCatalogMarketName('NUMBER_FINAL_SCORE_YES_NO')).toBe('Цифра в итоговом счёте');
    expect(resolveNumberFinalScoreCategoryName('NUMBER_FINAL_SCORE_HALF_YES_NO', [
      { type: 'PARAMETER_HALF_NUMBER', value: '1' },
    ])).toBe('Цифра в итоговом счёте 1-й половины (Да/Нет)');
    expect(resolveNumberFinalScoreGroupLabel('NUMBER_FINAL_SCORE_YES_NO', [
      { type: 'PARAMETER_EXACT', value: '3' },
    ])).toBe('Цифра «3»');
    expect(resolveScoringEventsGroupLabel('SCORING_EVENTS_DEFENDER_GOAL_YES_NO')).toBe('Защитник забьёт');
  });

  it('formats clean win team side group labels', () => {
    expect(resolveCleanWinTeamSideGroupLabel('CLEAN_WIN_TEAM1_HALF')).toBe('П1');
    expect(resolveCleanWinTeamSideGroupLabel('CLEAN_WIN_TEAM2_HALF')).toBe('П2');
    expect(resolveCleanWinTeamSideGroupLabel('CLEAN_WIN_TEAM1')).toBe('П1');
    expect(humanizeCatalogMarketName('CLEAN_WIN_TEAM1')).toBe('П1: сухая победа');
    expect(humanizeCatalogMarketName('CLEAN_WIN_TEAM2_HALF')).toBe('П2: сухая победа');
  });

  it('formats scoring events group labels', () => {
    expect(resolveScoringEventsGroupLabel('SCORING_EVENTS_HATTRICK_YES_NO')).toBe('Хет-трик');
    expect(resolveScoringEventsGroupLabel('SCORING_EVENTS_MIDFIELDER_GOAL_YES_NO')).toBe('Полузащитник забьёт');
    expect(resolveScoringEventsGroupLabel('SCORING_EVENTS_STRIKER_GOAL_YES_NO')).toBe('Нападающий забьёт');
    expect(resolveScoringEventsGroupLabel('SCORING_EVENTS_DIRECT_FREEKICK_YES_NO')).toBe('Гол со штрафного');
  });

  it('formats next-goal outcome codes and group labels', () => {
    expect(formatNextGoalOutcome('Сл_Гол1')).toBe('П1');
    expect(formatNextGoalOutcome('Сл_ГолНик')).toBe('Никто');
    expect(formatNextGoalOutcome('СлГол_15мин')).toBe('Будет гол');
    expect(formatNextGoalOutcome('СлГол_15мин_НеБудет')).toBe('Не будет');

    expect(resolveNextGoalGroupLabel('NEXT_GOAL_TIME_15MIN')).toBe('В течение 15 мин');
    expect(resolveNextGoalGroupLabel('NEXT_GOAL')).toBe('');
    expect(
      resolveNextGoalGroupLabel('GOAL15MIN_YES_NO', [
        { type: 'PARAMETER_FROM', value: '76' },
        { type: 'PARAMETER_TO', value: '90' },
      ]),
    ).toBe('76–90 мин');
  });

  it('formats football winning-method outcome codes', () => {
    expect(formatWinningMethodOutcome('К1_ОснВремя')).toBe('П1 · основное время');
    expect(formatWinningMethodOutcome('К2_Пен')).toBe('П2 · пенальти');
    expect(formatWinningMethodOutcome('К1_ОТ')).toBe('П1 · ОТ');

    expect(isTechnicalEnglishCatalogLabel('WINNING METHOD FOOTBALL')).toBe(true);
    expect(isTechnicalEnglishCatalogLabel('Как определится победитель')).toBe(false);
    expect(isTechnicalEnglishCatalogLabel('HOW WILL Гол BE SCORED')).toBe(true);
    expect(isTechnicalEnglishCatalogLabel('MINUTE Гол EVEN ODD')).toBe(true);
    expect(humanizeCatalogMarketName('WINNING_METHOD_FOOTBALL')).toBe('WINNING METHOD FOOTBALL');

    const catalog = buildCatalog(1008, 'WINNING_METHOD_FOOTBALL', [
      { id: 1020, code: 'К1_ОснВремя', name: 'Проход {$competitor1} в основное время' },
      { id: 1025, code: 'К2_Пен', name: 'Проход {$competitor2} в серии пенальти' },
    ]);

    expect(formatOutcomeLabel(catalog, 1008, { outcomeTypeId: 1020, odd: 2.42 })).toBe('П1 · основное время');
    expect(formatOutcomeLabel(catalog, 1008, { outcomeTypeId: 1025, odd: 12.0 })).toBe('П2 · пенальти');
  });

  it('humanizes special football display markets', () => {
    expect(humanizeCatalogMarketName('HOW_WILL_GOAL_BE_SCORED')).toBe('Как будет забит гол');
    expect(humanizeCatalogMarketName('LAST_EVENT')).toBe('Последнее событие');
    expect(humanizeCatalogMarketName('MINUTE_GOAL_EVEN_ODD')).toBe('Минута гола (чёт/нечет)');
    expect(humanizeCatalogMarketName('PENALTY_REDCARD_YES_NO')).toBe('Пенальти и удаление');
    expect(humanizeCatalogMarketName('PENALTY_MATCH_YES_NO')).toBe('Пенальти в матче');
    expect(humanizeCatalogMarketName('REDCARD_YES_NO')).toBe('Удаление');

    expect(resolveSpecialBetsGroupLabel('HOW_WILL_GOAL_BE_SCORED', 'Как будет забит первый гол')).toBe('');
    expect(resolveSpecialBetsGroupLabel('HOW_WILL_GOAL_BE_SCORED', 'Специальные ставки')).toBe(
      'Как будет забит гол',
    );
    expect(resolveSpecialBetsGroupLabel('MINUTE_GOAL_EVEN_ODD', 'Минута гола (Чет/Нечет)')).toBe('');
    expect(resolveSpecialBetsGroupLabel('REDCARD_YES_NO', 'Удаление в матче')).toBe('');
  });

  it('humanizes qualification yes/no market names', () => {
    expect(
      humanizeCatalogMarketName('NOT_WIN_IN_REGULATION_TIME_BUT_TO_ QUALIFY_TEAM1_YES_NO'),
    ).toBe('П1: не выиграет в основное время, но пройдёт');
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

  it('formats NUMBER_OF_SETS outcomes from PARAMETER_VALUE', () => {
    const catalog = buildCatalog(1358, 'NUMBER_OF_SETS', [
      { id: 1870, code: 'КолСет', name: 'Количество сетов' },
    ]);

    expect(
      formatOutcomeLabel(catalog, 1358, {
        outcomeTypeId: 1870,
        odd: 2.6,
        parameters: [{ type: 'PARAMETER_VALUE', value: '3' }],
      }),
    ).toBe('3 сета');

    expect(
      formatOutcomeLabel(catalog, 1358, {
        outcomeTypeId: 1870,
        odd: 2.61,
        parameters: [{ type: 'PARAMETER_VALUE', value: '4' }],
      }),
    ).toBe('4 сета');

    expect(
      formatOutcomeLabel(catalog, 1358, {
        outcomeTypeId: 1870,
        odd: 3.19,
        parameters: [{ type: 'PARAMETER_VALUE', value: '5' }],
      }),
    ).toBe('5 сетов');
  });

  it('maps RACE_TO_GAME competitor codes to П1/П2', () => {
    const catalog = buildCatalog(1410, 'RACE_TO_GAME', [
      { id: 1983, code: 'К1_Гейм[]', name: 'К1 (2-м сете, 3-й гейм)' },
      { id: 1984, code: 'П2', name: 'П2' },
    ]);

    expect(
      formatOutcomeLabel(catalog, 1410, {
        outcomeTypeId: 1983,
        odd: 1.47,
        parameters: [
          { type: 'PARAMETER_SET_NUMBER', value: '2' },
          { type: 'PARAMETER_GAME_NUMBER', value: '3' },
        ],
      }),
    ).toBe('П1');

    expect(
      formatOutcomeLabel(catalog, 1410, {
        outcomeTypeId: 1984,
        odd: 2.68,
        parameters: [
          { type: 'PARAMETER_SET_NUMBER', value: '2' },
          { type: 'PARAMETER_GAME_NUMBER', value: '3' },
        ],
      }),
    ).toBe('П2');
  });
});
