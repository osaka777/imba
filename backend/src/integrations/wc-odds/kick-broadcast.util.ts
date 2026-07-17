import {
  catalogEntryByOlimpbetId,
  resolveKickChannelFromCatalog,
} from '../cybersport/cybersport-catalog';
import { isOlimpbetEsportsSportId } from '../olimpbet-wc/olimpbet-sport.util';

export type KickBroadcastContext = {
  sportKey?: string | null;
  leagueName?: string | null;
  tournamentId?: number | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  olimpbetStreamUrl?: string | null;
  olimpbetBroadcastAvailable?: boolean;
  /** Live match — enables generic Kick fallback when league has no mapped channel. */
  isLive?: boolean;
};

type KickBroadcastRule = {
  tournamentId?: number;
  leaguePatterns: RegExp[];
  channel: string;
  sportIds?: number[];
};

const KICK_BROADCAST_RULES: KickBroadcastRule[] = [
  {
    tournamentId: 30111,
    leaguePatterns: [/xse pro league/i, /\bxse\b/i, /\bxpl\b/i],
    channel: 'xsecsb',
    sportIds: [1040],
  },
  {
    leaguePatterns: [/european pro league/i, /\bepl\b/i],
    channel: 'eplcs_en',
    sportIds: [1040],
  },
  {
    leaguePatterns: [/united\s*21/i, /\bu21\b/i],
    channel: 'united21_en',
    sportIds: [1040],
  },
  {
    leaguePatterns: [/fissure/i, /\bfpg\b/i],
    channel: 'fissure_cs_a',
    sportIds: [1040],
  },
];

/** English esports Kick channels used when no tournament-specific channel is mapped. */
const KICK_LIVE_FALLBACK_BY_SPORT_ID: Record<number, string> = {
  1040: 'esltv',
  1043: 'esltv',
  1041: 'esl_dota2',
  1042: 'valorant',
  1044: 'riotgames',
  1046: 'riotgames',
};

const VERIFIED_KICK_CHANNELS = new Set(
  [
    ...KICK_BROADCAST_RULES.map((rule) => rule.channel),
    'fissure_cs_a',
    'xsecsb',
    'eplcs_en',
    'united21_en',
    ...Object.values(KICK_LIVE_FALLBACK_BY_SPORT_ID),
    'blast',
    'blastpremier',
    'pgl',
    'dota2',
  ].map((slug) => slug.toLowerCase()),
);

const TWITCH_TO_KICK_CHANNEL: Record<string, string | null> = {
  betboom_sb_cs: null,
};

const KICK_CHANNEL_RE = /^[a-z0-9_]{2,32}$/i;

export function sportKeyToOlimpbetId(sportKey?: string | null): number | null {
  const match = /^olimp_(\d+)$/.exec(String(sportKey ?? '').trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function isEsportsContext(ctx: KickBroadcastContext): boolean {
  const sportId = sportKeyToOlimpbetId(ctx.sportKey);
  return sportId != null && isOlimpbetEsportsSportId(sportId);
}

function kickBroadcastEnabled(): boolean {
  const raw = process.env.KICK_BROADCAST_ESPORTS?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

function normalizeHostInput(baseUrlOrHost?: string): string | null {
  const raw = baseUrlOrHost?.trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).hostname.toLowerCase();
    }
    return raw.replace(/\/.*$/, '').split(':')[0]!.toLowerCase();
  } catch {
    return null;
  }
}

export function kickParentDomains(baseUrlOrHost = process.env.BASE_URL || 'https://imba.bet'): string[] {
  const fromInput = normalizeHostInput(baseUrlOrHost);
  if (fromInput) {
    const apex = fromInput.startsWith('www.') ? fromInput.slice(4) : fromInput;
    return [...new Set([fromInput, apex, `www.${apex}`])];
  }
  return ['imba.bet', 'www.imba.bet'];
}

export function isVerifiedKickChannel(channel?: string | null): boolean {
  const slug = channel?.trim().toLowerCase().replace(/^@/, '');
  return Boolean(slug && VERIFIED_KICK_CHANNELS.has(slug));
}

function resolveTwitchSlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase().replace(/^@/, '');
  if (!normalized || !KICK_CHANNEL_RE.test(normalized)) return null;
  if (Object.prototype.hasOwnProperty.call(TWITCH_TO_KICK_CHANNEL, normalized)) {
    return TWITCH_TO_KICK_CHANNEL[normalized] ?? null;
  }
  return VERIFIED_KICK_CHANNELS.has(normalized) ? normalized : null;
}

export function extractKickChannelFromPlayerUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw);
    if (!/(^|\.)kick\.com$/i.test(url.hostname)) return null;
    const pathParts = url.pathname.split('/').filter(Boolean);
    const fromPath = pathParts[pathParts.length - 1];
    if (fromPath && KICK_CHANNEL_RE.test(fromPath)) {
      return fromPath.toLowerCase().replace(/^@/, '');
    }
    const fromQuery = url.searchParams.get('channel')?.trim();
    if (fromQuery && KICK_CHANNEL_RE.test(fromQuery)) {
      return fromQuery.toLowerCase().replace(/^@/, '');
    }
  } catch {
    /* ignore */
  }
  const kickInline = /(?:player\.)?kick\.com\/([^/?"'\\s]+)/i.exec(raw);
  if (kickInline?.[1] && KICK_CHANNEL_RE.test(kickInline[1])) {
    return kickInline[1].trim().toLowerCase().replace(/^@/, '');
  }
  return null;
}

export function buildKickPlayerUrl(channel: string, parentHost?: string, muted = true): string {
  const slug = channel.trim().replace(/^@/, '').toLowerCase();
  const url = new URL(`https://player.kick.com/${encodeURIComponent(slug)}`);
  const parents = kickParentDomains(parentHost);
  url.searchParams.set('parent', parents[0]!);
  for (const parent of parents.slice(1)) {
    url.searchParams.append('parent', parent);
  }
  url.searchParams.set('autoplay', 'true');
  url.searchParams.set('muted', String(muted));
  url.searchParams.set('playsinline', 'true');
  return url.toString();
}

export function kickChannelFromStreamUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const directKick = extractKickChannelFromPlayerUrl(raw);
  if (directKick) return directKick;
  try {
    const url = new URL(raw);
    if (/(^|\.)twitch\.tv$/i.test(url.hostname)) {
      const channel = url.searchParams.get('channel')?.trim().toLowerCase();
      if (channel) return resolveTwitchSlug(channel);
    }
  } catch {
    /* ignore */
  }
  const twitchInline = /player\.twitch\.tv\/\?channel=([^&"'\\s]+)/i.exec(raw);
  if (twitchInline?.[1]) return resolveTwitchSlug(twitchInline[1]);
  return null;
}

function resolveFromOlimpbetUrl(raw?: string | null): string | null {
  return kickChannelFromStreamUrl(raw);
}

function ruleMatches(rule: KickBroadcastRule, ctx: KickBroadcastContext, sportId: number | null): boolean {
  if (rule.sportIds?.length && sportId != null && !rule.sportIds.includes(sportId)) return false;
  if (rule.tournamentId != null && ctx.tournamentId === rule.tournamentId) return true;
  const league = ctx.leagueName?.trim() ?? '';
  if (!league) return false;
  return rule.leaguePatterns.some((pattern) => pattern.test(league));
}

export function resolveKickLiveEsportsFallback(sportKey?: string | null): string | null {
  const sportId = sportKeyToOlimpbetId(sportKey);
  if (sportId == null || !isOlimpbetEsportsSportId(sportId)) return null;
  return KICK_LIVE_FALLBACK_BY_SPORT_ID[sportId] ?? 'esltv';
}

/** Candidate Kick slugs to probe when a live esports match has no mapped tournament channel. */
export function kickEsportsLiveProbeSlugs(sportKey?: string | null): string[] {
  const sportId = sportKeyToOlimpbetId(sportKey);
  const ordered = [
    ...(sportId != null ? KICK_BROADCAST_RULES.map((rule) => rule.channel) : []),
    resolveKickLiveEsportsFallback(sportKey),
    'blast',
    'blastpremier',
    'pgl',
    'fissure_cs_a',
    'xsecsb',
    'eplcs_en',
    'united21_en',
  ];

  return [...new Set(
    ordered
      .map((slug) => slug?.trim().toLowerCase().replace(/^@/, ''))
      .filter((slug): slug is string => Boolean(slug)),
  )];
}

export function resolveKickBroadcastChannel(ctx: KickBroadcastContext): string | null {
  if (!kickBroadcastEnabled() || !isEsportsContext(ctx)) return null;

  const fromUrl = resolveFromOlimpbetUrl(ctx.olimpbetStreamUrl);
  if (fromUrl) return fromUrl;

  const sportId = sportKeyToOlimpbetId(ctx.sportKey);
  for (const rule of KICK_BROADCAST_RULES) {
    if (ruleMatches(rule, ctx, sportId)) return rule.channel;
  }
  if (sportId != null) {
    const entry = catalogEntryByOlimpbetId(sportId);
    if (entry) {
      const fromCatalog = resolveKickChannelFromCatalog(entry.apiSport, ctx.leagueName);
      if (fromCatalog) return fromCatalog;
      if (entry.kickChannel) return entry.kickChannel;
    }
  }

  return null;
}

export function hasKickEsportsBroadcast(ctx: KickBroadcastContext): boolean {
  if (!kickBroadcastEnabled() || !isEsportsContext(ctx)) return false;
  if (kickChannelFromStreamUrl(ctx.olimpbetStreamUrl)) return true;
  const channel = resolveKickBroadcastChannel(ctx);
  if (channel && isVerifiedKickChannel(channel)) return true;
  // Olimpbet marks match-specific streams (iframe/HLS) — show TV badge for live and prematch.
  if (ctx.olimpbetBroadcastAvailable) return true;
  return false;
}

export function isKickPlayerUrl(raw: string): boolean {
  try {
    return /(^|\.)kick\.com$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

export function kickPlayerUrlFromStreamHint(raw?: string | null, parentHost?: string): string | null {
  const channel = kickChannelFromStreamUrl(raw);
  return channel ? buildKickPlayerUrl(channel, parentHost) : null;
}
