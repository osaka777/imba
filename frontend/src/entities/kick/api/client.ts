export type KickLivePartner = {
  partnerTag: string;
  channelSlug: string;
  streamTitle: string | null;
  viewerCount: number | null;
  hasBranding: boolean;
  kickUrl: string;
  betUrl: string;
};

export type KickPartnerWidget = {
  found: boolean;
  partnerTag: string;
  channelSlug: string | null;
  channelAvatarUrl?: string | null;
  channelDisplayName?: string | null;
  isLive: boolean;
  viewerCount: number | null;
  streamTitle: string | null;
  betUrl: string;
  promoCode: string | null;
  widgetUrl: string;
  shortUrlKick: string | null;
  shortUrlImba: string | null;
  liveStats: {
    sessionClicks: number;
    sessionRegistrations: number;
    todayClicks: number;
  } | null;
  viewerOffer: {
    streamerLabel: string;
    promoCode: string | null;
    headline: string;
  } | null;
};

export async function fetchKickLivePartners(): Promise<KickLivePartner[]> {
  const res = await fetch('/api/kick/partners/live', {
    next: { revalidate: 30 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data?.partners ?? [];
}

export async function fetchKickPartnerByTag(tag: string): Promise<KickPartnerWidget | null> {
  const res = await fetch(`/api/kick/partners/by-tag/${encodeURIComponent(tag)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as KickPartnerWidget;
  return data?.found ? data : null;
}
