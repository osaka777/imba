/** Домен коротких партнёрских ссылок (imbalance.click). */
export const KICK_SHORT_CLICK_DOMAIN_DEFAULT = 'imbalance.click';

export function normalizeKickShortClickDomain(raw?: string | null) {
  const value = raw?.trim() || KICK_SHORT_CLICK_DOMAIN_DEFAULT;
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function buildKickShortClickUrl(
  channelSlug: string | null | undefined,
  domain?: string | null,
) {
  const slug = channelSlug?.trim().toLowerCase();
  if (!slug) return null;
  const host = normalizeKickShortClickDomain(domain);
  return `https://${host}/${encodeURIComponent(slug)}`;
}
