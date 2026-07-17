/** Olimpbet esports catalog (IDs 1039–1087 from GET /api/sports). */
export type CybersportCatalogEntry = {
  olimpbetId: number;
  /** Internal API sport key, e.g. esports.lol */
  apiSport: string;
  /** URL segment under /cybersport/{pathSlug} */
  pathSlug: string;
  label: string;
  /** Optional Kick channel slug for tournament broadcasts */
  kickChannel?: string;
  /** League name patterns → kick channel (CS2-focused) */
  kickLeaguePatterns?: Array<{ pattern: RegExp; channel: string }>;
};

export const CYBERSPORT_CATALOG: CybersportCatalogEntry[] = [
  { olimpbetId: 1039, apiSport: 'esports.pubg-mobile', pathSlug: 'pubg-mobile', label: 'PUBG Mobile' },
  { olimpbetId: 1040, apiSport: 'esports.cs', pathSlug: 'cs2', label: 'CS2', kickLeaguePatterns: [
    { pattern: /xse pro league|\bxse\b|\bxpl\b/i, channel: 'xsecsb' },
    { pattern: /european pro league|\bepl\b/i, channel: 'eplcs_en' },
    { pattern: /united\s*21|\bu21\b/i, channel: 'united21_en' },
    { pattern: /fissure|\bfpg\b/i, channel: 'fissure_cs_a' },
  ] },
  { olimpbetId: 1041, apiSport: 'esports.dota2', pathSlug: 'dota-2', label: 'Dota 2' },
  { olimpbetId: 1042, apiSport: 'esports.valorant', pathSlug: 'valorant', label: 'Valorant' },
  { olimpbetId: 1043, apiSport: 'esports.csgo', pathSlug: 'csgo', label: 'CS:GO' },
  { olimpbetId: 1044, apiSport: 'esports.lol', pathSlug: 'lol', label: 'League of Legends' },
  { olimpbetId: 1045, apiSport: 'esports.r6', pathSlug: 'rainbow-six', label: 'Rainbow Six' },
  { olimpbetId: 1046, apiSport: 'esports.lol-wild-rift', pathSlug: 'lol-wild-rift', label: 'LoL Wild Rift' },
  { olimpbetId: 1047, apiSport: 'esports.mobile-legends', pathSlug: 'mobile-legends', label: 'Mobile Legends' },
  { olimpbetId: 1048, apiSport: 'esports.pubg', pathSlug: 'pubg', label: 'PUBG' },
  { olimpbetId: 1049, apiSport: 'esports.cod', pathSlug: 'cod', label: 'Call of Duty' },
  { olimpbetId: 1050, apiSport: 'esports.sc2', pathSlug: 'starcraft-2', label: 'StarCraft 2' },
  { olimpbetId: 1051, apiSport: 'esports.overwatch2', pathSlug: 'overwatch-2', label: 'Overwatch 2' },
  { olimpbetId: 1052, apiSport: 'esports.aoe', pathSlug: 'age-of-empires', label: 'Age of Empires' },
  { olimpbetId: 1053, apiSport: 'esports.apex', pathSlug: 'apex-legends', label: 'Apex Legends' },
  { olimpbetId: 1054, apiSport: 'esports.aov', pathSlug: 'arena-of-valor', label: 'Arena of Valor' },
  { olimpbetId: 1055, apiSport: 'esports.artifact', pathSlug: 'artifact', label: 'Artifact' },
  { olimpbetId: 1056, apiSport: 'esports.brawl-stars', pathSlug: 'brawl-stars', label: 'Brawl Stars' },
  { olimpbetId: 1057, apiSport: 'esports.clash-royale', pathSlug: 'clash-royale', label: 'Clash Royale' },
  { olimpbetId: 1058, apiSport: 'esports.crossfire', pathSlug: 'crossfire', label: 'CrossFire' },
  { olimpbetId: 1059, apiSport: 'esports.fortnite', pathSlug: 'fortnite', label: 'Fortnite' },
  { olimpbetId: 1060, apiSport: 'esports.free-fire', pathSlug: 'free-fire', label: 'Free Fire' },
  { olimpbetId: 1061, apiSport: 'esports.gears', pathSlug: 'gears-of-war', label: 'Gears of War' },
  { olimpbetId: 1062, apiSport: 'esports.gwent', pathSlug: 'gwent', label: 'Gwent' },
  { olimpbetId: 1063, apiSport: 'esports.halo', pathSlug: 'halo', label: 'Halo' },
  { olimpbetId: 1064, apiSport: 'esports.hearthstone', pathSlug: 'hearthstone', label: 'Hearthstone' },
  { olimpbetId: 1065, apiSport: 'esports.hon', pathSlug: 'hon', label: 'Heroes of Newerth' },
  { olimpbetId: 1066, apiSport: 'esports.hots', pathSlug: 'hots', label: 'Heroes of the Storm' },
  { olimpbetId: 1067, apiSport: 'esports.overwatch', pathSlug: 'overwatch', label: 'Overwatch' },
  { olimpbetId: 1068, apiSport: 'esports.rocket-league', pathSlug: 'rocket-league', label: 'Rocket League' },
  { olimpbetId: 1069, apiSport: 'esports.starcraft', pathSlug: 'starcraft', label: 'StarCraft' },
  { olimpbetId: 1070, apiSport: 'esports.street-fighter', pathSlug: 'street-fighter', label: 'Street Fighter' },
  { olimpbetId: 1071, apiSport: 'esports.tekken', pathSlug: 'tekken', label: 'Tekken 7' },
  { olimpbetId: 1072, apiSport: 'esports.vainglory', pathSlug: 'vainglory', label: 'VainGlory' },
  { olimpbetId: 1073, apiSport: 'esports.wc3', pathSlug: 'warcraft-3', label: 'Warcraft III' },
  { olimpbetId: 1074, apiSport: 'esports.wot', pathSlug: 'world-of-tanks', label: 'World of Tanks' },
  { olimpbetId: 1075, apiSport: 'esports.wow', pathSlug: 'wow', label: 'World of Warcraft' },
  { olimpbetId: 1076, apiSport: 'esports.mk', pathSlug: 'mortal-kombat', label: 'Mortal Kombat XL' },
  { olimpbetId: 1077, apiSport: 'esports.sf5', pathSlug: 'street-fighter-5', label: 'Street Fighter V' },
  { olimpbetId: 1078, apiSport: 'esports.kog', pathSlug: 'king-of-glory', label: 'King of Glory' },
  { olimpbetId: 1079, apiSport: 'esports.coc', pathSlug: 'clash-of-clans', label: 'Clash of Clans' },
  { olimpbetId: 1080, apiSport: 'esports.arm-wrestling', pathSlug: 'arm-wrestling', label: 'Армрестлинг' },
  { olimpbetId: 1081, apiSport: 'esports.padel', pathSlug: 'padel', label: 'Падел-теннис' },
  { olimpbetId: 1082, apiSport: 'esports.deadlock', pathSlug: 'deadlock', label: 'Deadlock' },
  { olimpbetId: 1083, apiSport: 'esports.geoguessr', pathSlug: 'geoguessr', label: 'GeoGuessr' },
  { olimpbetId: 1084, apiSport: 'esports.karate', pathSlug: 'karate', label: 'Карате' },
  { olimpbetId: 1085, apiSport: 'esports.slap', pathSlug: 'slap', label: 'Слэп' },
  { olimpbetId: 1086, apiSport: 'esports.pickleball', pathSlug: 'pickleball', label: 'Пиклбол' },
  { olimpbetId: 1087, apiSport: 'esports.baige', pathSlug: 'baige', label: 'Байге' },
];

