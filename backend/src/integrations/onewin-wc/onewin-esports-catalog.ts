/**
 * 1win/top-parser esports sportId / sportTag → our esports.* API keys.
 * Only titles that actually appear on the gateway are listed; the rest of the
 * legacy Olimpbet catalog stays for URL compatibility but will show empty counts.
 */

export type OneWinEsportsCatalogEntry = {
  apiSport: string;
  label: string;
  pathSlug: string;
  sportId: number;
  sportTag: string;
};

export const ONEWIN_ESPORTS_CATALOG: OneWinEsportsCatalogEntry[] = [
  { sportId: 142, sportTag: 'counter_strike2', apiSport: 'esports.cs', pathSlug: 'cs2', label: 'CS2' },
  { sportId: 47, sportTag: 'dota_2', apiSport: 'esports.dota2', pathSlug: 'dota-2', label: 'Dota 2' },
  { sportId: 37, sportTag: 'league_of_legends', apiSport: 'esports.lol', pathSlug: 'lol', label: 'League of Legends' },
  { sportId: 99, sportTag: 'valorant', apiSport: 'esports.valorant', pathSlug: 'valorant', label: 'Valorant' },
  { sportId: 45, sportTag: 'rainbow_six', apiSport: 'esports.r6', pathSlug: 'rainbow-six', label: 'Rainbow Six' },
  { sportId: 136, sportTag: 'mobile_legends', apiSport: 'esports.mobile-legends', pathSlug: 'mobile-legends', label: 'Mobile Legends' },
  { sportId: 101, sportTag: 'king_of_glory', apiSport: 'esports.kog', pathSlug: 'king-of-glory', label: 'King of Glory' },
  { sportId: 59, sportTag: 'overwatch', apiSport: 'esports.overwatch2', pathSlug: 'overwatch-2', label: 'Overwatch 2' },
  { sportId: 167, sportTag: 'pubg_mobile', apiSport: 'esports.pubg-mobile', pathSlug: 'pubg-mobile', label: 'PUBG Mobile' },
];

export const ONEWIN_SPORT_ID_TO_API: Record<number, string> = Object.fromEntries(
  ONEWIN_ESPORTS_CATALOG.map((e) => [e.sportId, e.apiSport]),
);

export const ONEWIN_API_TO_SPORT_ID: Record<string, number> = Object.fromEntries(
  ONEWIN_ESPORTS_CATALOG.map((e) => [e.apiSport, e.sportId]),
);

export const DEFAULT_ONEWIN_ESPORTS_SPORT_IDS = ONEWIN_ESPORTS_CATALOG.map(
  (e) => e.sportId,
);

export function oneWinApiSportFromSportId(sportId: number): string | null {
  return ONEWIN_SPORT_ID_TO_API[sportId] ?? null;
}

export function oneWinSportIdFromApiSport(apiSport: string): number | null {
  return ONEWIN_API_TO_SPORT_ID[apiSport] ?? null;
}

export function oneWinCatalogEntryByApiSport(
  apiSport: string,
): OneWinEsportsCatalogEntry | undefined {
  return ONEWIN_ESPORTS_CATALOG.find((e) => e.apiSport === apiSport);
}
