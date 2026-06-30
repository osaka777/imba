export type AffiliateSubs = {
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
};

const SUB_KEYS = ["sub1", "sub2", "sub3", "sub4", "sub5"] as const;

export function parseAffiliateSubsCookie(raw: string | undefined): AffiliateSubs {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const subs: AffiliateSubs = {};
    for (const key of SUB_KEYS) {
      const val = parsed[key];
      if (typeof val === "string" && val.trim()) subs[key] = val.trim().slice(0, 64);
    }
    return subs;
  } catch {
    return {};
  }
}

export function hasAffiliateSubs(subs: AffiliateSubs): boolean {
  return SUB_KEYS.some((k) => Boolean(subs[k]));
}

export function appendSubsToUrl(baseUrl: string, subs: AffiliateSubs): string {
  try {
    const url = new URL(baseUrl);
    for (const key of SUB_KEYS) {
      const val = subs[key];
      if (val) url.searchParams.set(key, val);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}
