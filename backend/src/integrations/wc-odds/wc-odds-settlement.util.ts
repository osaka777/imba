import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import { isOlimpbetEventCompleted, extractOlimpbetScore } from '../olimpbet-wc/olimpbet-event-result.util';
import { pickSettlementScores, extractPeriodScore } from '../olimpbet-wc/olimpbet-score-scope.util';
import { isTennisGameFeed } from '../olimpbet-wc/point-set-sport-score.util';

import { isTennisGamePointsTotalsScope } from './tennis-totals-scope.util';
import type { WcMatchState } from './wc-match-state.types';
import type { WcBetPlacementContext } from './wc-bet-placement-context.util';
import { normalizeWcMarketKey, outcomeKeyToPick, isTotalsMarketKey } from './wc-odds-markets.util';
import { resolveTotalsScopeTotal, resolveVerifiedBetResult } from './wc-verified-settlement.util';

export type WcBetSettlementInput = {
  pick: WcOddsPick | null;
  marketKey: string;
  outcomeKey: string | null;
  line: string | null;
  outcomeName?: string | null;
  placementContext?: WcBetPlacementContext | null;
};

function winningPick(homeScore: number, awayScore: number): WcOddsPick {
  if (homeScore > awayScore) return WcOddsPick.HOME;
  if (homeScore < awayScore) return WcOddsPick.AWAY;
  return WcOddsPick.DRAW;
}

function resolveTotalsLine(bet: WcBetSettlementInput): number | null {
  const line = Number(bet.line ?? bet.outcomeKey?.replace(/^(OVER|UNDER)_/, ''));
  return Number.isFinite(line) ? line : null;
}

/** Score markets wait for final whistle unless the outcome is already guaranteed. */
function eventFinishedForSettlement(detail?: OlimpbetEventDetail): boolean {
  if (!detail) return true;
  return isOlimpbetEventCompleted(detail);
}

function settleOverUnderTotalInPlay(
  total: number,
  line: number,
  outcomeKey: string | null,
  detail?: OlimpbetEventDetail,
): WcOddsBetStatus | null {
  if (total === line) {
    return eventFinishedForSettlement(detail) ? WcOddsBetStatus.VOID : null;
  }

  const isOver = outcomeKey?.startsWith('OVER');
  const isUnder = outcomeKey?.startsWith('UNDER');
  const finished = eventFinishedForSettlement(detail);

  if (isOver) {
    if (total > line) return WcOddsBetStatus.WIN;
    return finished ? WcOddsBetStatus.LOSE : null;
  }
  if (isUnder) {
    if (total > line) return WcOddsBetStatus.LOSE;
    return finished ? WcOddsBetStatus.WIN : null;
  }

  return finished ? WcOddsBetStatus.LOSE : null;
}

