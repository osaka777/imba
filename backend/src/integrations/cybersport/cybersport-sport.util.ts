export const CYBER_OLIMP_SPORT_ID_TO_SLUG: Record<number, string> = {
  1040: 'esports.cs',
  1041: 'esports.dota2',
  1042: 'esports.valorant',
};

export const CYBER_SLUG_TO_OLIMP_SPORT_ID: Record<string, number> = Object.fromEntries(
  Object.entries(CYBER_OLIMP_SPORT_ID_TO_SLUG).map(([id, slug]) => [slug, Number(id)]),
);

export const DEFAULT_CYBER_OLIMP_SPORT_IDS = [1040, 1041, 1042];

export function cyberSlugFromOlimpbetSportId(sportId: number): string {
  return CYBER_OLIMP_SPORT_ID_TO_SLUG[sportId] ?? 'esports.cs';
}

export function cyberOlimpbetSportIdFromSlug(slug: string): number | null {
  return CYBER_SLUG_TO_OLIMP_SPORT_ID[slug] ?? null;
}

export const CYBER_SPORT_LABELS: Record<string, string> = {
  'esports.cs': 'CS2',
  'esports.dota2': 'Dota 2',
  'esports.valorant': 'Valorant',
};
