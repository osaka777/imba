/**
 * Client-side live stream resolver: Kick first, then English Twitch fallback.
 * Mirrors backend EsportsStreamResolverService using public APIs.
 */

import { buildKickEmbedUrl } from "~/entities/wc-odds/lib/kickEmbedUrl";
import { fetchKickStatus } from "~/entities/wc-odds/lib/kickLiveFallback";
import { buildTwitchEmbedUrl } from "~/entities/wc-odds/lib/twitchEmbedUrl";

export type StreamProvider = "kick" | "twitch";

export type LiveStreamPick = {
  provider: StreamProvider;
  slug: string;
  embedUrl: string;
  isFallback: boolean;
};

const TWITCH_BLOCKLIST = [
  /betboom/i,
  /\b1xbet\b/i,
  /fonbet/i,
  /parimatch/i,
  /leon\b/i,
  /winline/i,
  /melbet/i,
  /olimp/i,
];

const TWITCH_EN_BY_SPORT: Record<string, string[]> = {
  "esports.cs": ["esl_csgo", "blastpremier", "pgl", "eplcs_en", "fissure_cs_a"],
  "esports.csgo": ["esl_csgo", "blastpremier", "pgl"],
  "esports.dota2": ["esl_dota2", "pgl_dota2"],
  "esports.valorant": ["valorant", "riotgames"],
  "esports.lol": ["riotgames"],
  "esports.lol-wild-rift": ["riotgames"],
};

const KICK_FALLBACK_BY_SPORT: Record<string, string[]> = {
  "esports.cs": ["esltv", "blast", "blastpremier", "pgl", "xsecsb", "eplcs_en"],
  "esports.csgo": ["esltv", "blast", "blastpremier", "pgl"],
  "esports.dota2": ["esl_dota2", "pgl", "dota2"],
  "esports.valorant": ["valorant", "riotgames"],
  "esports.lol": ["riotgames"],
  "esports.lol-wild-rift": ["riotgames"],
};

const TWITCH_GLOBAL = ["esl_csgo", "riotgames", "blastpremier", "pgl"];

function normalizeSlug(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function isBlockedTwitch(slug: string): boolean {
  return TWITCH_BLOCKLIST.some((pattern) => pattern.test(slug));
}

async function fetchTwitchLive(login: string, signal?: AbortSignal): Promise<boolean> {
  const slug = normalizeSlug(login);
  if (!slug || isBlockedTwitch(slug)) return false;
  try {
    const res = await fetch(
      `https://decapi.me/twitch/uptime/${encodeURIComponent(slug)}`,
      { signal },
    );
    if (!res.ok) return false;
    const text = (await res.text()).trim().toLowerCase();
    return text.length > 0 && !text.includes("offline") && !text.includes("not found");
  } catch {
    return false;
  }
}

function kickCandidates(primary: string | null, sport?: string | null): string[] {
  return [
    ...(primary ? [primary] : []),
    ...(sport ? KICK_FALLBACK_BY_SPORT[sport] ?? [] : []),
  ]
    .map(normalizeSlug)
    .filter((slug, index, arr) => slug && arr.indexOf(slug) === index);
}

function twitchCandidates(sport?: string | null): string[] {
  return [
    ...(sport ? TWITCH_EN_BY_SPORT[sport] ?? [] : []),
    ...TWITCH_GLOBAL,
  ]
    .map(normalizeSlug)
    .filter((slug, index, arr) => slug && !isBlockedTwitch(slug) && arr.indexOf(slug) === index);
}

/** Resolve Kick or Twitch embed for esports. Kick is preferred when live. */
export async function resolveLiveEsportsStream(
  primaryKick: string | null | undefined,
  sport?: string | null,
  signal?: AbortSignal,
): Promise<LiveStreamPick | null> {
  const primarySlug = primaryKick ? normalizeSlug(primaryKick) : null;

  if (primarySlug) {
    const status = await fetchKickStatus(primarySlug, signal);
    if (status === "live" || status === "unknown") {
      return {
        provider: "kick",
        slug: primarySlug,
        embedUrl: buildKickEmbedUrl(primarySlug),
        isFallback: false,
      };
    }
  }

  for (const candidate of kickCandidates(primarySlug, sport)) {
    if (signal?.aborted) return null;
    if (candidate === primarySlug) continue;
    const status = await fetchKickStatus(candidate, signal);
    if (status === "live") {
      return {
        provider: "kick",
        slug: candidate,
        embedUrl: buildKickEmbedUrl(candidate),
        isFallback: true,
      };
    }
  }

  for (const candidate of twitchCandidates(sport)) {
    if (signal?.aborted) return null;
    const live = await fetchTwitchLive(candidate, signal);
    if (live) {
      return {
        provider: "twitch",
        slug: candidate,
        embedUrl: buildTwitchEmbedUrl(candidate),
        isFallback: true,
      };
    }
  }

  return null;
}
