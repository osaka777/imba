import type { WcOddsEventDto } from './wc-odds.types';

const KICKOFF_GRACE_MS = 45 * 60 * 1000;

const LIVE_WINDOW_MS: Record<string, number> = {
  soccer: 2.5 * 3_600_000,
  hockey: 3 * 3_600_000,
  basketball: 3 * 3_600_000,
  tennis: 6 * 3_600_000,
  'table-tennis': 4 * 3_600_000,
  volleyball: 4 * 3_600_000,
};

const DEFAULT_LIVE_WINDOW_MS = 3 * 3_600_000;

export function wcMaxLiveWindowMs(sport: string): number {
  return LIVE_WINDOW_MS[sport] ?? DEFAULT_LIVE_WINDOW_MS;
}

type WcLiveActivityEvent = Pick<
  WcOddsEventDto,
  | 'parsedScore'
  | 'homeScore'
  | 'awayScore'
  | 'statList'
>;

export function wcEventHasLiveActivity(event: WcLiveActivityEvent): boolean {
  if (event.parsedScore?.seconds != null && event.parsedScore.seconds > 0) return true;
  if (event.parsedScore?.text?.time) return true;
  if ((event.statList?.length ?? 0) > 0) return true;
  if (event.homeScore != null && event.awayScore != null) {
    if (event.parsedScore) return true;
    if (event.homeScore !== 0 || event.awayScore !== 0) return true;
  }
  return false;
}

/** True only when the match is in play right now (not a stale past kickoff with prematch odds). */
export function isWcEventActuallyInPlay(
  event: Pick<
    WcOddsEventDto,
    | 'sport'
    | 'phase'
    | 'completed'
    | 'commenceTime'
    | 'parsedScore'
    | 'homeScore'
    | 'awayScore'
    | 'statList'
  >,
  nowMs: number = Date.now(),
): boolean {
  if (event.completed || event.phase === 'finished') return false;
  if (event.phase !== 'live') return false;

  const kickoffMs = new Date(event.commenceTime).getTime();
  if (!Number.isFinite(kickoffMs) || kickoffMs > nowMs) return false;

  const elapsed = nowMs - kickoffMs;
  if (elapsed > wcMaxLiveWindowMs(event.sport)) return false;

  if (wcEventHasLiveActivity(event)) return true;

  return elapsed <= KICKOFF_GRACE_MS;
}
