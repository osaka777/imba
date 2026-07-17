/** Build Kick player embed URL with parent domains from the current page host. */
export function buildKickEmbedUrl(channel: string, parentHost?: string, muted = true): string {
  const slug = channel.trim().replace(/^@/, "").toLowerCase();
  const host = (parentHost ?? (typeof window !== "undefined" ? window.location.hostname : "imba.bet"))
    .replace(/^https?:\/\//i, "")
    .split("/")[0]!
    .split(":")[0]!
    .toLowerCase();
  const apex = host.startsWith("www.") ? host.slice(4) : host;
  const parents = [...new Set([host, apex, `www.${apex}`])];

  const url = new URL(`https://player.kick.com/${encodeURIComponent(slug)}`);
  url.searchParams.set("parent", parents[0]!);
  for (const parent of parents.slice(1)) {
    url.searchParams.append("parent", parent);
  }
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("muted", String(muted));
  url.searchParams.set("playsinline", "true");
  return url.toString();
}

export function isKickPlayerUrl(raw?: string | null): boolean {
  if (!raw?.trim()) return false;
  try {
    return /(^|\.)kick\.com$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}
