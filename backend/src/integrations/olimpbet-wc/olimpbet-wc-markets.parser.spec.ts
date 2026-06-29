import type { OlimpbetMarketCatalog } from './olimpbet-wc-catalog';
import { parseOlimpbetEventToGroupedMarkets } from './olimpbet-wc-markets.parser';
import type { OlimpbetEventDetail } from './olimpbet-wc.types';

jest.mock('./olimpbet-wc-catalog', () => ({
  ...jest.requireActual('./olimpbet-wc-catalog'),
  loadOlimpbetMarketCatalog: jest.fn(),
  formatOutcomeLabel: jest.fn((_catalog, marketId, prob) => {
    const codes: Record<string, string> = {
      '1076:1189': 'ТМ',
      '1076:1190': 'ТБ',
      '1104:1246': 'Ф1',
      '1104:1247': 'Ф2',
      '1060:1147': 'П1',
      '1060:1148': 'П2',
    };
    return codes[`${marketId}:${prob.outcomeTypeId}`] ?? `OUT_${prob.outcomeTypeId}`;
  }),
  catalogMarketLabel: jest.fn((_catalog, marketId) => `Market ${marketId}`),
  resolveVirtualCategoryName: jest.fn(() => null),
}));

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

function buildEvent(markets: OlimpbetEventDetail['probabilities']['markets']): OlimpbetEventDetail {
  return {
    id: 1,
    competitors: [
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
    ],
    eventDate: new Date().toISOString(),
    probabilities: {
      eventId: 1,
      markets,
    },
  };
}

describe('parseOlimpbetEventToGroupedMarkets', () => {
  const { loadOlimpbetMarketCatalog } = jest.requireMock('./olimpbet-wc-catalog') as {
    loadOlimpbetMarketCatalog: jest.Mock;
  };

  beforeEach(() => {
    loadOlimpbetMarketCatalog.mockReset();
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
});
