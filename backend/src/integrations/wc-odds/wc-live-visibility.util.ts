import type { WcOddsEventDto } from './wc-odds.types';
import { wcEventHasLiveActivity, wcMaxLiveWindowMs } from './wc-live-play.util';

const KICKOFF_GRACE_MS = 45 * 60 * 1000;

export function isWcLiveListTerminal(
  event: Pick<WcOddsEventDto, 'completed' | 'phase' | 'commenceTime' | 'sport'>,
  nowMs: number = Date.now(),
): boolean {
  if (event.completed || event.phase === 'finished') return true;
  const kickoffMs = new Date(event.commenceTime).getTime();
  if (!Number.isFinite(kickoffMs)) return false;
  return nowMs - kickoffMs > wcMaxLiveWindowMs(event.sport);
}

export function isWcValidListOdd(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 1;
}

export function wcEventHasActiveListBets(event: Pick<
  WcOddsEventDto,
  | 'marketsCount'
  | 'oddsHome'
  | 'oddsDraw'
  | 'oddsAway'
  | 'odds1X'
  | 'odds12'
  | 'oddsX2'
  | 'oddsOver'
  | 'oddsUnder'
>): boolean {
  if ((event.marketsCount ?? 0) > 0) return true;
  return (
    isWcValidListOdd(event.oddsHome)
    || isWcValidListOdd(event.oddsDraw)
    || isWcValidListOdd(event.oddsAway)
    || isWcValidListOdd(event.odds1X)
    || isWcValidListOdd(event.odds12)
    || isWcValidListOdd(event.oddsX2)
    || isWcValidListOdd(event.oddsOver)
    || isWcValidListOdd(event.oddsUnder)
  );
}

/** Live list row: in-play now, not finished (markets may be briefly suspended at kickoff). */
export function isWcEventVisibleInLiveList(
  event: Pick<
    WcOddsEventDto,
    | 'completed'
    | 'phase'
    | 'commenceTime'
    | 'sport'
    | 'marketsCount'
    | 'oddsHome'
    | 'oddsDraw'
    | 'oddsAway'
    | 'odds1X'
    | 'odds12'
    | 'oddsX2'
    | 'oddsOver'
    | 'oddsUnder'
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

  // Keep matches with open list odds visible for the whole live window (0:0 can last 90+ min).
  if (wcEventHasActiveListBets(event)) return true;
  if (wcEventHasLiveActivity(event)) return true;

  return elapsed <= KICKOFF_GRACE_MS;
}

export function filterVisibleWcLiveListEvents(events: WcOddsEventDto[]): WcOddsEventDto[] {
  return events.filter((event) => isWcEventVisibleInLiveList(event));
}
