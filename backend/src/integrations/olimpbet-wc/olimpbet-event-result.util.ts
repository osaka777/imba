import type { OlimpbetEventDetail } from './olimpbet-wc.types';
import {
  extractRegulationScore,
  parsePeriodScoreList,
} from './olimpbet-score-scope.util';

export type OlimpbetEventResult = {
  homeScore: number;
  awayScore: number;
  cancelled: boolean;
};

const FINISHED_STATUS_MARKERS = [
  'EVENT_CLOSED',
  'EVENT_FINISHED',
  'EVENT_ENDED',
  'EVENT_RESULTED',
  'EVENT_COMPLETE',
];

const CANCELLED_STATUS_MARKERS = [
  'CANCEL',
  'ABANDON',
  'POSTPON',
  'RETIRE',
  'WALKOVER',
  'DEFAULT',
];

const LIVE_ACTIVE_STATUS_MARKERS = [
  'EVENT_TRADING',
  'EVENT_SUSPENDED',
  'EVENT_INTERRUPTED',
];

/**
 * Sportradar match_status / Olimpbet match_phase → refund (VOID) all unsettled bets.
 * Tennis: walkover / retired / defaulted; also abandoned / cancelled.
 * @see https://docs.sportradar.com/live-data/.../tennis
 */
const REFUND_MATCH_PHASES = new Set([
  '70',  // CANCELLED
  '90',  // ABANDONED
  '93',  // WALKOVER1 (home wins by walkover / away withdrew)
  '94',  // WALKOVER2
  '95',  // RETIRED1 (home retired → away wins)
  '96',  // RETIRED2
  '97',  // DEFAULTED1
  '98',  // DEFAULTED2
]);

/** Sportradar-style phase codes for ended matches (incl. refund endings). */
const FINISHED_MATCH_PHASES = new Set([
  '100', '110', '120', '130',
  ...REFUND_MATCH_PHASES,
]);

export function statValue(
  detail: Pick<OlimpbetEventDetail, 'statistics'>,
  code: string,
): string | null {
  const row = (detail.statistics ?? []).find((s) => s.code === code);
  const value = row?.value;
  return value != null && String(value).trim() !== '' ? String(value).trim() : null;
}

export function parseScorePair(raw: string | null | undefined): { home: number; away: number } | null {
  if (!raw) return null;

  const normalized = String(raw).trim().replace(',', '.');
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*[:-]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const home = Number(match[1]);
  const away = Number(match[2]);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;

  return { home, away };
}

export function extractOlimpbetScore(
  detail: Pick<OlimpbetEventDetail, 'score' | 'statistics' | 'fullStatistics'>,
): { homeScore: number | null; awayScore: number | null } {
  const fromObject = detail.score;
  if (fromObject?.home != null && fromObject?.away != null) {
    const home = Number(fromObject.home);
    const away = Number(fromObject.away);
    if (Number.isFinite(home) && Number.isFinite(away)) {
      return { homeScore: home, awayScore: away };
    }
  }

  const fromStats = parseScorePair(statValue(detail, 'score'));
  if (fromStats) {
    return { homeScore: fromStats.home, awayScore: fromStats.away };
  }

  const home = Number(detail.fullStatistics?.homeStatistics?.score);
  const away = Number(detail.fullStatistics?.awayStatistics?.score);
  if (Number.isFinite(home) && Number.isFinite(away)) {
    return { homeScore: home, awayScore: away };
  }

  return { homeScore: null, awayScore: null };
}

/** Best-effort final score for settlement when primary feed fields are missing. */
export function resolveSettlementScoreFromDetail(
  detail: Pick<OlimpbetEventDetail, 'score' | 'statistics'>,
  fallbackHome?: number | null,
  fallbackAway?: number | null,
): { homeScore: number; awayScore: number } | null {
  const direct = extractOlimpbetScore(detail);
  if (direct.homeScore != null && direct.awayScore != null) {
    return { homeScore: direct.homeScore, awayScore: direct.awayScore };
  }

  const regulation = extractRegulationScore(detail as OlimpbetEventDetail);
  if (regulation) return regulation;

  const periods = parsePeriodScoreList(detail as OlimpbetEventDetail);
  if (periods.length > 0) {
    let home = 0;
    let away = 0;
    for (const period of periods) {
      home += period.home;
      away += period.away;
    }
    return { homeScore: home, awayScore: away };
  }

  if (fallbackHome != null && fallbackAway != null) {
    return { homeScore: fallbackHome, awayScore: fallbackAway };
  }

  return null;
}

function hasOpenTradingMarkets(detail: OlimpbetEventDetail): boolean {
  for (const market of detail.probabilities?.markets ?? []) {
    for (const prob of market.probabilities ?? []) {
      if (prob.suspended) continue;
      if (prob.tradingStatus === 'PROBABILITY_TRADING' && prob.odd > 1.05) {
        return true;
      }
    }
  }
  return false;
}

function hasAnyProbabilityOutcomes(detail: OlimpbetEventDetail): boolean {
  for (const market of detail.probabilities?.markets ?? []) {
    if ((market.probabilities ?? []).length > 0) return true;
  }
  return false;
}

