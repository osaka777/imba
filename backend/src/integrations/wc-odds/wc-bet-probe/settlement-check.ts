import { WcOddsBetStatus } from '@prisma/client';

import {
  isMarketScopeFinalized,
  parseMarketScopeFromText,
} from '../../olimpbet-wc/olimpbet-score-scope.util';
import { isPointSetSportFeed } from '../../olimpbet-wc/point-set-sport-score.util';
import { isTotalsMarketKey, normalizeWcMarketKey } from '../wc-odds-markets.util';
import { emptyMatchState } from '../wc-match-state.types';
import type { WcBetPlacementContext } from '../wc-bet-placement-context.util';
import { resolveDeterminateBetResult } from '../wc-verified-settlement.util';

function isWinAndTotalMarketKey(marketKey: string): boolean {
  const stem = marketKey.replace(/^display_/i, '');
  return /^(?:WIN[12X]*_AND_TOTAL|X2_AND_TOTAL|DRAW_AND_TOTAL)/i.test(stem);
}

import { buildOlimpbetDetailFromPublicEvent } from './detail-from-event';
import type { WcBetProbeCandidate, WcBetProbeEventDetail, WcBetProbeFinding } from './types';

function scopeLabelForCandidate(candidate: WcBetProbeCandidate): string | null {
  if (candidate.totalsGroupLabel && parseMarketScopeFromText(candidate.totalsGroupLabel)) {
    return candidate.totalsGroupLabel;
  }
  if (candidate.outcomeName && parseMarketScopeFromText(candidate.outcomeName)) {
    return candidate.outcomeName;
  }
  return candidate.totalsGroupLabel ?? candidate.groupLabel ?? null;
}

export function expectedEarlySettlement(
  event: WcBetProbeEventDetail,
  candidate: WcBetProbeCandidate,
): WcOddsBetStatus | null {
  const detail = buildOlimpbetDetailFromPublicEvent(event);
  const home = event.homeScore ?? 0;
  const away = event.awayScore ?? 0;

  return resolveDeterminateBetResult(
    {
      pick: null,
      marketKey: candidate.marketKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
      outcomeName: candidate.outcomeName,
      placementContext: candidate.totalsGroupLabel
        ? ({ totalsGroupLabel: candidate.totalsGroupLabel } as WcBetPlacementContext)
        : null,
    },
    home,
    away,
    detail,
    emptyMatchState(),
  );
}

export function validateSettlementLogic(
  event: WcBetProbeEventDetail,
  candidate: WcBetProbeCandidate,
): WcBetProbeFinding[] {
  const findings: WcBetProbeFinding[] = [];
  const detail = buildOlimpbetDetailFromPublicEvent(event);
  const marketKey = normalizeWcMarketKey(candidate.marketKey);
  const expected = expectedEarlySettlement(event, candidate);
  const scopeLabel = scopeLabelForCandidate(candidate);
  const scope = scopeLabel ? parseMarketScopeFromText(scopeLabel) : null;
  const scopeFinalized = scope ? isMarketScopeFinalized(detail, scope) : null;

  if (
    (isTotalsMarketKey(marketKey) || isWinAndTotalMarketKey(candidate.marketKey))
    && scope?.kind === 'set'
    && isPointSetSportFeed(detail)
    && scopeFinalized === false
    && expected != null
    && event.phase === 'live'
    && !event.completed
  ) {
    findings.push({
      severity: 'error',
      code: 'set_total_premature_settlement',
      message:
        `Set total would settle as ${expected} while set ${scope.index} is still in play (scope not finalized).`,
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      marketKey: candidate.marketKey,
      groupKey: candidate.groupKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
      expected,
      meta: { scopeLabel, scopeFinalized, groupLabel: candidate.groupLabel },
    });
  }

  if (
    (isTotalsMarketKey(marketKey) || isWinAndTotalMarketKey(candidate.marketKey))
    && scope?.kind === 'set'
    && isPointSetSportFeed(detail)
    && scopeFinalized === false
    && expected == null
  ) {
    findings.push({
      severity: 'info',
      code: 'set_total_correctly_pending',
      message: `Set total correctly stays pending during live set ${scope.index}.`,
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      marketKey: candidate.marketKey,
      groupKey: candidate.groupKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
      meta: { scopeLabel },
    });
  }

  if (expected != null && !event.completed && event.phase === 'live') {
    findings.push({
      severity: 'info',
      code: 'early_settlement_available',
      message: `In-play early settlement would be ${expected} for ${candidate.outcomeName}.`,
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      marketKey: candidate.marketKey,
      groupKey: candidate.groupKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
      expected,
    });
  }

  return findings;
}

export function comparePlacedBetSettlement(
  event: WcBetProbeEventDetail,
  candidate: WcBetProbeCandidate,
  actual: WcOddsBetStatus,
  placedAtMs: number,
  observedAtMs: number,
  instantThresholdMs: number,
): WcBetProbeFinding[] {
  const findings: WcBetProbeFinding[] = [];
  const expected = expectedEarlySettlement(event, candidate);
  const elapsed = observedAtMs - placedAtMs;
  const isTerminal = actual === WcOddsBetStatus.WIN || actual === WcOddsBetStatus.LOSE;

  if (isTerminal && expected == null && elapsed < instantThresholdMs && event.phase === 'live') {
    findings.push({
      severity: 'error',
      code: 'instant_settlement_while_pending_expected',
      message:
        `Bet settled as ${actual} in ${elapsed}ms but logic expects PENDING during live play.`,
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      marketKey: candidate.marketKey,
      groupKey: candidate.groupKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
      expected,
      actual,
      meta: { elapsedMs: elapsed },
    });
  }

  if (isTerminal && expected != null && actual !== expected) {
    findings.push({
      severity: 'error',
      code: 'settlement_mismatch',
      message: `Bet settled as ${actual} but expected ${expected}.`,
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      marketKey: candidate.marketKey,
      groupKey: candidate.groupKey,
      outcomeKey: candidate.outcome.outcomeKey,
      line: candidate.line,
      expected,
      actual,
    });
  }

  return findings;
}
