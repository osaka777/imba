import { WcOddsBetStatus } from '@prisma/client';

import { resolveWcBetResult } from './wc-odds-settlement.util';

describe('resolveWcBetResult', () => {
  describe('even_odd', () => {
    it('wins EVEN when total goals are even', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'even_odd', outcomeKey: 'EVEN', line: null },
          2,
          0,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('loses EVEN when total goals are odd', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'even_odd', outcomeKey: 'EVEN', line: null },
          2,
          1,
        ),
      ).toBe(WcOddsBetStatus.LOSE);
    });

    it('wins ODD when total goals are odd', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'even_odd', outcomeKey: 'ODD', line: null },
          1,
          2,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('normalizes display_EVEN_ODD market key', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'display_EVEN_ODD', outcomeKey: 'ODD', line: null },
          0,
          1,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });
  });

  describe('totals', () => {
    it('voids push on exact line', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals', outcomeKey: 'OVER_2', line: '2' },
          1,
          1,
        ),
      ).toBe(WcOddsBetStatus.VOID);
    });

    it('settles match total over/under', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals', outcomeKey: 'OVER_2.5', line: '2.5' },
          2,
          1,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('keeps OVER pending when total is below line and match is still live', () => {
      const liveDetail = {
        id: 1,
        competitors: [],
        eventDate: new Date(Date.now() - 70 * 60_000).toISOString(),
        live: true,
        status: 'EVENT_TRADING',
        statistics: [
          { code: 'score', value: '2:0' },
          { code: 'match_phase', value: '4' },
        ],
      };

      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals', outcomeKey: 'OVER_4.0', line: '4' },
          2,
          0,
          liveDetail,
        ),
      ).toBeNull();
    });

    it('keeps h2h draw pending while match is still live at 2:0', () => {
      const liveDetail = {
        id: 1,
        competitors: [],
        eventDate: new Date(Date.now() - 70 * 60_000).toISOString(),
        live: true,
        status: 'EVENT_TRADING',
        statistics: [
          { code: 'score', value: '2:0' },
          { code: 'match_phase', value: '4' },
        ],
      };

      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'h2h', outcomeKey: 'DRAW', line: null },
          2,
          0,
          liveDetail,
        ),
      ).toBeNull();
    });
  });

  describe('team totals', () => {
    it('uses home score for totals_home', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals_home', outcomeKey: 'UNDER_1.5', line: '1.5' },
          1,
          4,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('uses away score for totals_away', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals_away', outcomeKey: 'OVER_2.5', line: '2.5' },
          0,
          3,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('does not mix in opponent goals', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals_home', outcomeKey: 'OVER_2.5', line: '2.5' },
          1,
          5,
        ),
      ).toBe(WcOddsBetStatus.LOSE);
    });
  });

  describe('double_chance', () => {
    it('wins DC_1X on home win', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'double_chance', outcomeKey: 'DC_1X', line: null },
          2,
          1,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });
  });

  describe('overtime scope', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      score: { home: 3, away: 2 },
      statistics: [{ code: 'scores_by_periods', value: '1:0,1:1,1:1' }],
    };

    it('settles regular totals on regulation score', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals', outcomeKey: 'UNDER_2.5', line: '2.5' },
          3,
          2,
          detail,
        ),
      ).toBe(WcOddsBetStatus.LOSE);
    });

    it('settles overtime totals on final score', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'totals_ot', outcomeKey: 'OVER_4.5', line: '4.5' },
          3,
          2,
          detail,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });
  });

  describe('handicap', () => {
    it('voids asian push on integer line', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'handicap', outcomeKey: 'HOME_HCP_-1', line: '-1' },
          2,
          1,
        ),
      ).toBe(WcOddsBetStatus.VOID);
    });

    it('settles quarter handicap using period score from outcomeName', () => {
      const detail = {
        id: 1,
        competitors: [],
        eventDate: '',
        score: { home: 80, away: 70 },
        statistics: [{ code: 'scores_by_periods', value: '20:18,22:17,19:18,19:17' }],
      };
      expect(
        resolveWcBetResult(
          {
            pick: null,
            marketKey: 'handicap',
            outcomeKey: 'HOME_HCP_1.5',
            line: '1.5',
            outcomeName: 'Фора 3-я четверть 1.5: Ф1 (1.5)',
          },
          80,
          70,
          detail,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });
  });

  describe('handicap_3way', () => {
    it('settles home win with negative handicap', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'handicap_3way', outcomeKey: 'HOME', line: '-1' },
          3,
          1,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('settles draw when adjusted score is level', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'handicap_3way', outcomeKey: 'DRAW', line: '-1' },
          2,
          1,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('settles away when home handicap is not enough', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'handicap_3way', outcomeKey: 'AWAY', line: '-1' },
          2,
          1,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });
  });

  describe('goals_both_half', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      status: 'EVENT_FINISHED',
      score: { home: 2, away: 1 },
      statistics: [{ code: 'scores_by_periods', value: '1:0,1:1' }],
    };

    it('wins YES when both halves have goals', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'goals_both_half', outcomeKey: 'YES', line: null },
          2,
          1,
          detail,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('loses YES when one half is goalless', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'goals_both_half', outcomeKey: 'YES', line: null },
          1,
          0,
          {
            ...detail,
            statistics: [{ code: 'scores_by_periods', value: '1:0,0:0' }],
          },
        ),
      ).toBe(WcOddsBetStatus.LOSE);
    });

    it('normalizes display_GOALS_BOTHHALF market key', () => {
      expect(
        resolveWcBetResult(
          { pick: null, marketKey: 'display_GOALS_BOTHHALF', outcomeKey: 'NO', line: null },
          1,
          0,
          {
            ...detail,
            statistics: [{ code: 'scores_by_periods', value: '1:0,0:0' }],
          },
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });
  });

  describe('HALF_MATCH HT/FT + total', () => {
    const closed = {
      id: 1,
      status: 'EVENT_CLOSED',
      live: false,
      eventDate: '2026-07-14T19:00:00.000Z',
      statistics: [] as Array<{ code: string; value: string }>,
      probabilities: null,
    };

    it('loses W2X+Under when FT is away win (not draw), without HT scores', () => {
      // France 0:2 Spain — FT = W2, required FT = X → LOSE
      expect(
        resolveWcBetResult(
          {
            pick: null,
            marketKey: 'display_HALF_MATCH_W2X_AND_TOTAL',
            outcomeKey: 'DISPLAY_1328_1800_PARAMETER_VALUE:2.5',
            line: '2.5',
            outcomeName: '2.5: ТМ',
          },
          0,
          2,
          closed as never,
        ),
      ).toBe(WcOddsBetStatus.LOSE);
    });

    it('wins W2W2+Under when HT and FT are away wins and total under holds', () => {
      expect(
        resolveWcBetResult(
          {
            pick: null,
            marketKey: 'display_HALF_MATCH_W2W2_AND_TOTAL',
            outcomeKey: 'DISPLAY_1329_1802_PARAMETER_VALUE:2.5',
            line: '2.5',
            outcomeName: '2.5: ТМ',
          },
          0,
          2,
          {
            ...closed,
            statistics: [{ code: 'scores_by_periods', value: '0:1,0:1' }],
          } as never,
        ),
      ).toBe(WcOddsBetStatus.WIN);
    });

    it('early-loses Under when goals already exceed the line in-play', () => {
      expect(
        resolveWcBetResult(
          {
            pick: null,
            marketKey: 'display_HALF_MATCH_W2X_AND_TOTAL',
            outcomeKey: 'DISPLAY_1328_1800_PARAMETER_VALUE:2.5',
            line: '2.5',
            outcomeName: '2.5: ТМ',
          },
          1,
          2,
          {
            id: 1,
            status: 'EVENT_IN_PROGRESS',
            live: true,
            eventDate: '2026-07-14T19:00:00.000Z',
            statistics: [{ code: 'match_phase', value: '7' }],
            probabilities: null,
          } as never,
        ),
      ).toBe(WcOddsBetStatus.LOSE);
    });
  });
});
