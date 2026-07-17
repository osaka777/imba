const DEFAULT_DOMAIN = "imbalance.click";

export function getKickShortClickDomain() {
  const raw =
    process.env.NEXT_PUBLIC_KICK_SHORT_CLICK_DOMAIN?.trim() || DEFAULT_DOMAIN;
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Короткая ссылка партнёра: https://imbalance.click/{kick_nick} */
export function buildKickShortUrl(channelSlug?: string | null) {
  const slug = channelSlug?.trim().toLowerCase();
  if (!slug) return null;
  return `https://${getKickShortClickDomain()}/${encodeURIComponent(slug)}`;
}