/** Live feed zombie: book removed outcomes after the match — not during VAR/halftime pauses. */
function isOlimpbetLiveFeedEffectivelyClosed(detail: OlimpbetEventDetail): boolean {
  if (!detail.live) return false;
  if (hasOpenTradingMarkets(detail)) return false;

  const { homeScore, awayScore } = extractOlimpbetScore(detail);
  if (homeScore == null || awayScore == null) return false;

  const matchPhase = statValue(detail, 'match_phase');
  if (!matchPhase || !FINISHED_MATCH_PHASES.has(matchPhase)) {
    return false;
  }

  const marketShells = detail.probabilities?.markets?.length ?? 0;
  if (marketShells === 0) return true;

  return !hasAnyProbabilityOutcomes(detail);
}

/** Whether Olimpbet still accepts bets (may be false before status flips to EVENT_ENDED). */
export function isOlimpbetFeedBettingOpen(
  detail: OlimpbetEventDetail,
  nowMs: number = Date.now(),
): boolean {
  if (isOlimpbetEventCompleted(detail, nowMs)) return false;

  const status = (detail.status ?? '').toUpperCase();
  if (FINISHED_STATUS_MARKERS.some((marker) => status.includes(marker))) return false;

  if (!hasOpenTradingMarkets(detail)) {
    if (hasAnyProbabilityOutcomes(detail)) return false;
    const kickoffMs = Date.parse(detail.eventDate);
    const started = Number.isFinite(kickoffMs) && kickoffMs <= nowMs;
    if (started) return false;
  }

  return true;
}

export function isOlimpbetEventCancelled(
  detail: Pick<OlimpbetEventDetail, 'status' | 'statistics'>,
): boolean {
  const status = (detail.status ?? '').toUpperCase();
  if (CANCELLED_STATUS_MARKERS.some((marker) => status.includes(marker))) {
    return true;
  }

  const matchPhase = statValue(detail, 'match_phase');
  return Boolean(matchPhase && REFUND_MATCH_PHASES.has(matchPhase));
}

export function isOlimpbetEventCompleted(
  detail: OlimpbetEventDetail,
  nowMs: number = Date.now(),
): boolean {
  if (isOlimpbetEventCancelled(detail)) return true;

  const matchPhase = statValue(detail, 'match_phase');
  const status = (detail.status ?? '').toUpperCase();
  const finishedStatus = FINISHED_STATUS_MARKERS.some((marker) =>
    status.includes(marker),
  );

  // Olimpbet often flashes EVENT_ENDED at FT→ET / brief glitches while
  // `live` is still true and Sportradar match_phase is not finished. Treating
  // that as completed makes the UI show «Окончена» and then reopen live.
  if (finishedStatus) {
    if (!detail.live) return true;
    if (matchPhase && FINISHED_MATCH_PHASES.has(matchPhase)) return true;
    // Still live without a finished phase — fall through to zombie / age checks.
  } else if (matchPhase && FINISHED_MATCH_PHASES.has(matchPhase)) {
    return true;
  }

  const kickoffMs = Date.parse(detail.eventDate);
  const hoursSinceKickoff = Number.isFinite(kickoffMs) && kickoffMs <= nowMs
    ? (nowMs - kickoffMs) / 3_600_000
    : null;

  if (
    detail.live
    && hoursSinceKickoff != null
    && hoursSinceKickoff >= 2.5
    && !hasOpenTradingMarkets(detail)
  ) {
    return true;
  }

  if (isOlimpbetLiveFeedEffectivelyClosed(detail)) {
    return true;
  }

  if (detail.live) return false;

  if (
    !detail.live
    && hoursSinceKickoff != null
    && hoursSinceKickoff >= 1.5
    && !hasOpenTradingMarkets(detail)
  ) {
    return true;
  }

  const { homeScore, awayScore } = extractOlimpbetScore(detail);
  if (homeScore == null || awayScore == null) return false;

  if (!Number.isFinite(kickoffMs) || kickoffMs > nowMs) return false;

  if (
    !LIVE_ACTIVE_STATUS_MARKERS.some((marker) => status.includes(marker))
    && status !== 'EVENT_OPEN'
    && status !== 'EVENT_PLANNING'
    && hoursSinceKickoff != null
    && hoursSinceKickoff >= 1.5
  ) {
    return true;
  }

  if (hoursSinceKickoff != null && hoursSinceKickoff >= 2.5 && !hasOpenTradingMarkets(detail)) {
    return true;
  }

  return false;
}

export function resolveOlimpbetEventResult(
  detail: OlimpbetEventDetail,
  nowMs: number = Date.now(),
): OlimpbetEventResult | null {
  if (!isOlimpbetEventCompleted(detail, nowMs)) return null;

  if (isOlimpbetEventCancelled(detail)) {
    return { homeScore: 0, awayScore: 0, cancelled: true };
  }

  const resolved = resolveSettlementScoreFromDetail(detail);
  if (!resolved) return null;

  return { homeScore: resolved.homeScore, awayScore: resolved.awayScore, cancelled: false };
}
