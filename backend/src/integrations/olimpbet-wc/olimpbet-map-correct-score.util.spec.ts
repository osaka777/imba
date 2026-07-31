import {
  isFlatPlaceholderOddsBook,
  isValidEsportsMapCorrectScore,
  stripFlatPlaceholderEsportsMarkets,
  stripPlaceholderMapCorrectScoreMarkets,
  stripStubTenOutcomes,
} from './olimpbet-map-correct-score.util';

describe('olimpbet-map-correct-score.util', () => {
  describe('isValidEsportsMapCorrectScore', () => {
    it('accepts MR12 regulation finals', () => {
      expect(isValidEsportsMapCorrectScore(13, 0)).toBe(true);
      expect(isValidEsportsMapCorrectScore(13, 11)).toBe(true);
      expect(isValidEsportsMapCorrectScore(0, 13)).toBe(true);
      expect(isValidEsportsMapCorrectScore(11, 13)).toBe(true);
    });

    it('rejects draws and impossible regulation caps', () => {
      expect(isValidEsportsMapCorrectScore(12, 12)).toBe(false);
      expect(isValidEsportsMapCorrectScore(13, 12)).toBe(false);
      expect(isValidEsportsMapCorrectScore(16, 15)).toBe(false);
      expect(isValidEsportsMapCorrectScore(10, 10)).toBe(false);
      expect(isValidEsportsMapCorrectScore(11, 9)).toBe(false); // no winner yet
    });

    it('accepts Valorant OT finals (win-by-2 from 12-12)', () => {
      expect(isValidEsportsMapCorrectScore(14, 12)).toBe(true);
      expect(isValidEsportsMapCorrectScore(15, 13)).toBe(true);
      expect(isValidEsportsMapCorrectScore(12, 14)).toBe(true);
    });

    it('accepts CS2 OT and double-OT finals', () => {
      expect(isValidEsportsMapCorrectScore(16, 12)).toBe(true);
      expect(isValidEsportsMapCorrectScore(16, 14)).toBe(true);
      expect(isValidEsportsMapCorrectScore(19, 15)).toBe(true);
      expect(isValidEsportsMapCorrectScore(19, 16)).toBe(true);
      expect(isValidEsportsMapCorrectScore(19, 17)).toBe(true);
    });
  });

  describe('stripFlatPlaceholderEsportsMarkets', () => {
    it('drops a totals book stubbed at a single price', () => {
      const grouped = stripFlatPlaceholderEsportsMarkets({
        'Тотал раундов': [
          {
            key: 'totals',
            marketKey: 'totals',
            label: '',
            outcomes: Array.from({ length: 12 }, (_, i) => ({
              name: i % 2 ? 'Б' : 'М',
              price: 10,
              outcomeKey: `O${i}`,
            })),
          },
        ],
        '1X2': [
          {
            key: 'h2h',
            marketKey: 'h2h',
            label: '',
            outcomes: [
              { name: 'П1', price: 2.14, outcomeKey: 'HOME' },
              { name: 'П2', price: 1.61, outcomeKey: 'AWAY' },
            ],
          },
        ],
      });

      expect(grouped['Тотал раундов']).toBeUndefined();
      expect(grouped['1X2']).toHaveLength(1);
    });

    it('keeps normally priced esports books', () => {
      const grouped = stripFlatPlaceholderEsportsMarkets({
        'Индивидуальный тотал': [
          {
            key: 'totals_home',
            marketKey: 'totals_home',
            label: '',
            outcomes: [
              { name: 'М', price: 2.22, outcomeKey: 'U8.5' },
              { name: 'Б', price: 1.57, outcomeKey: 'O8.5' },
              { name: 'М', price: 1.82, outcomeKey: 'U9.5' },
              { name: 'Б', price: 1.85, outcomeKey: 'O9.5' },
              { name: 'М', price: 2.82, outcomeKey: 'U10.5' },
              { name: 'Б', price: 1.42, outcomeKey: 'O10.5' },
            ],
          },
        ],
      });

      expect(grouped['Индивидуальный тотал']).toHaveLength(1);
    });
  });

  describe('isFlatPlaceholderOddsBook', () => {
    it('detects stub books dominated by one price', () => {
      const prices = [...Array(24).fill(10), 5.58];
      expect(isFlatPlaceholderOddsBook(prices)).toBe(true);
    });

    it('detects classic 75% × 10.00 SCORE_MAP stubs (18/24)', () => {
      const prices = [...Array(18).fill(10), 9.5, 8.5, 8.25, 7.5, 6.5, 5.5];
      expect(isFlatPlaceholderOddsBook(prices)).toBe(true);
    });

    it('keeps normally priced books', () => {
      const prices = [8.5, 9.2, 11, 14, 18, 22, 28, 35, 42, 55, 70, 90];
      expect(isFlatPlaceholderOddsBook(prices)).toBe(false);
    });
  });

  describe('stripStubTenOutcomes', () => {
    it('removes minority stub-10 outcomes from a mixed book', () => {
      const outcomes = [
        { name: '13:5', price: 9.5 },
        { name: '13:6', price: 8.5 },
        { name: '13:0', price: 10 },
        { name: '13:1', price: 10 },
        { name: '13:2', price: 10 },
        { name: '13:7', price: 7.5 },
        { name: '13:8', price: 6.5 },
        { name: '13:9', price: 5.5 },
      ];
      expect(stripStubTenOutcomes(outcomes).map((o) => o.name)).toEqual([
        '13:5',
        '13:6',
        '13:7',
        '13:8',
        '13:9',
      ]);
    });
  });

  describe('stripPlaceholderMapCorrectScoreMarkets', () => {
    it('drops flat SCORE_MAP category and invalid draws', () => {
      const grouped = stripPlaceholderMapCorrectScoreMarkets({
        'Счет в 3-й карте': [
          {
            key: '1189__scoremap|3',
            marketKey: 'display_SCORE_MAP',
            label: '',
            outcomes: [
              { name: '13:0', price: 10, outcomeKey: 'SCORE_13:0' },
              { name: '13:1', price: 10, outcomeKey: 'SCORE_13:1' },
              { name: '13:2', price: 10, outcomeKey: 'SCORE_13:2' },
              { name: '13:3', price: 10, outcomeKey: 'SCORE_13:3' },
              { name: '13:4', price: 10, outcomeKey: 'SCORE_13:4' },
              { name: '13:5', price: 10, outcomeKey: 'SCORE_13:5' },
              { name: '13:6', price: 10, outcomeKey: 'SCORE_13:6' },
              { name: '13:7', price: 10, outcomeKey: 'SCORE_13:7' },
              { name: '13:8', price: 10, outcomeKey: 'SCORE_13:8' },
              { name: '12:12', price: 5.58, outcomeKey: 'SCORE_12:12' },
              { name: '0:13', price: 10, outcomeKey: 'SCORE_0:13' },
              { name: '1:13', price: 10, outcomeKey: 'SCORE_1:13' },
              { name: '2:13', price: 10, outcomeKey: 'SCORE_2:13' },
              { name: '—', price: 10, outcomeKey: 'JUNK' },
            ],
          },
        ],
        '1X2': [
          {
            key: 'h2h',
            marketKey: 'h2h',
            label: '',
            outcomes: [
              { name: 'П1', price: 2.14, outcomeKey: 'HOME' },
              { name: 'П2', price: 1.61, outcomeKey: 'AWAY' },
            ],
          },
        ],
      });

      expect(grouped['Счет в 3-й карте']).toBeUndefined();
      expect(grouped['1X2']).toHaveLength(1);
    });

    it('keeps priced SCORE_MAP and drops only invalid lines', () => {
      const grouped = stripPlaceholderMapCorrectScoreMarkets({
        'Счет в 1-й карте': [
          {
            key: '1189__scoremap|1',
            marketKey: 'display_SCORE_MAP',
            label: '',
            outcomes: [
              { name: '13:5', price: 8.5, outcomeKey: 'SCORE_13:5' },
              { name: '13:7', price: 6.2, outcomeKey: 'SCORE_13:7' },
              { name: '13:9', price: 5.1, outcomeKey: 'SCORE_13:9' },
              { name: '13:10', price: 4.4, outcomeKey: 'SCORE_13:10' },
              { name: '13:11', price: 3.9, outcomeKey: 'SCORE_13:11' },
              { name: '12:12', price: 12, outcomeKey: 'SCORE_12:12' },
              { name: '5:13', price: 9.1, outcomeKey: 'SCORE_5:13' },
              { name: '7:13', price: 7.2, outcomeKey: 'SCORE_7:13' },
              { name: '9:13', price: 5.8, outcomeKey: 'SCORE_9:13' },
              { name: '10:13', price: 4.8, outcomeKey: 'SCORE_10:13' },
              { name: '11:13', price: 4.1, outcomeKey: 'SCORE_11:13' },
              { name: '16:14', price: 15, outcomeKey: 'SCORE_16:14' },
            ],
          },
        ],
      });

      const outcomes = grouped['Счет в 1-й карте']?.[0]?.outcomes.map((o) => o.name) ?? [];
      expect(outcomes).toContain('13:11');
      expect(outcomes).toContain('16:14');
      expect(outcomes).not.toContain('12:12');
    });

    it('drops SCORE_MAP books that are mostly stubbed at 10.00 even if a few lines are priced', () => {
      const outcomes = [
        ...Array.from({ length: 12 }, (_, i) => ({
          name: `13:${i}`,
          price: 10,
          outcomeKey: `H_${i}`,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          name: `${i}:13`,
          price: 10,
          outcomeKey: `A_${i}`,
        })),
        { name: '13:5', price: 9.5, outcomeKey: 'P1' },
        { name: '13:6', price: 8.5, outcomeKey: 'P2' },
        { name: '13:7', price: 8.25, outcomeKey: 'P3' },
        { name: '13:8', price: 8.25, outcomeKey: 'P4' },
        { name: '13:9', price: 7.5, outcomeKey: 'P5' },
        { name: '13:10', price: 6.5, outcomeKey: 'P6' },
      ];

      const grouped = stripPlaceholderMapCorrectScoreMarkets({
        'Счет во 2-й карте': [
          {
            key: 'm2',
            marketKey: 'display_SCORE_MAP',
            label: '',
            outcomes,
          },
        ],
      });
      expect(grouped['Счет во 2-й карте']).toBeUndefined();
    });
  });
});
