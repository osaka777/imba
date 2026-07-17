import {
  CYBER_OLIMP_SPORT_ID_TO_SLUG,
  DEFAULT_CYBER_OLIMP_SPORT_IDS,
} from '../cybersport/cybersport-catalog';

/** Olimpbet sport IDs → frontend line slug (gamesList). */
export const OLIMPBET_SPORT_ID_TO_SLUG: Record<number, string> = {
  100: 'soccer',
  101: 'tennis',
  102: 'basketball',
  103: 'hockey',
  104: 'volleyball',
  110: 'table-tennis',
  124: 'cyber-basketball',
  126: 'cyber-football',
  1001: 'mma',
  ...CYBER_OLIMP_SPORT_ID_TO_SLUG,
};

export const OLIMPBET_ESPORTS_SPORT_IDS = new Set(DEFAULT_CYBER_OLIMP_SPORT_IDS);

export function isOlimpbetEsportsSportId(sportId: number | null | undefined): boolean {
  return sportId != null && OLIMPBET_ESPORTS_SPORT_IDS.has(sportId);
}

export const DEFAULT_OLIMPBET_SPORT_IDS = [100, 101, 102, 103, 104, 110, 124, 126, 1001];

const DEFAULT_LINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MMA_LINE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export function olimpbetLineWindowMs(sportId: number): number {
  return sportId === 1001 ? MMA_LINE_WINDOW_MS : DEFAULT_LINE_WINDOW_MS;
}

export function olimpbetSportIdToSlug(sportId: number): string {
  return OLIMPBET_SPORT_ID_TO_SLUG[sportId] ?? 'soccer';
}

export function buildOlimpbetSportKey(sportId: number): string {
  return `olimp_${sportId}`;
}

export function olimpbetSportKeyToSlug(sportKey: string): string | null {
  const match = /^olimp_(\d+)$/.exec(sportKey);
  if (!match) return null;
  return olimpbetSportIdToSlug(Number(match[1]));
}

export function wcSlugToOlimpbetSportKey(slug: string): string | null {
  for (const [sportId, lineSlug] of Object.entries(OLIMPBET_SPORT_ID_TO_SLUG)) {
    if (lineSlug === slug) return buildOlimpbetSportKey(Number(sportId));
  }
  return null;
}
