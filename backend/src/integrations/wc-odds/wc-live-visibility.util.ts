import type { WcOddsEventDto } from './wc-odds.types';
import { isWcEventActuallyInPlay, wcEventHasLiveActivity } from './wc-live-play.util';

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
  if (!isWcEventActuallyInPlay(event, nowMs)) return false;

  if (wcEventHasActiveListBets(event)) return true;
  if (wcEventHasLiveActivity(event)) return true;

  const kickoffMs = new Date(event.commenceTime).getTime();
  if (!Number.isFinite(kickoffMs) || kickoffMs > nowMs) return false;
  return nowMs - kickoffMs <= 45 * 60 * 1000;
}

export function filterVisibleWcLiveListEvents(events: WcOddsEventDto[]): WcOddsEventDto[] {
  return events.filter((event) => isWcEventVisibleInLiveList(event));
}
