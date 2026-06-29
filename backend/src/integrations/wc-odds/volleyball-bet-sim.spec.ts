/**
 * Volleyball bet settlement simulator — regression harness for WC/Olimpbet markets.
 * Run: npm test -- --testPathPattern=volleyball-bet-sim
 */
import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import {
  extractRegulationScore,
  isMarketScopeFinalized,
  looksLikePointSetSportPeriods,
  parseMarketScopeFromText,
  pickSettlementScores,
} from '../olimpbet-wc/olimpbet-score-scope.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import { emptyMatchState } from './wc-match-state.types';
import { resolveWcBetResult } from './wc-odds-settlement.util';
import { resolveDeterminateBetResult } from './wc-verified-settlement.util';

type VolleyballScenario = {
  name: string;
  bet: {
    pick?: WcOddsPick | null;
    marketKey: string;
    outcomeKey: string | null;
    line?: string | null;
    outcomeName?: string | null;
    placementContext?: { totalsGroupLabel?: string };
  };
  detail: OlimpbetEventDetail;
  homeSets?: number;
  awaySets?: number;
  /** Expected from resolveDeterminateBetResult (early/in-play). null = must stay pending. */
  expectEarly: WcOddsBetStatus | null;
  /** Expected from resolveWcBetResult when match ended (optional). */
  expectFinal?: WcOddsBetStatus | null;
};

function vbDetail(
  scoresByPeriods: string,
  opts: {
    live?: boolean;
    status?: string;
    matchPhase?: string;
    setsWon?: [number, number];
  } = {},
): OlimpbetEventDetail {
  const stats: Array<{ code: string; value: string }> = [
    { code: 'scores_by_periods', value: scoresByPeriods },
  ];
  if (opts.matchPhase != null) stats.push({ code: 'match_phase', value: opts.matchPhase });
  if (opts.setsWon) stats.push({ code: 'score', value: `${opts.setsWon[0]}:${opts.setsWon[1]}` });

  return {
    id: 8278479,
    competitors: [],
    eventDate: '2026-06-28T20:45:00Z',
    live: opts.live ?? true,
    status: opts.status ?? 'EVENT_TRADING',
    score: opts.setsWon ? { home: opts.setsWon[0], away: opts.setsWon[1] } : { home: 1, away: 1 },
    statistics: stats,
  } as OlimpbetEventDetail;
}

function runScenario(s: VolleyballScenario): {
  early: WcOddsBetStatus | null;
  final: WcOddsBetStatus | null;
} {
  const home = s.homeSets ?? 1;
  const away = s.awaySets ?? 1;
  const state = emptyMatchState();
  const bet = {
    pick: s.bet.pick ?? null,
    marketKey: s.bet.marketKey,
    outcomeKey: s.bet.outcomeKey,
    line: s.bet.line ?? null,
    outcomeName: s.bet.outcomeName ?? null,
    placementContext: s.bet.placementContext as import('./wc-bet-placement-context.util').WcBetPlacementContext | null,
  };

  const early = resolveDeterminateBetResult(bet, home, away, s.detail, state);
  const finalDetail = {
    ...s.detail,
    live: false,
    status: 'EVENT_CLOSED',
  } as OlimpbetEventDetail;
  const final = resolveWcBetResult(bet, home, away, finalDetail, state);
  return { early, final };
}

