import { kickEsportsLiveProbeSlugs, sportKeyToOlimpbetId } from './kick-broadcast.util';
import { isOlimpbetEsportsSportId } from '../olimpbet-wc/olimpbet-sport.util';

const TWITCH_LOGIN_RE = /^[a-z0-9_]{2,25}$/i;

/** RU/CIS bookmaker stream channels — never embed. */
const TWITCH_BLOCKLIST_PATTERNS = [
  /betboom/i,
  /1xbet/i,
  /fonbet/i,
  /parimatch/i,
  /leon\b/i,
  /winline/i,
  /melbet/i,
  /olimp/i,
  /baltbet/i,
  /ligastavok/i,
];

/** English tournament channels allowed as esports fallback (Kick alternative). */
const TWITCH_EN_BY_SPORT_ID: Record<number, string[]> = {
  1040: ['esl_csgo', 'blastpremier', 'pgl', 'eplcs_en', 'fissure_cs_a', 'eslcs'],
  1043: ['esl_csgo', 'blastpremier', 'pgl'],
  1041: ['esl_dota2', 'pgl_dota2'],
  1042: ['valorant', 'riotgames'],
  1044: ['riotgames'],
  1046: ['riotgames'],
};

const TWITCH_EN_GLOBAL = ['esl_csgo', 'riotgames', 'blastpremier', 'pgl'];

export function normalizeTwitchLogin(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function isBlockedTwitchChannel(channel?: string | null): boolean {
  const slug = normalizeTwitchLogin(channel ?? '');
  if (!slug) return true;
  return TWITCH_BLOCKLIST_PATTERNS.some((pattern) => pattern.test(slug));
}

const VERIFIED_TWITCH_EN_CHANNELS = new Set(
  [...Object.values(TWITCH_EN_BY_SPORT_ID).flat(), ...TWITCH_EN_GLOBAL]
    .map(normalizeTwitchLogin)
    .filter((slug) => slug && !isBlockedTwitchChannel(slug)),
);

export function isVerifiedTwitchEnChannel(channel?: string | null): boolean {
  const slug = normalizeTwitchLogin(channel ?? '');
  if (!slug || !TWITCH_LOGIN_RE.test(slug)) return false;
  if (isBlockedTwitchChannel(slug)) return false;
  return VERIFIED_TWITCH_EN_CHANNELS.has(slug);
}

export function twitchEsportsEnProbeSlugs(sportKey?: string | null): string[] {
  const sportId = sportKeyToOlimpbetId(sportKey);
  const fromSport = sportId != null ? TWITCH_EN_BY_SPORT_ID[sportId] ?? [] : [];
  return [...new Set(
    [...fromSport, ...TWITCH_EN_GLOBAL]
      .map(normalizeTwitchLogin)
      .filter((slug) => slug && !isBlockedTwitchChannel(slug)),
  )];
}

export function twitchEsportsStreamProbeSlugs(sportKey?: string | null): string[] {
  const kick = kickEsportsLiveProbeSlugs(sportKey);
  const twitch = twitchEsportsEnProbeSlugs(sportKey);
  return [...new Set([...kick, ...twitch])];
}

export function isEsportsSportKey(sportKey?: string | null): boolean {
  const sportId = sportKeyToOlimpbetId(sportKey);
  return sportId != null && isOlimpbetEsportsSportId(sportId);
}

export function kickParentDomainsFromHost(baseUrlOrHost?: string): string[] {
  const raw = baseUrlOrHost?.trim();
  if (!raw) return ['imba.bet', 'www.imba.bet'];
  try {
    const host = /^https?:\/\//i.test(raw)
      ? new URL(raw).hostname.toLowerCase()
      : raw.replace(/\/.*$/, '').split(':')[0]!.toLowerCase();
    const apex = host.startsWith('www.') ? host.slice(4) : host;
    return [...new Set([host, apex, `www.${apex}`])];
  } catch {
    return ['imba.bet', 'www.imba.bet'];
  }
}

export function buildTwitchPlayerUrl(channel: string, parentHost?: string, muted = true): string {
  const login = normalizeTwitchLogin(channel);
  const url = new URL('https://player.twitch.tv/');
  url.searchParams.set('channel', login);
  for (const parent of kickParentDomainsFromHost(parentHost)) {
    url.searchParams.append('parent', parent);
  }
  url.searchParams.set('muted', String(muted));
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

export function extractTwitchLoginFromUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw);
    if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) return null;
    const fromQuery = url.searchParams.get('channel')?.trim();
    if (fromQuery && TWITCH_LOGIN_RE.test(fromQuery)) {
      return normalizeTwitchLogin(fromQuery);
    }
    const pathLogin = url.pathname.split('/').filter(Boolean)[0];
    if (pathLogin && TWITCH_LOGIN_RE.test(pathLogin)) {
      return normalizeTwitchLogin(pathLogin);
    }
  } catch {
    /* ignore */
  }
  const inline = /player\.twitch\.tv\/\?channel=([^&"'\\s]+)/i.exec(raw);
  if (inline?.[1] && TWITCH_LOGIN_RE.test(inline[1])) {
    return normalizeTwitchLogin(inline[1]);
  }
  return null;
}