function resolveHandicap3WayLine(bet: WcBetSettlementInput): number | null {
  const fromLine = Number(bet.line);
  if (Number.isFinite(fromLine)) return fromLine;

  const name = bet.outcomeName ?? '';
  const homeMatch = name.match(/(?:Ф1|П1|F1|P1)\s*\((-?[\d.]+)\)/i);
  if (homeMatch) {
    const value = Number(homeMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const awayMatch = name.match(/(?:Ф2|П2|F2|P2)\s*\((-?[\d.]+)\)/i);
  if (awayMatch) {
    const value = Number(awayMatch[1]);
    return Number.isFinite(value) ? -value : null;
  }

  const h3wMatch = bet.outcomeKey?.match(/^H3W_.*_(-?[\d.]+)$/);
  if (h3wMatch) {
    const value = Number(h3wMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function winningPickWithHandicap(
  homeScore: number,
  awayScore: number,
  handicap: number,
): WcOddsPick {
  const adjusted = homeScore + handicap - awayScore;
  if (adjusted > 0) return WcOddsPick.HOME;
  if (adjusted === 0) return WcOddsPick.DRAW;
  return WcOddsPick.AWAY;
}

function settleYesNo(yes: boolean, outcomeKey: string | null): WcOddsBetStatus | null {
  if (outcomeKey === 'YES') {
    return yes ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }
  if (outcomeKey === 'NO') {
    return yes ? WcOddsBetStatus.LOSE : WcOddsBetStatus.WIN;
  }
  return null;
}

function resolveHalfGoalsBet(
  bet: WcBetSettlementInput,
  detail: OlimpbetEventDetail | undefined,
  mode: 'goal_each_half' | 'both_teams_both_halves',
): WcOddsBetStatus | null {
  if (!eventFinishedForSettlement(detail)) return null;

  const firstHalf = extractPeriodScore(detail, { kind: 'half', index: 1 });
  const secondHalf = extractPeriodScore(detail, { kind: 'half', index: 2 });
  if (!firstHalf || !secondHalf) return null;

  const firstHalfGoals = firstHalf.homeScore + firstHalf.awayScore;
  const secondHalfGoals = secondHalf.homeScore + secondHalf.awayScore;

  const yes = mode === 'goal_each_half'
    ? firstHalfGoals > 0 && secondHalfGoals > 0
    : firstHalf.homeScore > 0
      && firstHalf.awayScore > 0
      && secondHalf.homeScore > 0
      && secondHalf.awayScore > 0;

  return settleYesNo(yes, bet.outcomeKey);
}

/** Pure bet result resolver — shared by settlement service and unit tests. */
export function resolveWcBetResult(
  bet: WcBetSettlementInput,
  homeScore: number,
  awayScore: number,
  detail?: OlimpbetEventDetail,
  matchState?: WcMatchState | null,
): WcOddsBetStatus | null {
  const scoped = pickSettlementScores(
    detail,
    homeScore,
    awayScore,
    bet.marketKey || 'h2h',
    bet.outcomeName,
  );
  homeScore = scoped.homeScore;
  awayScore = scoped.awayScore;

  const marketKey = normalizeWcMarketKey(bet.marketKey || 'h2h');

  if (marketKey === 'h2h') {
    if (!eventFinishedForSettlement(detail)) return null;
    if (
      detail
      && extractOlimpbetScore(detail).homeScore == null
      && extractOlimpbetScore(detail).awayScore == null
      && homeScore === 0
      && awayScore === 0
    ) {
      return null;
    }
    const winner = winningPick(homeScore, awayScore);
    const pick = bet.pick ?? outcomeKeyToPick(bet.outcomeKey || '');
    if (!pick) return WcOddsBetStatus.LOSE;
    return pick === winner ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (isTotalsMarketKey(marketKey)) {
    const line = resolveTotalsLine(bet);
    if (line == null) return WcOddsBetStatus.LOSE;

    const scopeHint = bet.placementContext?.totalsGroupLabel
      ?? bet.outcomeName
      ?? null;
    const scopedTotal = resolveTotalsScopeTotal(
      bet,
      { homeScore, awayScore, detail, matchState },
    );

    let scopeTotal: number;
    if (scopedTotal != null) {
      scopeTotal = scopedTotal;
    } else if (
      isTennisGameFeed(detail)
      && isTennisGamePointsTotalsScope(scopeHint)
    ) {
      return null;
    } else if (marketKey === 'totals_home') {
      scopeTotal = homeScore;
    } else if (marketKey === 'totals_away') {
      scopeTotal = awayScore;
    } else {
      scopeTotal = homeScore + awayScore;
    }

    return settleOverUnderTotalInPlay(scopeTotal, line, bet.outcomeKey, detail);
  }

  if (marketKey === 'even_odd') {
    if (!eventFinishedForSettlement(detail)) return null;
    const total = homeScore + awayScore;
    const isEvenScore = total % 2 === 0;
    if (bet.outcomeKey === 'EVEN') {
      return isEvenScore ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
    if (bet.outcomeKey === 'ODD') {
      return !isEvenScore ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
    return WcOddsBetStatus.LOSE;
  }

  if (marketKey === 'btts') {
    const bothScored = homeScore > 0 && awayScore > 0;
    if (bet.outcomeKey === 'YES') {
      return bothScored ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
    if (bet.outcomeKey === 'NO') {
      return !bothScored ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
  }

  if (marketKey === 'double_chance') {
    if (!eventFinishedForSettlement(detail)) return null;
    const winner = winningPick(homeScore, awayScore);
    const key = bet.outcomeKey || '';
    if (key === 'DC_1X') {
      return winner === WcOddsPick.HOME || winner === WcOddsPick.DRAW
        ? WcOddsBetStatus.WIN
        : WcOddsBetStatus.LOSE;
    }
    if (key === 'DC_12') {
      return winner === WcOddsPick.HOME || winner === WcOddsPick.AWAY
        ? WcOddsBetStatus.WIN
        : WcOddsBetStatus.LOSE;
    }
    if (key === 'DC_X2') {
      return winner === WcOddsPick.DRAW || winner === WcOddsPick.AWAY
        ? WcOddsBetStatus.WIN
        : WcOddsBetStatus.LOSE;
    }
  }

  if (marketKey === 'handicap') {
    const match = bet.outcomeKey?.match(/^(HOME|AWAY)_HCP_(-?[\d.]+)$/);
    if (!match) return WcOddsBetStatus.LOSE;
    const side = match[1];
    const hcp = Number(match[2]);
    if (!Number.isFinite(hcp)) return WcOddsBetStatus.LOSE;

    const diff =
      side === 'HOME'
        ? homeScore + hcp - awayScore
        : awayScore + hcp - homeScore;

    if (diff === 0 && Number.isInteger(hcp * 2)) {
      return WcOddsBetStatus.VOID;
    }
    return diff > 0 ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (marketKey === 'handicap_3way') {
    if (!eventFinishedForSettlement(detail)) return null;
    const pick = bet.pick ?? outcomeKeyToPick(bet.outcomeKey || '');
    const handicap = resolveHandicap3WayLine(bet);
    if (!pick || handicap == null) {
      if (bet.outcomeKey?.startsWith('DISPLAY_') || bet.outcomeKey?.startsWith('H3W_')) {
        return resolveVerifiedBetResult(bet, { homeScore, awayScore, detail, matchState });
      }
      return WcOddsBetStatus.LOSE;
    }
    const winner = winningPickWithHandicap(homeScore, awayScore, handicap);
    return pick === winner ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (marketKey === 'goals_both_half') {
    return resolveHalfGoalsBet(bet, detail, 'goal_each_half');
  }

  if (marketKey === 'goals_both_teams_both_halves') {
    return resolveHalfGoalsBet(bet, detail, 'both_teams_both_halves');
  }

  if (marketKey === 'goals_both_min') {
    const bothScored = homeScore > 0 && awayScore > 0;
    if (bet.outcomeKey === 'YES') {
      return bothScored ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
    if (bet.outcomeKey === 'NO') {
      return !bothScored ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
  }

  if (bet.outcomeKey?.startsWith('DISPLAY_') || bet.marketKey.startsWith('display_')) {
    return resolveVerifiedBetResult(bet, { homeScore, awayScore, detail, matchState });
  }

  return WcOddsBetStatus.LOSE;
}