const SCENARIOS: VolleyballScenario[] = [
  {
    name: 'set3 UNDER 40.5 in-play (11:20) — pending',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'UNDER_40.5',
      line: '40.5',
      outcomeName: '3-й сет · Тотал геймов · 40.5 — Меньше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 40.5' },
    },
    detail: vbDetail('25:21,19:25,11:20', { matchPhase: '7', setsWon: [1, 1] }),
    expectEarly: null,
  },
  {
    name: 'set3 UNDER 40.5 with match_phase=7 must NOT early-win (regression)',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'UNDER_40.5',
      line: '40.5',
      outcomeName: '3-й сет · Тотал геймов · 40.5 — Меньше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 40.5' },
    },
    detail: vbDetail('25:21,19:25,11:20', { matchPhase: '7' }),
    expectEarly: null,
  },
  {
    name: 'set3 OVER 44.5 in-play (11:20) — pending',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'OVER_44.5',
      line: '44.5',
      outcomeName: '3-й сет · Тотал геймов · 44.5 — Больше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 44.5' },
    },
    detail: vbDetail('25:21,19:25,11:20', { matchPhase: '7' }),
    expectEarly: null,
  },
  {
    name: 'set3 OVER 44.5 after set ends 21:24 (45 pts) — early WIN',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'OVER_44.5',
      line: '44.5',
      outcomeName: '3-й сет · Тотал геймов · 44.5 — Больше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 44.5' },
    },
    detail: vbDetail('25:21,19:25,21:24,3:2', { setsWon: [1, 1] }),
    expectEarly: WcOddsBetStatus.WIN,
  },
  {
    name: 'set3 UNDER 45.5 after set ends 21:24 (45 pts) — WIN',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'UNDER_45.5',
      line: '45.5',
      outcomeName: '3-й сет · Тотал геймов · 45.5 — Меньше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 45.5' },
    },
    detail: vbDetail('25:21,19:25,21:24,5:3', { setsWon: [1, 1] }),
    expectEarly: WcOddsBetStatus.WIN,
  },
  {
    name: 'set3 UNDER 45.5 in-play at 22:24 (46 pts) — early LOSE',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'UNDER_45.5',
      line: '45.5',
      outcomeName: '3-й сет · Тотал геймов · 45.5 — Меньше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 45.5' },
    },
    detail: vbDetail('25:21,19:25,22:24', { matchPhase: '7' }),
    expectEarly: WcOddsBetStatus.LOSE,
  },
  {
    name: 'set3 OVER 44.5 in-play at 22:24 (46 pts) — early WIN',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'OVER_44.5',
      line: '44.5',
      outcomeName: '3-й сет · Тотал геймов · 44.5 — Больше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 44.5' },
    },
    detail: vbDetail('25:21,19:25,22:24', { matchPhase: '7' }),
    expectEarly: WcOddsBetStatus.WIN,
  },
  {
    name: 'match total OVER 181.5 after 3 sets (135 pts) — pending until match end',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'OVER_181.5',
      line: '181.5',
      outcomeName: 'Тотал голов · 181.5 — Больше',
    },
    detail: vbDetail('25:21,19:25,21:24', { setsWon: [1, 1] }),
    expectEarly: null,
    expectFinal: WcOddsBetStatus.LOSE,
  },
  {
    name: 'match total scope: 3 sets sum to 65:70 — OVER 130.5 early WIN',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'OVER_130.5',
      line: '130.5',
      outcomeName: 'Тотал голов · 130.5 — Больше',
    },
    detail: vbDetail('25:21,19:25,21:24', { setsWon: [1, 1] }),
    expectEarly: WcOddsBetStatus.WIN,
    expectFinal: WcOddsBetStatus.WIN,
  },
  {
    name: 'h2h AWAY in-play — pending',
    bet: {
      pick: WcOddsPick.AWAY,
      marketKey: 'h2h',
      outcomeKey: 'AWAY',
      outcomeName: '1X2: П2',
    },
    detail: vbDetail('25:21,19:25,21:24,5:3', { setsWon: [1, 1] }),
    expectEarly: null,
  },
  {
    name: 'h2h AWAY after match ends 2:1 sets — LOSE',
    bet: {
      pick: WcOddsPick.AWAY,
      marketKey: 'h2h',
      outcomeKey: 'AWAY',
      outcomeName: '1X2: П2',
    },
    detail: vbDetail('25:21,19:25,21:24,15:25,10:25', { setsWon: [2, 1], status: 'EVENT_CLOSED', live: false }),
    homeSets: 2,
    awaySets: 1,
    expectEarly: null,
    expectFinal: WcOddsBetStatus.LOSE,
  },
  {
    name: 'match total UNDER busted in-play — early LOSE',
    bet: {
      marketKey: 'totals',
      outcomeKey: 'UNDER_180.5',
      line: '180.5',
      outcomeName: 'Тотал голов · 180.5 — Меньше',
    },
    detail: vbDetail('25:21,19:25,21:24,15:10,20:25', { setsWon: [1, 2] }),
    homeSets: 1,
    awaySets: 2,
    expectEarly: WcOddsBetStatus.LOSE,
  },
  {
    name: 'handicap uses sets won on volleyball',
    bet: {
      marketKey: 'handicap',
      outcomeKey: 'AWAY_HCP_1.5',
      line: '1.5',
      outcomeName: 'Фора: Ф2 (+1.5)',
    },
    detail: vbDetail('25:21,19:25,21:24', { setsWon: [1, 1] }),
    expectEarly: null,
  },
];

