import type { OlimpbetEventDetail } from './olimpbet-wc.types';

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
];

const LIVE_ACTIVE_STATUS_MARKERS = [
  'EVENT_TRADING',
  'EVENT_SUSPENDED',
  'EVENT_INTERRUPTED',
];

/** Sportradar-style phase codes for ended matches. */
const FINISHED_MATCH_PHASES = new Set(['100', '110', '120', '130']);

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
  detail: Pick<OlimpbetEventDetail, 'score' | 'statistics'>,
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

  return { homeScore: null, awayScore: null };
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

  const kickoffMs = Date.parse(detail.eventDate);
  const started = Number.isFinite(kickoffMs) && kickoffMs <= nowMs;

  if (started && !hasOpenTradingMarkets(detail)) {
    return false;
  }

  return true;
}

export function isOlimpbetEventCancelled(detail: Pick<OlimpbetEventDetail, 'status'>): boolean {
  const status = (detail.status ?? '').toUpperCase();
  return CANCELLED_STATUS_MARKERS.some((marker) => status.includes(marker));
}

export function isOlimpbetEventCompleted(
  detail: OlimpbetEventDetail,
  nowMs: number = Date.now(),
): boolean {
  if (isOlimpbetEventCancelled(detail)) return true;

  const status = (detail.status ?? '').toUpperCase();
  if (FINISHED_STATUS_MARKERS.some((marker) => status.includes(marker))) {
    return true;
  }

  const matchPhase = statValue(detail, 'match_phase');
  if (matchPhase && FINISHED_MATCH_PHASES.has(matchPhase)) {
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

  const { homeScore, awayScore } = extractOlimpbetScore(detail);
  if (homeScore == null || awayScore == null) return null;

  return { homeScore, awayScore, cancelled: false };
}
