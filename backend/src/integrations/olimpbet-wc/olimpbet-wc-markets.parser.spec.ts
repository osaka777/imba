import type { OlimpbetMarketCatalog } from './olimpbet-wc-catalog';
import { parseOlimpbetEventToGroupedMarkets } from './olimpbet-wc-markets.parser';
import type { OlimpbetEventDetail } from './olimpbet-wc.types';

jest.mock('./olimpbet-wc-catalog', () => {
  const actual = jest.requireActual('./olimpbet-wc-catalog');
  return {
    ...actual,
    loadOlimpbetMarketCatalog: jest.fn(),
    catalogMarketLabel: jest.fn((_catalog: unknown, marketId: number) => `Market ${marketId}`),
    resolveVirtualCategoryName: jest.fn(() => null),
  };
});

function buildCatalog(
  markets: Array<{
    id: number;
    name: string;
    outcomes: Array<{ id: number; code: string }>;
  }>,
): OlimpbetMarketCatalog {
  const marketsMap = new Map<number, OlimpbetMarketCatalog['markets'] extends Map<number, infer V> ? V : never>();
  const marketLabels = new Map<number, string>();

  for (const market of markets) {
    const outcomes = new Map<number, { id: number; code: string; shortName: string; name: string }>();
    for (const outcome of market.outcomes) {
      outcomes.set(outcome.id, {
        id: outcome.id,
        code: outcome.code,
        shortName: outcome.code,
        name: outcome.code,
      });
    }
    marketsMap.set(market.id, {
      id: market.id,
      name: market.name,
      outcomes,
    });
    marketLabels.set(market.id, market.name);
  }

  return {
    markets: marketsMap,
    marketLabels,
    virtualCategoryRefs: new Map(),
    loadedAtMs: Date.now(),
  };
}

function buildEvent(
  markets: OlimpbetEventDetail['probabilities']['markets'],
  sportId?: number,
): OlimpbetEventDetail {
  return {
    id: 1,
    competitors: [
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
    ],
    eventDate: new Date().toISOString(),
    ...(sportId != null ? { tournament: { sportId } } : {}),
    probabilities: {
      eventId: 1,
      markets,
    },
  } as OlimpbetEventDetail;
}

