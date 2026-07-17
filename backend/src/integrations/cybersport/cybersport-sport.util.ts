export {
  CYBER_OLIMP_SPORT_ID_TO_SLUG,
  CYBER_SLUG_TO_OLIMP_SPORT_ID,
  CYBER_API_SPORT_TO_PATH_SLUG,
  CYBER_PATH_SLUG_TO_API_SPORT,
  CYBER_SPORT_LABELS,
  DEFAULT_CYBER_OLIMP_SPORT_IDS,
  CYBERSPORT_CATALOG,
  catalogEntryByApiSport,
  catalogEntryByOlimpbetId,
  catalogEntryByPathSlug,
} from './cybersport-catalog';

import {
  CYBER_API_SPORT_TO_PATH_SLUG,
  CYBER_OLIMP_SPORT_ID_TO_SLUG,
  CYBER_SLUG_TO_OLIMP_SPORT_ID,
} from './cybersport-catalog';

export function cyberSlugFromOlimpbetSportId(sportId: number): string {
  return CYBER_OLIMP_SPORT_ID_TO_SLUG[sportId] ?? `esports.${sportId}`;
}

export function cyberOlimpbetSportIdFromSlug(slug: string): number | null {
  return CYBER_SLUG_TO_OLIMP_SPORT_ID[slug] ?? null;
}

export function cyberPathSlugFromApiSport(apiSport: string): string | null {
  return CYBER_API_SPORT_TO_PATH_SLUG[apiSport] ?? null;
}
