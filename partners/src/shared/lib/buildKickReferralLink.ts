export function buildKickReferralLink(
  baseLink: string,
  channelSlug?: string | null,
  activeSessionId?: string | null,
) {
  const url = new URL(baseLink);
  url.searchParams.set("sub1", "kick");
  if (channelSlug) {
    url.searchParams.set("sub2", channelSlug);
  }
  if (activeSessionId) {
    url.searchParams.set("sub3", activeSessionId.slice(0, 64));
  }
  return url.toString();
}

export { buildKickShortUrl } from "./kickShortUrl";

