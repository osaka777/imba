export type AffiliateSubs = {
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
};

const SUB_KEYS = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;
const MAX_SUB_LEN = 64;
const SUB_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

export function sanitizeSubValue(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().slice(0, MAX_SUB_LEN);
  if (!trimmed || !SUB_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

export function parseAffiliateSubsFromQuery(
  params: URLSearchParams | Record<string, string | null | undefined>,
): AffiliateSubs {
  const get = (key: string): string | undefined => {
    const raw =
      params instanceof URLSearchParams
        ? params.get(key)
        : params[key] ?? undefined;
    return sanitizeSubValue(raw ?? undefined);
  };

  const subs: AffiliateSubs = {};
  for (const key of SUB_KEYS) {
    const val = get(key);
    if (val) subs[key] = val;
  }
  return subs;
}

export function parseAffiliateSubsJson(raw: unknown): AffiliateSubs {
  if (raw == null || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const subs: AffiliateSubs = {};
  for (const key of SUB_KEYS) {
    const val = sanitizeSubValue(
      typeof record[key] === 'string' ? record[key] : undefined,
    );
    if (val) subs[key] = val;
  }
  return subs;
}

export function hasAffiliateSubs(subs: AffiliateSubs): boolean {
  return SUB_KEYS.some((key) => Boolean(subs[key]));
}

export function mergeAffiliateSubs(
  existing: AffiliateSubs,
  incoming: AffiliateSubs,
): AffiliateSubs {
  const merged: AffiliateSubs = { ...existing };
  for (const key of SUB_KEYS) {
    if (incoming[key] && !merged[key]) {
      merged[key] = incoming[key];
    }
  }
  return merged;
}

export function appendSubsToUrl(baseUrl: string, subs: AffiliateSubs): string {
  const url = new URL(baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`);
  for (const key of SUB_KEYS) {
    const val = subs[key];
    if (val) url.searchParams.set(key, val);
  }
  return url.toString();
}

export function subsToPostbackParams(subs: AffiliateSubs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SUB_KEYS) {
    const val = subs[key];
    if (val) out[key] = val;
  }
  return out;
}