describe('parseOlimpbetEventToGroupedMarkets', () => {
  const { loadOlimpbetMarketCatalog, resolveVirtualCategoryName, catalogMarketLabel } = jest.requireMock(
    './olimpbet-wc-catalog',
  ) as {
    loadOlimpbetMarketCatalog: jest.Mock;
    resolveVirtualCategoryName: jest.Mock;
    catalogMarketLabel: jest.Mock;
  };

  beforeEach(() => {
    loadOlimpbetMarketCatalog.mockReset();
    resolveVirtualCategoryName.mockReset();
    resolveVirtualCategoryName.mockReturnValue(null);
    catalogMarketLabel.mockReset();
    catalogMarketLabel.mockImplementation((_catalog: unknown, marketId: number) => `Market ${marketId}`);
  });

  it('parses TOTAL_WITH_OT into totals with OVER/UNDER outcome keys', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1076,
          name: 'TOTAL_WITH_OT',
          outcomes: [
            { id: 1189, code: 'ТМ' },
            { id: 1190, code: 'ТБ' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1076,
          probabilities: [
            {
              outcomeTypeId: 1189,
              odd: 1.9,
              parameters: [{ type: 'PARAMETER_VALUE', value: '125.5' }],
            },
            {
              outcomeTypeId: 1190,
              odd: 1.82,
              parameters: [{ type: 'PARAMETER_VALUE', value: '125.5' }],
            },
          ],
        },
      ]),
    );

    const totals = grouped['Тотал (с ОТ)'] ?? grouped['Тотал'] ?? [];
    expect(totals).toHaveLength(1);
    expect(totals[0].marketKey).toBe('totals_ot');
    expect(totals[0].outcomes.map((o) => o.outcomeKey).sort()).toEqual([
      'OVER_125.5',
      'UNDER_125.5',
    ]);
    expect(totals[0].outcomes.find((o) => o.outcomeKey === 'UNDER_125.5')?.name).toBe('ТМ');
    expect(totals[0].outcomes.find((o) => o.outcomeKey === 'OVER_125.5')?.name).toBe('ТБ');
  });

  it('parses HANDICAP_WITH_OT into handicap with HOME/AWAY outcome keys in one group', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1104,
          name: 'HANDICAP_WITH_OT',
          outcomes: [
            { id: 1246, code: 'Ф1' },
            { id: 1247, code: 'Ф2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1104,
          probabilities: [
            {
              outcomeTypeId: 1246,
              odd: 1.85,
              parameters: [{ type: 'PARAMETER_VALUE', value: '7.5' }],
            },
            {
              outcomeTypeId: 1247,
              odd: 1.95,
              parameters: [{ type: 'PARAMETER_VALUE', value: '-7.5' }],
            },
          ],
        },
      ]),
    );

    const handicaps = grouped['Фора (с ОТ)'] ?? grouped['Фора'] ?? [];
    expect(handicaps).toHaveLength(1);
    expect(handicaps[0].marketKey).toBe('handicap_ot');
    expect(handicaps[0].outcomes.map((o) => o.outcomeKey).sort()).toEqual([
      'AWAY_HCP_7.5',
      'HOME_HCP_7.5',
    ]);
  });

  it('dedupes duplicate handicap outcomes keeping the best price', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1104,
          name: 'HANDICAP_WITH_OT',
          outcomes: [
            { id: 1246, code: 'Ф1' },
            { id: 1247, code: 'Ф2' },
            { id: 2001, code: 'Ф1' },
            { id: 2002, code: 'Ф2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1104,
          probabilities: [
            {
              outcomeTypeId: 1246,
              odd: 1.44,
              parameters: [{ type: 'PARAMETER_VALUE', value: '-2.5' }],
            },
            {
              outcomeTypeId: 1247,
              odd: 2.55,
              parameters: [{ type: 'PARAMETER_VALUE', value: '-2.5' }],
            },
            {
              outcomeTypeId: 2001,
              odd: 1.78,
              parameters: [{ type: 'PARAMETER_VALUE', value: '-2.5' }],
            },
            {
              outcomeTypeId: 2002,
              odd: 2.03,
              parameters: [{ type: 'PARAMETER_VALUE', value: '-2.5' }],
            },
          ],
        },
      ]),
    );

    const handicaps = grouped['Фора (с ОТ)'] ?? grouped['Фора'] ?? [];
    expect(handicaps).toHaveLength(1);
    expect(handicaps[0].outcomes).toHaveLength(2);
    expect(handicaps[0].outcomes.find((o) => o.outcomeKey === 'HOME_HCP_-2.5')?.price).toBe(1.78);
    expect(handicaps[0].outcomes.find((o) => o.outcomeKey === 'AWAY_HCP_-2.5')?.price).toBe(2.55);
  });

  it('keeps quarter handicaps under quarter tab category', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1054,
          name: 'HANDICAP',
          outcomes: [
            { id: 1246, code: 'Ф1' },
            { id: 1247, code: 'Ф2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1054,
          probabilities: [
            {
              outcomeTypeId: 1246,
              odd: 1.9,
              parameters: [
                { type: 'PARAMETER_VALUE', value: '1.5' },
                { type: 'PARAMETER_QUARTER_NUMBER', value: '3' },
              ],
            },
            {
              outcomeTypeId: 1247,
              odd: 1.9,
              parameters: [
                { type: 'PARAMETER_VALUE', value: '-1.5' },
                { type: 'PARAMETER_QUARTER_NUMBER', value: '3' },
              ],
            },
          ],
        },
      ]),
    );

    expect(grouped['3-я четверть']).toHaveLength(1);
    expect(grouped['Фора']).toBeUndefined();
  });

  it('routes WIN_AND_TOTAL combo to Результат + тотал', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1500,
          name: 'WIN1_AND_TOTAL_WITH_OT',
          outcomes: [
            { id: 1501, code: 'П1 и ТБ' },
            { id: 1502, code: 'П1 и ТМ' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1500,
          probabilities: [
            {
              outcomeTypeId: 1501,
              odd: 2.5,
              parameters: [{ type: 'PARAMETER_VALUE', value: '137.5' }],
            },
            {
              outcomeTypeId: 1502,
              odd: 3.1,
              parameters: [{ type: 'PARAMETER_VALUE', value: '137.5' }],
            },
          ],
        },
      ]),
    );

    expect(grouped['Результат + тотал']).toHaveLength(1);
    expect(grouped['Тотал']).toBeUndefined();
  });

  it('maps Нечетный to ODD outcome key', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1200,
          name: 'EVEN_ODD_QUARTER',
          outcomes: [
            { id: 1301, code: 'Четный' },
            { id: 1302, code: 'Нечетный' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1200,
          probabilities: [
            {
              outcomeTypeId: 1301,
              odd: 1.9,
              parameters: [{ type: 'PARAMETER_QUARTER_NUMBER', value: '3' }],
            },
            {
              outcomeTypeId: 1302,
              odd: 1.9,
              parameters: [{ type: 'PARAMETER_QUARTER_NUMBER', value: '3' }],
            },
          ],
        },
      ]),
    );

    const evenOdd = grouped['3-я четверть'] ?? grouped['Тотал (Чет/Нечет)'] ?? [];
    expect(evenOdd).toHaveLength(1);
    expect(evenOdd[0].outcomes.map((o) => o.outcomeKey).sort()).toEqual(['EVEN', 'ODD']);
  });

  it('parses MATCH_WINNER_X2_WITH_OT into h2h without DISPLAY outcome keys', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1060,
          name: 'MATCH_WINNER_X2_WITH_OT',
          outcomes: [
            { id: 1147, code: 'П1' },
            { id: 1148, code: 'П2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1060,
          probabilities: [
            { outcomeTypeId: 1147, odd: 2.1 },
            { outcomeTypeId: 1148, odd: 1.7 },
          ],
        },
      ]),
    );

    const h2h = grouped['1X2'] ?? [];
    expect(h2h).toHaveLength(1);
    expect(h2h[0].marketKey).toBe('h2h_ot');
    expect(h2h[0].outcomes.map((o) => o.outcomeKey).sort()).toEqual(['AWAY', 'HOME']);
  });

  it('humanizes WINNER_YES_NO display market with DISPLAY outcome keys', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 3200,
          name: 'WINNER_YES_NO',
          outcomes: [
            { id: 3201, code: 'П2_нет' },
            { id: 3202, code: 'П2_да' },
            { id: 3203, code: 'Ничья_в_матче' },
            { id: 3204, code: 'П1_да' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 3200,
          probabilities: [
            { outcomeTypeId: 3201, odd: 4.56 },
            { outcomeTypeId: 3202, odd: 1.19 },
            { outcomeTypeId: 3203, odd: 1.17 },
            { outcomeTypeId: 3204, odd: 12.5 },
          ],
        },
      ]),
    );

    expect(grouped['Победа: да/нет']).toHaveLength(1);
    const group = grouped['Победа: да/нет'][0];
    expect(group.marketKey).toBe('display_WINNER_YES_NO');
    expect(group.outcomes.every((o) => o.outcomeKey.startsWith('DISPLAY_'))).toBe(true);
    expect(group.outcomes.find((o) => o.outcomeKey.includes('3201'))?.name).toMatch(/П2:\s*нет/i);
  });

  it('routes scoped DOUBLE_CHANCE to display market with separate category', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 3300,
          name: 'DOUBLE_CHANCE',
          outcomes: [
            { id: 3301, code: '1X' },
            { id: 3302, code: '12' },
            { id: 3303, code: 'X2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 3300,
          probabilities: [
            {
              outcomeTypeId: 3301,
              odd: 1.04,
              parameters: [
                { type: 'PARAMETER_FROM', value: '0' },
                { type: 'PARAMETER_TO', value: '5' },
              ],
            },
            {
              outcomeTypeId: 3302,
              odd: 1.14,
              parameters: [
                { type: 'PARAMETER_FROM', value: '0' },
                { type: 'PARAMETER_TO', value: '5' },
              ],
            },
            {
              outcomeTypeId: 3303,
              odd: 1.01,
              parameters: [
                { type: 'PARAMETER_FROM', value: '0' },
                { type: 'PARAMETER_TO', value: '5' },
              ],
            },
          ],
        },
      ]),
    );

    expect(grouped['Двойной шанс (0–5 мин)']).toHaveLength(1);
    const group = grouped['Двойной шанс (0–5 мин)'][0];
    expect(group.marketKey).toBe('display_DOUBLE_CHANCE');
    expect(group.outcomes.map((o) => o.outcomeKey).sort()).toEqual([
      'DISPLAY_3300_3301_PARAMETER_FROM:0|PARAMETER_TO:5',
      'DISPLAY_3300_3302_PARAMETER_FROM:0|PARAMETER_TO:5',
      'DISPLAY_3300_3303_PARAMETER_FROM:0|PARAMETER_TO:5',
    ]);
  });

  it('appends interval to virtual «Двойной шанс в течение матча» category', async () => {
    resolveVirtualCategoryName.mockReturnValue('Двойной шанс в течение матча');

    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 3300,
          name: 'DOUBLE_CHANCE',
          outcomes: [
            { id: 3301, code: '1X' },
            { id: 3302, code: '12' },
            { id: 3303, code: 'X2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 3300,
          probabilities: [
            {
              outcomeTypeId: 3301,
              odd: 1.6,
              parameters: [
                { type: 'PARAMETER_FROM', value: '0' },
                { type: 'PARAMETER_TO', value: '5' },
              ],
            },
            {
              outcomeTypeId: 3302,
              odd: 1.33,
              parameters: [
                { type: 'PARAMETER_FROM', value: '0' },
                { type: 'PARAMETER_TO', value: '5' },
              ],
            },
            {
              outcomeTypeId: 3303,
              odd: 1.21,
              parameters: [
                { type: 'PARAMETER_FROM', value: '0' },
                { type: 'PARAMETER_TO', value: '5' },
              ],
            },
            {
              outcomeTypeId: 3301,
              odd: 1.42,
              parameters: [
                { type: 'PARAMETER_FROM', value: '5' },
                { type: 'PARAMETER_TO', value: '10' },
              ],
            },
            {
              outcomeTypeId: 3302,
              odd: 1.57,
              parameters: [
                { type: 'PARAMETER_FROM', value: '5' },
                { type: 'PARAMETER_TO', value: '10' },
              ],
            },
            {
              outcomeTypeId: 3303,
              odd: 1.17,
              parameters: [
                { type: 'PARAMETER_FROM', value: '5' },
                { type: 'PARAMETER_TO', value: '10' },
              ],
            },
          ],
        },
      ]),
    );

    expect(grouped['Двойной шанс (0–5 мин)']).toHaveLength(1);
    expect(grouped['Двойной шанс (5–10 мин)']).toHaveLength(1);
    expect(grouped['Двойной шанс в течение матча']).toBeUndefined();
  });

  it('humanizes WINNER_10MIN catalog name', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 3400,
          name: 'WINNER_10MIN',
          outcomes: [
            { id: 3401, code: 'П1' },
            { id: 3402, code: 'Х' },
            { id: 3403, code: 'П2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 3400,
          probabilities: [
            { outcomeTypeId: 3401, odd: 14.25 },
            { outcomeTypeId: 3402, odd: 1.08 },
            { outcomeTypeId: 3403, odd: 9 },
          ],
        },
      ]),
    );

    expect(grouped['Победа (10 мин)']).toHaveLength(1);
    expect(grouped['Победа (10 мин)'][0].marketKey).toBe('display_WINNER_10MIN');
  });

  it('routes set-scoped totals to set tab category', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 4000,
          name: 'TOTAL_SET',
          outcomes: [
            { id: 4001, code: 'ТБ' },
            { id: 4002, code: 'ТМ' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 4000,
          probabilities: [
            {
              outcomeTypeId: 4001,
              odd: 1.85,
              parameters: [
                { type: 'PARAMETER_VALUE', value: '21.5' },
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
              ],
            },
            {
              outcomeTypeId: 4002,
              odd: 1.95,
              parameters: [
                { type: 'PARAMETER_VALUE', value: '21.5' },
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
              ],
            },
          ],
        },
      ]),
    );

    expect(grouped['2-й сет']).toHaveLength(1);
    expect(grouped['2-й сет'][0].label).toBe('2-й сет · Тотал геймов · 21.5');
    expect(grouped['Тотал']).toBeUndefined();
  });

  it('merges SCORE_SET outcomes for the same game into one group', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 2100,
          name: 'SCORE_SET',
          outcomes: [
            { id: 1501, code: '40_0' },
            { id: 1502, code: '40_15' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 2100,
          probabilities: [
            {
              outcomeTypeId: 1501,
              odd: 12,
              parameters: [
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
                { type: 'PARAMETER_GAME_NUMBER', value: '10' },
                { type: 'PARAMETER_HOME_SCORE', value: '40' },
                { type: 'PARAMETER_AWAY_SCORE', value: '0' },
              ],
            },
            {
              outcomeTypeId: 1502,
              odd: 6.9,
              parameters: [
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
                { type: 'PARAMETER_GAME_NUMBER', value: '10' },
                { type: 'PARAMETER_HOME_SCORE', value: '40' },
                { type: 'PARAMETER_AWAY_SCORE', value: '15' },
              ],
            },
          ],
        },
      ]),
    );

    const category = grouped['Счет в гейме'] ?? grouped['Счет'];
    expect(category).toHaveLength(1);
    expect(category![0].label).toBe('2-й сет, 10-й гейм');
    expect(category![0].outcomes.map((o) => o.name)).toEqual(['40:0', '40:15']);
  });

  it('labels WINNER_2GAMES_SET_4WAY with set/game scope and combo outcomes', async () => {
    const outcomes = [
      { id: 18371, code: 'П1П1_2Гейма[]', shortName: 'П1, П1', name: 'П1, П1' },
      { id: 18372, code: 'П1П2_2Гейма[]', shortName: 'П1, П2', name: 'П1, П2' },
      { id: 18373, code: 'П2П1_2Гейма[]', shortName: 'П2, П1', name: 'П2, П1' },
      { id: 18374, code: 'П2П2_2Гейма[]', shortName: 'П2, П2', name: 'П2, П2' },
    ];
    const marketsMap = new Map();
    const marketLabels = new Map<number, string>();
    const outcomeMap = new Map();
    for (const outcome of outcomes) {
      outcomeMap.set(outcome.id, outcome);
    }
    marketsMap.set(1837, { id: 1837, name: 'WINNER_2GAMES_SET_4WAY', outcomes: outcomeMap });
    marketLabels.set(1837, 'WINNER_2GAMES_SET_4WAY');

    loadOlimpbetMarketCatalog.mockResolvedValue({
      markets: marketsMap,
      marketLabels,
      virtualCategoryRefs: new Map(),
      loadedAtMs: Date.now(),
    });

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1837,
          probabilities: outcomes.map((outcome) => ({
            outcomeTypeId: outcome.id,
            odd: 1.95,
            parameters: [
              { type: 'PARAMETER_SET_NUMBER', value: '1' },
              { type: 'PARAMETER_GAME_NUMBER', value: '9' },
            ],
          })),
        },
      ]),
    );

    const category = grouped['Исход двух геймов'];
    expect(category).toHaveLength(1);
    expect(category![0].label).toBe('1-й сет, 9-й гейм');
    expect(category![0].outcomes.map((o) => o.name)).toEqual(['П1, П1', 'П1, П2', 'П2, П1', 'П2, П2']);
  });

  it('splits team set-win yes/no into separate categories', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 4100,
          name: 'TEAM1_WIN_EXACTLY_1SET_YES_NO',
          outcomes: [
            { id: 4101, code: 'К1поб1сет_Да' },
            { id: 4102, code: 'К1поб1сет_Нет' },
          ],
        },
        {
          id: 4200,
          name: 'TEAM2_WIN_EXACTLY_1SET_YES_NO',
          outcomes: [
            { id: 4201, code: 'К2поб1сет_Да' },
            { id: 4202, code: 'К2поб1сет_Нет' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 4100,
          probabilities: [
            { outcomeTypeId: 4101, odd: 2.1 },
            { outcomeTypeId: 4102, odd: 1.7 },
          ],
        },
        {
          marketId: 4200,
          probabilities: [
            { outcomeTypeId: 4201, odd: 3.2 },
            { outcomeTypeId: 4202, odd: 1.3 },
          ],
        },
      ]),
    );

    expect(grouped['П1: выиграет ровно 1 сет']).toHaveLength(1);
    expect(grouped['П2: выиграет ровно 1 сет']).toHaveLength(1);
    expect(grouped['П1: выиграет ровно 1 сет'][0].outcomes.map((o) => o.name)).toEqual(['Да', 'Нет']);
  });

  it('labels half-win yes/no rows inside «Победа в половинах»', async () => {
    resolveVirtualCategoryName.mockImplementation(
      (_catalog: unknown, marketId: number) =>
        [1265, 1266, 1267, 1268, 1379].includes(marketId) ? 'Победа в половинах' : null,
    );

    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1379,
          name: 'DRAW_ONE_HALF',
          outcomes: [
            { id: 1924, code: 'НичьяПолДа' },
            { id: 1925, code: 'НичьяПолНет' },
          ],
        },
        {
          id: 1265,
          name: 'TEAM1_WIN_BOTHPART',
          outcomes: [
            { id: 1654, code: 'П1ОбеПолДа' },
            { id: 1655, code: 'П1ОбеПолНет' },
          ],
        },
        {
          id: 1267,
          name: 'TEAM1_WIN_ONE_PART',
          outcomes: [
            { id: 1658, code: 'П1ПолДа' },
            { id: 1659, code: 'П1ПолНет' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1379,
          probabilities: [
            { outcomeTypeId: 1924, odd: 1.15 },
            { outcomeTypeId: 1925, odd: 5.15 },
          ],
        },
        {
          marketId: 1265,
          probabilities: [
            { outcomeTypeId: 1654, odd: 7.42 },
            { outcomeTypeId: 1655, odd: 1.08 },
          ],
        },
        {
          marketId: 1267,
          probabilities: [
            { outcomeTypeId: 1658, odd: 1.35 },
            { outcomeTypeId: 1659, odd: 3.11 },
          ],
        },
      ]),
    );

    const category = grouped['Победа в половинах'];
    expect(category).toHaveLength(3);
    expect(category.map((group) => group.label)).toEqual([
      'Х хотя бы в одной половине',
      'П1 в обеих половинах',
      'П1 хотя бы в одной половине',
    ]);
    expect(category[0].outcomes.map((o) => o.outcomeKey)).toEqual(['YES', 'NO']);
  });

  it('labels btts-and-outcome markets with readable outcome names', async () => {
    resolveVirtualCategoryName.mockReturnValue('Обе забьют и Исход');

    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1281,
          name: 'WINNER_AND_GOALS_BOTH',
          outcomes: [
            { id: 1686, code: 'ОбеДаП1' },
            { id: 1687, code: 'ОбеНетП1' },
            { id: 1688, code: 'ОбеДаХ' },
            { id: 1689, code: 'ОбеНетХ' },
            { id: 1690, code: 'ОбеДаП2' },
            { id: 1691, code: 'ОбеНетП2' },
          ],
        },
        {
          id: 2462,
          name: 'WIN1_AND_BOTH_TEAM_TO_SCORE_YES_NO',
          outcomes: [
            { id: 4475, code: 'П1иОбеЗаб_Да' },
            { id: 4476, code: 'П1иОбеЗаб_Нет' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1281,
          probabilities: [
            { outcomeTypeId: 1686, odd: 2.03 },
            { outcomeTypeId: 1688, odd: 1.98 },
            { outcomeTypeId: 1690, odd: 11.0 },
          ],
        },
        {
          marketId: 2462,
          probabilities: [
            { outcomeTypeId: 4475, odd: 2.03 },
            { outcomeTypeId: 4476, odd: 1.5 },
          ],
        },
      ]),
    );

    const category = grouped['Обе забьют и Исход'];
    const legacy = category.find((g) => g.marketKey === 'display_WINNER_AND_GOALS_BOTH');
    expect(legacy?.label).toBe('Обе забьют и Исход');
    expect(legacy?.outcomes.map((o) => o.name)).toEqual([
      'ОЗ·Да·П1',
      'ОЗ·Да·X',
      'ОЗ·Да·П2',
    ]);

    const split = category.find((g) => g.marketKey === 'display_WIN1_AND_BOTH_TEAM_TO_SCORE_YES_NO');
    expect(split?.label).toBe('П1');
    expect(split?.outcomes.map((o) => o.name)).toEqual(['ОЗ·Да·П1', 'ОЗ·Нет·П1']);
    expect(split?.outcomes.map((o) => o.outcomeKey)).toEqual(['YES', 'NO']);
  });

  it('labels next-goal markets with readable names', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1153,
          name: 'NEXT_GOAL',
          outcomes: [
            { id: 1359, code: 'Сл_Гол1' },
            { id: 1360, code: 'Сл_Гол2' },
            { id: 1361, code: 'Сл_ГолНик' },
          ],
        },
        {
          id: 2020,
          name: 'NEXT_GOAL_TIME_15MIN',
          outcomes: [
            { id: 3504, code: 'СлГол_15мин' },
            { id: 3505, code: 'СлГол_15мин_НеБудет' },
          ],
        },
        {
          id: 1995,
          name: 'GOAL15MIN_YES_NO',
          outcomes: [
            { id: 3381, code: 'Гол15мин_Да' },
            { id: 3382, code: 'Гол15мин_Нет' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1153,
          probabilities: [
            { outcomeTypeId: 1359, odd: 1.92, parameters: [{ type: 'PARAMETER_GOAL_NUMBER', value: '2' }] },
            { outcomeTypeId: 1360, odd: 10.75, parameters: [{ type: 'PARAMETER_GOAL_NUMBER', value: '2' }] },
            { outcomeTypeId: 1361, odd: 2.24, parameters: [{ type: 'PARAMETER_GOAL_NUMBER', value: '2' }] },
          ],
        },
        {
          marketId: 2020,
          probabilities: [
            { outcomeTypeId: 3504, odd: 1.92 },
            { outcomeTypeId: 3505, odd: 2.5 },
          ],
        },
        {
          marketId: 1995,
          probabilities: [
            {
              outcomeTypeId: 3381,
              odd: 1.97,
              parameters: [
                { type: 'PARAMETER_FROM', value: '76' },
                { type: 'PARAMETER_TO', value: '90' },
              ],
            },
            {
              outcomeTypeId: 3382,
              odd: 1.5,
              parameters: [
                { type: 'PARAMETER_FROM', value: '76' },
                { type: 'PARAMETER_TO', value: '90' },
              ],
            },
          ],
        },
      ]),
    );

    const nextGoal = grouped['Следующий гол'];
    expect(nextGoal.find((g) => g.marketKey === 'display_NEXT_GOAL')?.label).toBe('');
    expect(nextGoal.find((g) => g.marketKey === 'display_NEXT_GOAL')?.outcomes.map((o) => o.name)).toEqual([
      'П1',
      'П2',
      'Никто',
    ]);

    const whenGoal15 =
      grouped['Когда будет забит следующий гол? (15 мин)']
      ?? grouped['В течение 15 мин'];
    expect(whenGoal15).toHaveLength(1);
    expect(whenGoal15[0].label).toBe('В течение 15 мин');
    expect(whenGoal15[0].outcomes.map((o) => o.name)).toEqual(['Будет гол', 'Не будет']);
    expect(whenGoal15[0].outcomes.map((o) => o.outcomeKey)).toEqual(['YES', 'NO']);

    const interval = grouped['Гол в интервале'];
    expect(interval).toHaveLength(1);
    expect(interval[0].label).toBe('76–90 мин');
    expect(interval[0].outcomes.map((o) => o.name)).toEqual(['Да', 'Нет']);
  });

  it('keeps virtual category for next-goal time markets', async () => {
    resolveVirtualCategoryName.mockReturnValue('Когда будет забит следующий гол? (10 мин)');

    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 2019,
          name: 'NEXT_GOAL_TIME_10MIN',
          outcomes: [
            { id: 3502, code: 'СлГол_10мин' },
            { id: 3503, code: 'СлГол_10мин_НеБудет' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 2019,
          probabilities: [
            { outcomeTypeId: 3502, odd: 2.06 },
            { outcomeTypeId: 3503, odd: 1.5 },
          ],
        },
      ]),
    );

    const whenGoal = grouped['Когда будет забит следующий гол? (10 мин)'];
    expect(whenGoal).toHaveLength(1);
    expect(whenGoal[0].label).toBe('В течение 10 мин');
    expect(whenGoal[0].outcomes.map((o) => o.name)).toEqual(['Будет гол', 'Не будет']);
    expect(grouped['Следующий гол']).toBeUndefined();
  });

  it('labels football winning-method outcomes inside one group', async () => {
    resolveVirtualCategoryName.mockReturnValue('Как определится победитель');

    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1008,
          name: 'WINNING_METHOD_FOOTBALL',
          outcomes: [
            { id: 1020, code: 'К1_ОснВремя' },
            { id: 1021, code: 'К1_ОТ' },
            { id: 1022, code: 'К1_Пен' },
            { id: 1023, code: 'К2_ОснВремя' },
            { id: 1024, code: 'К2_ОТ' },
            { id: 1025, code: 'К2_Пен' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1008,
          probabilities: [
            { outcomeTypeId: 1020, odd: 2.42 },
            { outcomeTypeId: 1021, odd: 5.37 },
            { outcomeTypeId: 1022, odd: 12.0 },
            { outcomeTypeId: 1023, odd: 29.0 },
            { outcomeTypeId: 1024, odd: 3.18 },
            { outcomeTypeId: 1025, odd: 12.0 },
          ],
        },
      ]),
    );

    const category = grouped['Как определится победитель'];
    expect(category).toHaveLength(1);
    expect(category[0].label).toBe('Как определится победитель');
    expect(category[0].outcomes.map((o) => o.name)).toEqual([
      'П1 · основное время',
      'П1 · ОТ',
      'П1 · пенальти',
      'П2 · основное время',
      'П2 · ОТ',
      'П2 · пенальти',
    ]);
  });

  it('merges NUMBER_OF_SETS into one category with per-set outcomes', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1358,
          name: 'NUMBER_OF_SETS',
          outcomes: [{ id: 1870, code: 'КолСет' }],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1358,
          probabilities: [
            {
              outcomeTypeId: 1870,
              odd: 2.6,
              parameters: [{ type: 'PARAMETER_VALUE', value: '3' }],
            },
            {
              outcomeTypeId: 1870,
              odd: 2.61,
              parameters: [{ type: 'PARAMETER_VALUE', value: '4' }],
            },
            {
              outcomeTypeId: 1870,
              odd: 3.19,
              parameters: [{ type: 'PARAMETER_VALUE', value: '5' }],
            },
          ],
        },
      ]),
    );

    expect(grouped['Точный счёт']).toBeUndefined();
    expect(grouped['Количество сетов']).toHaveLength(1);
    const group = grouped['Количество сетов'][0];
    expect(group.marketKey).toBe('display_NUMBER_OF_SETS');
    expect(group.label).toBe('Количество сетов');
    expect(group.outcomes).toHaveLength(3);
    expect(group.outcomes.map((o) => o.point)).toEqual([3, 4, 5]);
    expect(group.outcomes.map((o) => o.outcomeKey)).toEqual([
      'DISPLAY_1358_1870_PARAMETER_VALUE:3',
      'DISPLAY_1358_1870_PARAMETER_VALUE:4',
      'DISPLAY_1358_1870_PARAMETER_VALUE:5',
    ]);
  });

  it('routes RACE_TO_GAME to set tab with readable race labels and П1/П2', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1410,
          name: 'RACE_TO_GAME',
          outcomes: [
            { id: 1983, code: 'К1_Гейм[]' },
            { id: 1984, code: 'П2' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1410,
          probabilities: [
            {
              outcomeTypeId: 1983,
              odd: 1.3,
              parameters: [
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
                { type: 'PARAMETER_GAME_NUMBER', value: '2' },
              ],
            },
            {
              outcomeTypeId: 1984,
              odd: 3.51,
              parameters: [
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
                { type: 'PARAMETER_GAME_NUMBER', value: '2' },
              ],
            },
            {
              outcomeTypeId: 1983,
              odd: 1.47,
              parameters: [
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
                { type: 'PARAMETER_GAME_NUMBER', value: '3' },
              ],
            },
            {
              outcomeTypeId: 1984,
              odd: 2.68,
              parameters: [
                { type: 'PARAMETER_SET_NUMBER', value: '2' },
                { type: 'PARAMETER_GAME_NUMBER', value: '3' },
              ],
            },
          ],
        },
      ]),
    );

    expect(grouped['Гонка по геймам']).toBeUndefined();
    expect(grouped['2-й сет']).toHaveLength(2);
    const labels = grouped['2-й сет']!.map((g) => g.label);
    expect(labels).toEqual(['Гонка до 2 геймов', 'Гонка до 3 геймов']);
    expect(grouped['2-й сет']![0].outcomes.map((o) => o.name)).toEqual(['П1', 'П2']);
  });

  it('formats special football display markets with readable labels', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1538,
          name: 'HOW_WILL_GOAL_BE_SCORED',
          outcomes: [
            { id: 2320, code: 'СлГол_УдНогой' },
            { id: 2321, code: 'СлГол_Головой' },
            { id: 2327, code: 'СлГол_НетГола' },
          ],
        },
        {
          id: 2116,
          name: 'MINUTE_GOAL_EVEN_ODD',
          outcomes: [
            { id: 3180, code: 'МинГол_Чет' },
            { id: 3181, code: 'МинГол_Нечет' },
          ],
        },
        {
          id: 1510,
          name: 'PENALTY_REDCARD_YES_NO',
          outcomes: [
            { id: 2280, code: 'Пен_Удал_Да' },
            { id: 2281, code: 'Пен_Удал_Нет' },
          ],
        },
      ]),
    );
    resolveVirtualCategoryName.mockImplementation((_catalog, marketId) => {
      if (marketId === 1538) return 'Как будет забит первый гол';
      if (marketId === 2116) return 'Минута гола (Чет/Нечет)';
      if (marketId === 1510) return 'Пенальти и удаление в матче';
      return null;
    });

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1538,
          probabilities: [
            { outcomeTypeId: 2320, odd: 2.12 },
            { outcomeTypeId: 2321, odd: 7.07 },
            { outcomeTypeId: 2327, odd: 2.52 },
          ],
        },
        {
          marketId: 2116,
          probabilities: [
            { outcomeTypeId: 3180, odd: 1.72 },
            { outcomeTypeId: 3181, odd: 2.02 },
          ],
        },
        {
          marketId: 1510,
          probabilities: [
            { outcomeTypeId: 2280, odd: 16 },
            { outcomeTypeId: 2281, odd: 1.05 },
          ],
        },
      ]),
    );

    const howGoal = grouped['Как будет забит первый гол']?.[0];
    expect(howGoal?.marketKey).toBe('display_HOW_WILL_GOAL_BE_SCORED');
    expect(howGoal?.label).toBe('');
    expect(howGoal?.outcomes).toHaveLength(3);

    const minuteGoal = grouped['Минута гола (Чет/Нечет)']?.[0];
    expect(minuteGoal?.label).toBe('');
    expect(minuteGoal?.outcomes.map((o) => o.name)).toEqual(['Да', 'Нет']);

    const penaltyRed = grouped['Пенальти и удаление в матче']?.[0];
    expect(penaltyRed?.label).toBe('');
    expect(penaltyRed?.outcomes.map((o) => o.name)).toEqual(['Да', 'Нет']);
  });

  it('humanizes esports map markets and outcomes', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1022,
          name: 'WINNER_MAP',
          outcomes: [
            { id: 1, code: 'П1_Карта' },
            { id: 2, code: 'П2_Карта' },
          ],
        },
        {
          id: 1188,
          name: 'FIRST_BLOOD_MAP',
          outcomes: [
            { id: 3, code: 'ПерКр_Карта1' },
            { id: 4, code: 'ПерКр_Карта2' },
          ],
        },
        {
          id: 1739,
          name: 'BARRACKS_MAP',
          outcomes: [
            { id: 5, code: 'Барак_КартаП1' },
            { id: 6, code: 'Барак_КартаП2' },
          ],
        },
      ]),
    );
    resolveVirtualCategoryName.mockImplementation((_catalog, marketId, params) => {
      const mapNum = params?.find((p: { type: string }) => p.type === 'PARAMETER_MAP_NUMBER')?.value;
      if (marketId === 1022 && mapNum === '5') return '5-я карта';
      if (marketId === 1188 && mapNum === '5') return 'Первая кровь в 5-й карте';
      if (marketId === 1739 && mapNum === '5') return 'Разрушение Барака в 5-й карте';
      return null;
    });

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 1022,
          probabilities: [
            { outcomeTypeId: 1, odd: 1.5, parameters: [{ type: 'PARAMETER_MAP_NUMBER', value: '5' }] },
            { outcomeTypeId: 2, odd: 2.5, parameters: [{ type: 'PARAMETER_MAP_NUMBER', value: '5' }] },
          ],
        },
        {
          marketId: 1188,
          probabilities: [
            { outcomeTypeId: 3, odd: 1.8, parameters: [{ type: 'PARAMETER_MAP_NUMBER', value: '5' }] },
            { outcomeTypeId: 4, odd: 1.9, parameters: [{ type: 'PARAMETER_MAP_NUMBER', value: '5' }] },
          ],
        },
        {
          marketId: 1739,
          probabilities: [
            { outcomeTypeId: 5, odd: 1.7, parameters: [{ type: 'PARAMETER_MAP_NUMBER', value: '5' }] },
            { outcomeTypeId: 6, odd: 2.1, parameters: [{ type: 'PARAMETER_MAP_NUMBER', value: '5' }] },
          ],
        },
      ]),
    );

    const mapWinner = grouped['5-я карта']?.[0];
    expect(mapWinner?.label).toBe('');
    expect(mapWinner?.outcomes.map((o) => o.name)).toEqual(['П1', 'П2']);

    const firstBlood = grouped['Первая кровь в 5-й карте']?.[0];
    expect(firstBlood?.outcomes.map((o) => o.name)).toEqual(['П1', 'П2']);

    const barracks = grouped['Разрушение Барака в 5-й карте']?.[0];
    expect(barracks?.outcomes.map((o) => o.name)).toEqual(['П1', 'П2']);
  });

  it('does not append half suffix when category already names the half', async () => {
    resolveVirtualCategoryName.mockImplementation((_catalog, marketId) => {
      if (marketId === 9001) return 'Голы в 1-м тайме';
      if (marketId === 9002) return 'Голы во 2-м тайме';
      return null;
    });

    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 9001,
          name: 'GOALS_HALF',
          outcomes: [
            { id: 1, code: 'Да' },
            { id: 2, code: 'Нет' },
          ],
        },
        {
          id: 9002,
          name: 'GOALS_TEAM1_HALF',
          outcomes: [
            { id: 3, code: 'Да' },
            { id: 4, code: 'Нет' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent([
        {
          marketId: 9001,
          probabilities: [
            {
              outcomeTypeId: 1,
              odd: 1.5,
              parameters: [{ type: 'PARAMETER_HALF_NUMBER', value: '1' }],
            },
            {
              outcomeTypeId: 2,
              odd: 2.5,
              parameters: [{ type: 'PARAMETER_HALF_NUMBER', value: '1' }],
            },
          ],
        },
        {
          marketId: 9002,
          probabilities: [
            {
              outcomeTypeId: 3,
              odd: 1.6,
              parameters: [{ type: 'PARAMETER_HALF_NUMBER', value: '2' }],
            },
            {
              outcomeTypeId: 4,
              odd: 2.4,
              parameters: [{ type: 'PARAMETER_HALF_NUMBER', value: '2' }],
            },
          ],
        },
      ]),
    );

    expect(grouped['Голы в 1-м тайме']?.[0]?.label).toBe('Голы в 1-м тайме');
    expect(grouped['Голы во 2-м тайме']?.[0]?.label).toBe('Голы во 2-м тайме');
  });

  it('labels soccer half totals as plain Тотал, basketball as points', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 2001,
          name: 'TOTAL',
          outcomes: [
            { id: 1, code: 'ТМ' },
            { id: 2, code: 'ТБ' },
          ],
        },
      ]),
    );

    const soccer = await parseOlimpbetEventToGroupedMarkets(
      buildEvent(
        [
          {
            marketId: 2001,
            probabilities: [
              {
                outcomeTypeId: 1,
                odd: 1.9,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '1.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '1' },
                ],
              },
              {
                outcomeTypeId: 2,
                odd: 1.85,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '1.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '1' },
                ],
              },
            ],
          },
        ],
        100,
      ),
    );

    const basketball = await parseOlimpbetEventToGroupedMarkets(
      buildEvent(
        [
          {
            marketId: 2001,
            probabilities: [
              {
                outcomeTypeId: 1,
                odd: 1.9,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '110.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '1' },
                ],
              },
              {
                outcomeTypeId: 2,
                odd: 1.85,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '110.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '1' },
                ],
              },
            ],
          },
        ],
        102,
      ),
    );

    const soccerHalf = soccer['1-й тайм'] ?? [];
    expect(soccerHalf[0]?.label).toMatch(/1-й тайм · Тотал/);
    expect(soccerHalf[0]?.label).not.toMatch(/Тотал голов/);
    expect(soccerHalf[0]?.label).not.toMatch(/Тотал очков/);

    const basketballHalf = basketball['1-й тайм'] ?? [];
    expect(basketballHalf[0]?.label).toMatch(/Тотал очков/);
  });

  it('labels linked corner totals as corners, not goals', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 3001,
          name: 'TOTAL',
          outcomes: [
            { id: 1, code: 'ТМ' },
            { id: 2, code: 'ТБ' },
          ],
        },
      ]),
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent(
        [
          {
            marketId: 3001,
            probabilities: [
              {
                outcomeTypeId: 1,
                odd: 1.9,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '4.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '1' },
                ],
              },
              {
                outcomeTypeId: 2,
                odd: 1.85,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '4.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '1' },
                ],
              },
            ],
          },
        ],
        100,
      ),
      'Угловые',
      false,
    );

    const corners = grouped['Угловые'] ?? [];
    expect(corners[0]?.label).toMatch(/Тотал угловых/);
    expect(corners[0]?.label).not.toMatch(/Тотал голов/);
  });

  it('keeps injury-time and asian half totals out of generic goal totals', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1572,
          name: 'TOTAL_ADD_TIME_HALF',
          outcomes: [
            { id: 1, code: 'ТМ' },
            { id: 2, code: 'ТБ' },
          ],
        },
        {
          id: 1073,
          name: 'TOTAL_ASIAN_HALF',
          outcomes: [
            { id: 3, code: 'ТМ' },
            { id: 4, code: 'ТБ' },
          ],
        },
      ]),
    );

    const { resolveVirtualCategoryName } = jest.requireMock('./olimpbet-wc-catalog') as {
      resolveVirtualCategoryName: jest.Mock;
    };
    resolveVirtualCategoryName.mockImplementation(
      (_catalog: unknown, marketId: number, parameters?: Array<{ type: string; value: string }>) => {
        const half = parameters?.find((p) => p.type === 'PARAMETER_HALF_NUMBER')?.value;
        if (marketId === 1572) {
          return half === '2'
            ? 'Компенсированное время во 2-м тайме (мин)'
            : 'Компенсированное время в 1-м тайме (мин)';
        }
        if (marketId === 1073) {
          return half === '2' ? 'Азиатский тотал 2-го тайма' : 'Азиатский тотал 1-го тайма';
        }
        return null;
      },
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent(
        [
          {
            marketId: 1572,
            probabilities: [
              {
                outcomeTypeId: 1,
                odd: 2.45,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '6.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '2' },
                ],
              },
              {
                outcomeTypeId: 2,
                odd: 1.5,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '6.5' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '2' },
                ],
              },
            ],
          },
          {
            marketId: 1073,
            probabilities: [
              {
                outcomeTypeId: 3,
                odd: 3.29,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '0.75' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '2' },
                ],
              },
              {
                outcomeTypeId: 4,
                odd: 1.32,
                parameters: [
                  { type: 'PARAMETER_VALUE', value: '0.75' },
                  { type: 'PARAMETER_HALF_NUMBER', value: '2' },
                ],
              },
            ],
          },
        ],
        100,
      ),
    );

    expect(Object.keys(grouped).some((k) => /компенсирован/i.test(k))).toBe(true);
    expect(Object.keys(grouped).some((k) => /азиатск/i.test(k))).toBe(true);

    const injury = Object.entries(grouped).find(([k]) => /компенсирован/i.test(k))?.[1] ?? [];
    expect(injury[0]?.label).toMatch(/компенсирован|минут/i);
    expect(injury[0]?.label).not.toMatch(/Тотал голов/);

    const asian = Object.entries(grouped).find(([k]) => /азиатск/i.test(k))?.[1] ?? [];
    expect(asian[0]?.label).toMatch(/азиатск/i);
    expect(asian[0]?.label).not.toMatch(/Тотал голов/);

    const halfGoals = grouped['2-й тайм'] ?? [];
    expect(halfGoals.every((g) => !/6\.5|0\.75/.test(g.label))).toBe(true);
  });

  it('drops specialty minute-totals junk and keeps match TOTAL in Тотал', async () => {
    loadOlimpbetMarketCatalog.mockResolvedValue(
      buildCatalog([
        {
          id: 1003,
          name: 'TOTAL',
          outcomes: [
            { id: 1, code: 'ТМ' },
            { id: 2, code: 'ТБ' },
          ],
        },
        {
          id: 2114,
          name: 'TOTAL_GOALS_MINUTES',
          outcomes: [
            { id: 3, code: 'ТМ' },
            { id: 4, code: 'ТБ' },
          ],
        },
      ]),
    );

    const { resolveVirtualCategoryName } = jest.requireMock('./olimpbet-wc-catalog') as {
      resolveVirtualCategoryName: jest.Mock;
    };
    resolveVirtualCategoryName.mockImplementation(
      (_catalog: unknown, marketId: number) => {
        if (marketId === 1003) return 'Тотал';
        if (marketId === 2114) return 'Тотал минут голов';
        return null;
      },
    );

    const grouped = await parseOlimpbetEventToGroupedMarkets(
      buildEvent(
        [
          {
            marketId: 1003,
            probabilities: [
              {
                outcomeTypeId: 1,
                odd: 1.9,
                parameters: [{ type: 'PARAMETER_VALUE', value: '2.5' }],
              },
              {
                outcomeTypeId: 2,
                odd: 1.9,
                parameters: [{ type: 'PARAMETER_VALUE', value: '2.5' }],
              },
            ],
          },
          {
            marketId: 2114,
            probabilities: [
              {
                outcomeTypeId: 3,
                odd: 1.85,
                parameters: [{ type: 'PARAMETER_VALUE', value: '127.5' }],
              },
              {
                outcomeTypeId: 4,
                odd: 1.85,
                parameters: [{ type: 'PARAMETER_VALUE', value: '127.5' }],
              },
            ],
          },
        ],
        1,
      ),
    );

    const matchTotal = grouped['Тотал'] ?? [];
    expect(matchTotal.some((g) => g.marketKey === 'totals')).toBe(true);
    expect(matchTotal.every((g) => !/127\.5/.test(g.label))).toBe(true);
    expect(matchTotal.every((g) => !/^display_/i.test(g.marketKey))).toBe(true);

    expect(Object.keys(grouped).some((k) => /минут/i.test(k))).toBe(false);
    expect(
      Object.values(grouped).flat().some((g) => /TOTAL_GOALS_MINUTES/i.test(g.marketKey)),
    ).toBe(false);
  });
});
