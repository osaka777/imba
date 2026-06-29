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
});
