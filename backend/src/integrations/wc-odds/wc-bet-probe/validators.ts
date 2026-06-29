import { validateGroupedMarketsForSmoke } from '../wc-markets-smoke.util';

import { collectBettableOutcomes, findVisibleButNotBettable } from './collect-outcomes';
import type { WcBetProbeEventDetail, WcBetProbeFinding } from './types';

export function validateEventStructure(event: WcBetProbeEventDetail): WcBetProbeFinding[] {
  const findings: WcBetProbeFinding[] = [];
  const grouped = event.groupedMarkets ?? {};
  const smoke = validateGroupedMarketsForSmoke(grouped);

  if (!smoke.ok) {
    for (const issue of smoke.issues) {
      findings.push({
        severity: 'error',
        code: `smoke_${issue.code}`,
        message: issue.message,
        eventId: event.id,
        slug: event.slug,
        sport: event.sport,
        meta: {
          category: issue.category,
          groupKey: issue.groupKey,
          stats: smoke.stats,
        },
      });
    }
  }

  if ((event.marketsCount ?? 0) < 1 && collectBettableOutcomes(grouped, { bettingOpen: true, maxOutcomes: 1 }).length === 0) {
    findings.push({
      severity: 'warning',
      code: 'no_markets',
      message: 'Event has no bettable markets for user flow.',
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
    });
  }

  for (const row of findVisibleButNotBettable(grouped)) {
    findings.push({
      severity: 'info',
      code: 'priced_not_bettable',
      message: `Outcome ${row.outcomeKey} shows price ${row.price} but is not bettable by backend rules.`,
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      marketKey: row.marketKey,
      groupKey: row.groupKey,
      outcomeKey: row.outcomeKey,
    });
  }

  if (!event.bettingOpen && event.phase === 'live' && !event.completed) {
    findings.push({
      severity: 'warning',
      code: 'live_but_betting_closed',
      message: 'Live event flagged bettingOpen=false while not completed.',
      eventId: event.id,
      slug: event.slug,
      sport: event.sport,
      meta: { feedStatus: event.feedStatus },
    });
  }

  return findings;
}
