/**
 * Kick channel liveness + English fallback resolver.
 *
 * If the primary broadcast channel is confirmed offline, we substitute a
 * working (preferably English) esports channel for the same discipline so the
 * viewer always sees a live stream instead of an "offline" screen.
 */

export type KickStatus = "live" | "offline" | "unknown";

export type KickChannelPick = {
  slug: string;
  isFallback: boolean;
};

/** English esports channels on Kick, per discipline (api sport id). */
const FALLBACK_BY_SPORT: Record<string, string[]> = {
  "esports.cs": ["esltv", "blast", "blastpremier", "pgl"],
  "esports.csgo": ["esltv", "blast", "blastpremier", "pgl"],
  "esports.dota2": ["esl_dota2", "pgl", "dota2"],
  "esports.valorant": ["valorant", "riotgames"],
  "esports.lol": ["riotgames"],
  "esports.lol-wild-rift": ["riotgames"],
};

/** Cross-discipline English esports channels used when nothing else is live. */
const GLOBAL_FALLBACK = ["esltv", "riotgames", "blast", "pgl"];

const STATUS_TTL_MS = 30_000;
const statusCache = new Map<string, { status: KickStatus; at: number }>();

function normalizeSlug(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/** Query Kick public API for a channel's live status. */
export async function fetchKickStatus(
  channel: string,
  signal?: AbortSignal,
): Promise<KickStatus> {
  const slug = normalizeSlug(channel);
  if (!slug) return "unknown";

  const cached = statusCache.get(slug);
  if (cached && Date.now() - cached.at < STATUS_TTL_MS) return cached.status;

  let status: KickStatus = "unknown";
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
      signal,
    });
    if (res.status === 404) {
      status = "offline";
    } else if (res.ok) {
      const data = (await res.json()) as { livestream?: { is_live?: boolean } | null };
      const ls = data?.livestream;
      status = ls && (ls.is_live ?? true) ? "live" : "offline";
    } else {
      status = "unknown";
    }
  } catch {
    status = "unknown";
  }

  statusCache.set(slug, { status, at: Date.now() });
  return status;
}

/**
 * Resolve the channel to actually embed.
 * - Keeps the primary channel when it is live OR its status is unknown
 *   (never replace a possibly-live stream on a transient API failure).
 * - When the primary is confirmed offline, returns the first live fallback.
 * - Falls back to the primary (may be null) if nothing better is live.
 */
export async function resolveLiveKickChannel(
  primary: string | null | undefined,
  sport?: string | null,
  signal?: AbortSignal,
): Promise<KickChannelPick | null> {
  const primarySlug = primary ? normalizeSlug(primary) : null;

  if (primarySlug) {
    const status = await fetchKickStatus(primarySlug, signal);
    if (status === "live" || status === "unknown") {
      return { slug: primarySlug, isFallback: false };
    }
  }

  const candidates = [
    ...(sport ? FALLBACK_BY_SPORT[sport] ?? [] : []),
    ...GLOBAL_FALLBACK,
  ]
    .map(normalizeSlug)
    .filter((slug, index, arr) => slug !== primarySlug && arr.indexOf(slug) === index);

  for (const candidate of candidates) {
    if (signal?.aborted) return null;
    const status = await fetchKickStatus(candidate, signal);
    if (status === "live") return { slug: candidate, isFallback: true };
  }

  // Primary confirmed offline and no live fallback — do not embed offline Kick player.
  return null;
}
