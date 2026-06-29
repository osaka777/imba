#!/usr/bin/env node
/**
 * Standalone volleyball bet simulator (uses compiled dist).
 * Run from repo: node scripts/volleyball-bet-sim.mjs
 * In container: node /app/scripts/volleyball-bet-sim.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

const { WcOddsBetStatus, WcOddsPick } = require('@prisma/client');
const scopeUtil = require(join(root, 'dist/src/integrations/olimpbet-wc/olimpbet-score-scope.util.js'));
const { resolveWcBetResult } = require(join(root, 'dist/src/integrations/wc-odds/wc-odds-settlement.util.js'));
const { resolveDeterminateBetResult } = require(join(root, 'dist/src/integrations/wc-odds/wc-verified-settlement.util.js'));
const { emptyMatchState } = require(join(root, 'dist/src/integrations/wc-odds/wc-match-state.types.js'));

function vbDetail(scoresByPeriods, opts = {}) {
  const stats = [{ code: 'scores_by_periods', value: scoresByPeriods }];
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
  };
}

const SCENARIOS = [
  {
    name: 'set3 UNDER 40.5 in-play — pending',
    bet: {
      marketKey: 'totals', outcomeKey: 'UNDER_40.5', line: '40.5',
      outcomeName: '3-й сет · Тотал геймов · 40.5 — Меньше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 40.5' },
    },
    detail: vbDetail('25:21,19:25,11:20', { matchPhase: '7' }),
    expectEarly: null,
  },
  {
    name: 'set3 OVER 44.5 after set ends 21:24 — WIN',
    bet: {
      marketKey: 'totals', outcomeKey: 'OVER_44.5', line: '44.5',
      outcomeName: '3-й сет · Тотал геймов · 44.5 — Больше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 44.5' },
    },
    detail: vbDetail('25:21,19:25,21:24,3:2'),
    expectEarly: WcOddsBetStatus.WIN,
  },
  {
    name: 'set3 UNDER 45.5 at 22:24 in-play — LOSE',
    bet: {
      marketKey: 'totals', outcomeKey: 'UNDER_45.5', line: '45.5',
      outcomeName: '3-й сет · Тотал геймов · 45.5 — Меньше',
      placementContext: { totalsGroupLabel: '3-й сет · Тотал геймов · 45.5' },
    },
    detail: vbDetail('25:21,19:25,22:24', { matchPhase: '7' }),
    expectEarly: WcOddsBetStatus.LOSE,
  },
  {
    name: 'match total 3 sets = 135 pts (not 90)',
    bet: {
      marketKey: 'totals', outcomeKey: 'OVER_130.5', line: '130.5',
      outcomeName: 'Тотал голов · 130.5 — Больше',
    },
    detail: vbDetail('25:21,19:25,21:24'),
    expectEarly: null,
    expectFinal: WcOddsBetStatus.WIN,
  },
  {
    name: 'h2h AWAY in-play — pending',
    bet: {
      pick: WcOddsPick.AWAY, marketKey: 'h2h', outcomeKey: 'AWAY', outcomeName: '1X2: П2',
    },
    detail: vbDetail('25:21,19:25,21:24,5:3'),
    expectEarly: null,
  },
  {
    name: 'scope finalized: match_phase=7 must not close set 3',
    infra: true,
    check: () => !scopeUtil.isMarketScopeFinalized(
      vbDetail('25:21,19:25,11:20', { matchPhase: '7' }),
      { kind: 'set', index: 3 },
    ),
  },
  {
    name: 'extractRegulationScore sums all volleyball sets',
    infra: true,
    check: () => {
      const r = scopeUtil.extractRegulationScore(vbDetail('25:21,19:25,21:24'));
      return r?.homeScore === 65 && r?.awayScore === 70;
    },
  },
];

let passed = 0;
let failed = 0;
const errors = [];

for (const s of SCENARIOS) {
  if (s.infra) {
    const ok = s.check();
    if (ok) {
      passed += 1;
      console.log(`  ✓ ${s.name}`);
    } else {
      failed += 1;
      errors.push(`  ✗ ${s.name}`);
      console.log(`  ✗ ${s.name}`);
    }
    continue;
  }

  const state = emptyMatchState();
  const bet = { pick: s.bet.pick ?? null, ...s.bet, line: s.bet.line ?? null };
  const early = resolveDeterminateBetResult(bet, 1, 1, s.detail, state);
  const finalDetail = { ...s.detail, live: false, status: 'EVENT_CLOSED' };
  const final = s.expectFinal !== undefined
    ? resolveWcBetResult(bet, s.detail.score?.home ?? 1, s.detail.score?.away ?? 1, finalDetail, state)
    : null;

  let ok = early === s.expectEarly;
  if (ok && s.expectFinal !== undefined) ok = final === s.expectFinal;

  if (ok) {
    passed += 1;
    console.log(`  ✓ ${s.name}`);
  } else {
    failed += 1;
    const parts = [`  ✗ ${s.name}`];
    if (early !== s.expectEarly) parts.push(`    early: expected ${s.expectEarly}, got ${early}`);
    if (s.expectFinal !== undefined && final !== s.expectFinal) {
      parts.push(`    final: expected ${s.expectFinal}, got ${final}`);
    }
    errors.push(parts.join('\n'));
    console.log(parts.join('\n'));
  }
}

console.log(`\n=== Volleyball bet sim: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
