/** Build Twitch player embed URL with parent domains from the current page host. */
export function buildTwitchEmbedUrl(channel: string, parentHost?: string, muted = true): string {
  const login = channel.trim().replace(/^@/, "").toLowerCase();
  const host = (parentHost ?? (typeof window !== "undefined" ? window.location.hostname : "imba.bet"))
    .replace(/^https?:\/\//i, "")
    .split("/")[0]!
    .split(":")[0]!
    .toLowerCase();
  const apex = host.startsWith("www.") ? host.slice(4) : host;
  const parents = [...new Set([host, apex, `www.${apex}`])];

  const url = new URL("https://player.twitch.tv/");
  url.searchParams.set("channel", login);
  for (const parent of parents) {
    url.searchParams.append("parent", parent);
  }
  url.searchParams.set("muted", String(muted));
  return url.toString();
}

export function isTwitchPlayerUrl(raw?: string | null): boolean {
  if (!raw?.trim()) return false;
  try {
    return /(^|\.)twitch\.tv$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}