describe('volleyball bet simulator', () => {
  const failures: string[] = [];

  afterAll(() => {
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('\n=== VOLLEYBALL SIM FAILURES ===\n' + failures.join('\n'));
    }
  });

  it.each(SCENARIOS.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
    const { early, final } = runScenario(scenario);

    if (early !== scenario.expectEarly) {
      const msg = `[EARLY] ${scenario.name}: expected ${scenario.expectEarly}, got ${early}`;
      failures.push(msg);
      expect(early).toBe(scenario.expectEarly);
    }

    if (scenario.expectFinal !== undefined && final !== scenario.expectFinal) {
      const msg = `[FINAL] ${scenario.name}: expected ${scenario.expectFinal}, got ${final}`;
      failures.push(msg);
      expect(final).toBe(scenario.expectFinal);
    }
  });

  describe('infrastructure checks', () => {
    it('detects volleyball period scores', () => {
      expect(
        looksLikePointSetSportPeriods([
          { home: 25, away: 21 },
          { home: 19, away: 25 },
        ]),
      ).toBe(true);
    });

    it('does not finalize in-play set 3 when match_phase=7', () => {
      const detail = vbDetail('25:21,19:25,11:20', { matchPhase: '7' });
      expect(isMarketScopeFinalized(detail, { kind: 'set', index: 3 })).toBe(false);
    });

    it('finalizes set 3 when set 4 appears in feed', () => {
      const detail = vbDetail('25:21,19:25,21:24,5:3');
      expect(isMarketScopeFinalized(detail, { kind: 'set', index: 3 })).toBe(true);
    });

    it('match total uses all 3 sets (65:70)', () => {
      const detail = vbDetail('25:21,19:25,21:24');
      expect(extractRegulationScore(detail)).toEqual({ homeScore: 65, awayScore: 70 });
      expect(pickSettlementScores(detail, 1, 1, 'totals')).toEqual({ homeScore: 65, awayScore: 70 });
    });

    it('set scope parses from Russian label', () => {
      expect(parseMarketScopeFromText('3-й сет · Тотал геймов · 40.5')).toEqual({
        kind: 'set',
        index: 3,
      });
    });

    it('set-scoped pick uses set score not match aggregate', () => {
      const detail = vbDetail('25:21,19:25,21:24');
      const scoped = pickSettlementScores(
        detail,
        1,
        1,
        'totals',
        '3-й сет · Тотал геймов · 45.5',
      );
      expect(scoped).toEqual({ homeScore: 21, awayScore: 24 });
    });

    it('h2h uses sets won, not summed point totals', () => {
      const detail = vbDetail('25:21,19:25,21:24,15:25,10:25', {
        setsWon: [2, 1],
        status: 'EVENT_CLOSED',
        live: false,
      });
      expect(pickSettlementScores(detail, 2, 1, 'h2h', '1X2: П2')).toEqual({
        homeScore: 2,
        awayScore: 1,
      });
    });
  });
});
