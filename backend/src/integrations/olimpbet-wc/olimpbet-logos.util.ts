const API_HOST = 'https://olimpbet.kz/api';
const LOGO_TTL_MS = 6 * 60 * 60 * 1000;

type LogoCacheEntry = {
  url: string | null;
  expiresAt: number;
};

const logoCache = new Map<number, LogoCacheEntry>();

type OlimpbetLogoItem = {
  entityId: number;
  logo?: {
    logoUrl?: string | null;
    thumbnails?: Array<{ logoUrl?: string | null; width?: number }> | null;
  } | null;
};

type OlimpbetLogosResponse = {
  entityType?: string;
  items?: OlimpbetLogoItem[];
};

function pickLogoUrl(item: OlimpbetLogoItem): string | null {
  const thumbs = item.logo?.thumbnails ?? [];
  const preferred = thumbs.find((t) => t.width === 40)
    ?? thumbs.find((t) => t.width === 64)
    ?? thumbs[0];
  const url = preferred?.logoUrl ?? item.logo?.logoUrl;
  return url?.trim() || null;
}

export function getCachedOlimpbetCompetitorLogo(
  competitorId: number | null | undefined,
): string | null {
  if (!competitorId) return null;
  const cached = logoCache.get(competitorId);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.url;
}

export async function fetchOlimpbetCompetitorLogos(
  ids: number[],
): Promise<Map<number, string | null>> {
  const result = new Map<number, string | null>();
  const missing: number[] = [];

  for (const id of ids) {
    if (!id || !Number.isFinite(id)) continue;
    const cached = logoCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      result.set(id, cached.url);
      continue;
    }
    missing.push(id);
  }

  if (missing.length === 0) return result;

  const unique = [...new Set(missing)];
  const chunkSize = 40;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const url = new URL(`${API_HOST}/logos/COMPETITOR`);
    url.searchParams.set('ids', chunk.join(','));

    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;

      const body = await res.json() as OlimpbetLogosResponse;
      const found = new Set<number>();

      for (const item of body.items ?? []) {
        if (!item?.entityId) continue;
        found.add(item.entityId);
        const logoUrl = pickLogoUrl(item);
        logoCache.set(item.entityId, {
          url: logoUrl,
          expiresAt: Date.now() + LOGO_TTL_MS,
        });
        result.set(item.entityId, logoUrl);
      }

      for (const id of chunk) {
        if (found.has(id)) continue;
        logoCache.set(id, { url: null, expiresAt: Date.now() + LOGO_TTL_MS });
        result.set(id, null);
      }
    } catch {
      // keep missing ids without cache poisoning
    }
  }

  return result;
}

export function resolveOlimpbetCompetitorLogo(
  competitorId: number | null | undefined,
  logoMap: Map<number, string | null>,
): string | null {
  if (!competitorId) return null;
  if (logoMap.has(competitorId)) return logoMap.get(competitorId) ?? null;
  return getCachedOlimpbetCompetitorLogo(competitorId);
}
