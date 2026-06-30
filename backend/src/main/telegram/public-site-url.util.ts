const PRODUCTION_SITE = 'https://imba.bet';

/** Public imba.bet origin — never localhost in production notifications. */
export function getPublicSiteBaseUrl(): string {
  const raw = (process.env.BASE_URL || PRODUCTION_SITE).trim().replace(/\/$/, '');
  if (!raw) return PRODUCTION_SITE;

  const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)
    || /localhost|127\.0\.0\.1/i.test(raw);

  if (process.env.NODE_ENV === 'production' && isLocal) {
    return PRODUCTION_SITE;
  }

  return raw.startsWith('http') ? raw : PRODUCTION_SITE;
}

export function publicGameUrl(slugOrId: string): string {
  const ref = slugOrId.trim().replace(/^\/+/, '');
  return `${getPublicSiteBaseUrl()}/game/${ref}`;
}
