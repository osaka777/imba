import { olimpbetSportKeyToSlug, wcSlugToOlimpbetSportKey } from '../olimpbet-wc/olimpbet-sport.util';

/** Maps WcOddsEvent.sportKey → frontend line sport slug (gamesList). */
export function wcSportKeyToSlug(sportKey: string): string {
  const fromOlimpbet = olimpbetSportKeyToSlug(sportKey);
  if (fromOlimpbet) return fromOlimpbet;

  const known: Record<string, string> = {
    soccer_fifa_world_cup: 'soccer',
  };
  if (known[sportKey]) return known[sportKey];

  const prefix = sportKey.split('_')[0];
  const lineSports = new Set([
    'soccer',
    'hockey',
    'basketball',
    'tennis',
    'volleyball',
    'table-tennis',
    'mma',
    'cyber-football',
    'cyber-basketball',
  ]);
  if (lineSports.has(prefix)) return prefix;

  if (sportKey.startsWith('esports.')) return sportKey;
  if (prefix === 'esports' && sportKey.includes('.')) return sportKey;

  return prefix || 'soccer';
}

export function wcSlugToSportKey(slug: string): string | null {
  return wcSlugToOlimpbetSportKey(slug);
}

export function wcLeagueNameFromSportKey(sportKey: string): string {
  const leagues: Record<string, string> = {
    soccer_fifa_world_cup: 'Чемпионат мира',
  };
  return leagues[sportKey] ?? 'Olimpbet';
}
