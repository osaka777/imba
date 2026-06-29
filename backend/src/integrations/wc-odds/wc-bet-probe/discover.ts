import type { WcBetProbeConfig } from './config';
import { probeFetchJson } from './http';
import type { WcBetProbeEventDetail, WcBetProbeListEvent } from './types';

async function fetchEventList(
  config: WcBetProbeConfig,
  path: string,
): Promise<WcBetProbeListEvent[]> {
  try {
    return await probeFetchJson<WcBetProbeListEvent[]>(config, path);
  } catch {
    return [];
  }
}

function rankEvent(event: WcBetProbeListEvent): number {
  let score = event.marketsCount ?? 0;
  if (event.phase === 'live') score += 1000;
  if (event.bettingOpen !== false) score += 100;
  return score;
}

export async function discoverEventSlugs(config: WcBetProbeConfig): Promise<string[]> {
  if (config.eventSlug) return [config.eventSlug];

  const sport = config.sport.trim().toLowerCase();
  const sportParam = encodeURIComponent(sport);
  const sources = sport && sport !== 'all'
    ? [
        `/api/feed/live/events?sport=${sportParam}&limit=40`,
        `/api/feed/line/events?sport=${sportParam}&limit=40`,
      ]
    : [
        '/api/feed/live/events?limit=40',
        '/api/feed/line/events?limit=40',
      ];

  const seen = new Set<string>();
  const ranked: WcBetProbeListEvent[] = [];

  for (const path of sources) {
    const events = await fetchEventList(config, path);
    for (const event of events) {
      if (!event.slug || seen.has(event.slug)) continue;
      if ((event.marketsCount ?? 0) < config.minMarkets) continue;
      if (sport && sport !== 'all' && event.sport && event.sport !== sport) continue;
      seen.add(event.slug);
      ranked.push(event);
    }
  }

  ranked.sort((a, b) => rankEvent(b) - rankEvent(a));
  return ranked.slice(0, config.maxEvents).map((e) => e.slug);
}

export async function loadEventDetail(
  config: WcBetProbeConfig,
  slug: string,
): Promise<WcBetProbeEventDetail> {
  return probeFetchJson<WcBetProbeEventDetail>(
    config,
    `/api/feed/events/${encodeURIComponent(slug)}`,
  );
}
