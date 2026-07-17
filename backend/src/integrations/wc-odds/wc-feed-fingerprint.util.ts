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
    event.bettingOpen,
    event.feedStatus ?? '',
    event.priorityLevel,
    event.hasBroadcast,
  ].join('|');
}

export function fingerprintWcListCache(events: WcOddsEventDto[]): string {
  return events.map((event) => `${event.id}:${fingerprintWcListEvent(event)}`).join(';');
}

/** Compact price sample so WS dedup notices grouped-market moves, not only scalar 1X2. */
function fingerprintGroupedMarketPrices(detail: WcOddsEventDetailDto): string {
  const grouped = detail.groupedMarkets;
  if (!grouped) return '0';
  const parts: string[] = [String(Object.keys(grouped).length)];
  for (const groups of Object.values(grouped)) {
    for (const group of groups) {
      for (const outcome of group.outcomes) {
        parts.push(`${group.key}:${outcome.outcomeKey}:${outcome.price}:${outcome.suspended ? 1 : 0}`);
      }
    }
  }
  return parts.join(',');
}

export function fingerprintWcEventDetail(detail: WcOddsEventDetailDto): string {
  return `${fingerprintWcListEvent(detail)}:${fingerprintGroupedMarketPrices(detail)}`;
}
