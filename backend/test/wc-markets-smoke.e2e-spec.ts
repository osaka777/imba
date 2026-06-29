import {
  validateGroupedMarketsForSmoke,
  type WcMarketsSmokeResult,
} from '../src/integrations/wc-odds/wc-markets-smoke.util';
import type { WcGroupedMarkets } from '../src/integrations/wc-odds/wc-odds-markets.util';

const SMOKE_SKIP = process.env.WC_SMOKE_SKIP === '1';
const BASE_URL = (process.env.WC_SMOKE_BASE_URL || 'https://imba.bet').replace(/\/$/, '');
const FIXED_SLUG = process.env.WC_SMOKE_EVENT_SLUG?.trim() || '';
const MIN_MARKETS = Number(process.env.WC_SMOKE_MIN_MARKETS || '5');
const TIMEOUT_MS = Number(process.env.WC_SMOKE_TIMEOUT_MS || '30000');

type LineEvent = {
  slug: string;
  marketsCount?: number;
  sport?: string;
  homeTeam?: string;
  awayTeam?: string;
};

type EventDetail = {
  slug: string;
  groupedMarkets: WcGroupedMarkets;
  homeTeam: string;
  awayTeam: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${path}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function pickEventSlug(): Promise<string> {
  if (FIXED_SLUG) return FIXED_SLUG;

  const sources = [
    '/api/feed/live/events?sport=basketball&limit=30',
    '/api/feed/line/events?sport=basketball&limit=30',
    '/api/feed/live/events?limit=30',
    '/api/feed/line/events?limit=30',
  ];

  for (const path of sources) {
    const events = await fetchJson<LineEvent[]>(path);
    const candidate = events
      .filter((e) => e.slug && (e.marketsCount ?? 0) >= MIN_MARKETS)
      .sort((a, b) => (b.marketsCount ?? 0) - (a.marketsCount ?? 0))[0];
    if (candidate?.slug) {
      return candidate.slug;
    }
  }

  throw new Error(`No event with marketsCount >= ${MIN_MARKETS} found on ${BASE_URL}`);
}

function formatSmokeFailure(slug: string, result: WcMarketsSmokeResult): string {
  const lines = result.issues.map(
    (issue) => `- [${issue.code}] ${issue.message}${issue.groupKey ? ` (${issue.groupKey})` : ''}`,
  );
  return [
    `WC markets smoke failed for ${BASE_URL}/game/${slug}`,
    `stats: ${JSON.stringify(result.stats)}`,
    ...lines,
  ].join('\n');
}

(SMOKE_SKIP ? describe.skip : describe)('WC markets HTTP smoke', () => {
  let slug = '';
  let detail: EventDetail;
  let smoke: WcMarketsSmokeResult;

  beforeAll(async () => {
    const status = await fetchJson<{ enabled: boolean }>('/api/feed/status');
    expect(status.enabled).toBe(true);

    slug = await pickEventSlug();
    detail = await fetchJson<EventDetail>(`/api/feed/events/${encodeURIComponent(slug)}`);
    smoke = validateGroupedMarketsForSmoke(detail.groupedMarkets ?? {});
  }, TIMEOUT_MS);

  it('feed is enabled', async () => {
    const status = await fetchJson<{ enabled: boolean }>('/api/feed/status');
    expect(status.enabled).toBe(true);
  });

  it('loads an event with grouped markets', () => {
    expect(detail.slug || slug).toBeTruthy();
    expect(detail.groupedMarkets).toBeTruthy();
    expect(Object.keys(detail.groupedMarkets).length).toBeGreaterThan(0);
  });

  it('has parseable totals with OVER/UNDER lines', () => {
    expect(smoke.stats.totalsGroups).toBeGreaterThan(0);
    expect(smoke.issues.some((i) => i.code.startsWith('totals'))).toBe(false);
  });

  it('has parseable handicap pairs when handicap markets exist', () => {
    if (smoke.stats.handicapGroups === 0) return;
    expect(smoke.issues.some((i) => i.code.startsWith('handicap'))).toBe(false);
  });

  it('has a single canonical 1X2 block when h2h exists', () => {
    if (smoke.stats.h2hGroups === 0) return;
    expect(smoke.issues.some((i) => i.code.startsWith('h2h'))).toBe(false);
  });

  it('passes full structural smoke validation', () => {
    if (!smoke.ok) {
      throw new Error(formatSmokeFailure(slug, smoke));
    }
    expect(smoke.ok).toBe(true);
  });
});