export const CYBER_OLIMP_SPORT_ID_TO_SLUG: Record<number, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.olimpbetId, e.apiSport]),
);

export const CYBER_SLUG_TO_OLIMP_SPORT_ID: Record<string, number> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.apiSport, e.olimpbetId]),
);

export const CYBER_PATH_SLUG_TO_API_SPORT: Record<string, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.pathSlug, e.apiSport]),
);

export const CYBER_API_SPORT_TO_PATH_SLUG: Record<string, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.apiSport, e.pathSlug]),
);

export const DEFAULT_CYBER_OLIMP_SPORT_IDS = CYBERSPORT_CATALOG.map((e) => e.olimpbetId);

export const CYBER_SPORT_LABELS: Record<string, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.apiSport, e.label]),
);

export function catalogEntryByOlimpbetId(id: number): CybersportCatalogEntry | undefined {
  return CYBERSPORT_CATALOG.find((e) => e.olimpbetId === id);
}

export function catalogEntryByApiSport(apiSport: string): CybersportCatalogEntry | undefined {
  return CYBERSPORT_CATALOG.find((e) => e.apiSport === apiSport);
}

export function catalogEntryByPathSlug(pathSlug: string): CybersportCatalogEntry | undefined {
  return CYBERSPORT_CATALOG.find((e) => e.pathSlug === pathSlug);
}

export function resolveKickChannelFromCatalog(
  apiSport: string,
  leagueName?: string | null,
): string | null {
  const entry = catalogEntryByApiSport(apiSport);
  if (!entry?.kickChannel && !entry?.kickLeaguePatterns?.length) return null;
  if (entry.kickChannel) return entry.kickChannel;
  const league = leagueName?.trim() ?? '';
  if (!league) return null;
  for (const rule of entry.kickLeaguePatterns ?? []) {
    if (rule.pattern.test(league)) return rule.channel;
  }
  return null;
}
