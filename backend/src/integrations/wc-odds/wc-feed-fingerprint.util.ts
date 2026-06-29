import type { WcOddsEventDetailDto, WcOddsEventDto } from './wc-odds.types';

/** Compact fingerprint for list-row WS dedup (avoids JSON.stringify on large stat payloads). */
export function fingerprintWcListEvent(event: WcOddsEventDto): string {
  const scoreText = event.parsedScore?.text?.currentScore ?? '';
  const clockSec = event.parsedScore?.seconds ?? '';
  return [
    event.oddsHome,
    event.oddsDraw,
    event.oddsAway,
    event.odds1X,
    event.odds12,
    event.oddsX2,
    event.oddsOver,
    event.oddsUnder,
    event.totalLine,
    event.marketsCount,
    event.homeScore,
    event.awayScore,
    scoreText,
    clockSec,
    event.completed,
    event.phase,
    event.priorityLevel,
    event.hasBroadcast,
  ].join('|');
}

export function fingerprintWcListCache(events: WcOddsEventDto[]): string {
  return events.map((event) => `${event.id}:${fingerprintWcListEvent(event)}`).join(';');
}

export function fingerprintWcEventDetail(detail: WcOddsEventDetailDto): string {
  return `${fingerprintWcListEvent(detail)}:${detail.groupedMarkets ? Object.keys(detail.groupedMarkets).length : 0}`;
}
