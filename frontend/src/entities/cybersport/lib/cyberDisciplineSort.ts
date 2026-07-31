import type { CyberDisciplineConfig } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import type { CyberSportItem } from "~/entities/cybersport/lib/cyberSportsList";

/** Popular disciplines — fixed order when shown in menus (1win only). */
export const CYBER_TOP_API_SPORTS: readonly string[] = [
  "esports.cs",
  "esports.dota2",
  "esports.valorant",
  "esports.lol",
  "esports.mobile-legends",
  "esports.kog",
  "esports.overwatch2",
  "esports.r6",
];

export const CYBER_FILTER_QUICK_LIMIT = 8;
export const CYBER_CARD_DEFAULT_LIMIT = 12;

const TOP_INDEX = new Map(CYBER_TOP_API_SPORTS.map((apiSport, index) => [apiSport, index]));

function topRank(apiSport: string): number {
  return TOP_INDEX.get(apiSport) ?? 999;
}

function compareCyberApiSports(
  aApiSport: string,
  aLabel: string,
  bApiSport: string,
  bLabel: string,
  counts: Record<string, number>,
): number {
  const aCount = counts[aApiSport] ?? 0;
  const bCount = counts[bApiSport] ?? 0;
  const aActive = aCount > 0;
  const bActive = bCount > 0;

  if (aActive !== bActive) return aActive ? -1 : 1;
  if (aActive && bActive && aCount !== bCount) return bCount - aCount;

  const topDelta = topRank(aApiSport) - topRank(bApiSport);
  if (topDelta !== 0) return topDelta;

  return aLabel.localeCompare(bLabel, "ru");
}

export function sortCyberDisciplines(
  list: CyberDisciplineConfig[],
  counts: Record<string, number>,
): CyberDisciplineConfig[] {
  return [...list].sort((a, b) =>
    compareCyberApiSports(a.apiSport, a.label, b.apiSport, b.label, counts),
  );
}

export function sortCyberSportItems(
  list: CyberSportItem[],
  counts: Record<string, number>,
): CyberSportItem[] {
  return [...list].sort((a, b) =>
    compareCyberApiSports(a.name, a.label, b.name, b.label, counts),
  );
}

export function activeCyberDisciplines(
  list: CyberDisciplineConfig[],
  counts: Record<string, number>,
): CyberDisciplineConfig[] {
  return sortCyberDisciplines(list, counts).filter(
    (item) => (counts[item.apiSport] ?? 0) > 0,
  );
}

export function inactiveCyberDisciplines(
  list: CyberDisciplineConfig[],
  counts: Record<string, number>,
): CyberDisciplineConfig[] {
  return sortCyberDisciplines(list, counts).filter(
    (item) => (counts[item.apiSport] ?? 0) <= 0,
  );
}

/** Quick filter row: top/active first, always includes current selection. */
export function pickQuickCyberSports(
  sorted: CyberSportItem[],
  counts: Record<string, number>,
  activeSport: string,
  limit = CYBER_FILTER_QUICK_LIMIT,
): CyberSportItem[] {
  const withMatches = sorted.filter((item) => (counts[item.name] ?? 0) > 0);
  const picked: CyberSportItem[] = [];
  const seen = new Set<string>();

  const push = (item: CyberSportItem) => {
    if (seen.has(item.name)) return;
    seen.add(item.name);
    picked.push(item);
  };

  for (const apiSport of CYBER_TOP_API_SPORTS) {
    const item = sorted.find((entry) => entry.name === apiSport);
    if (item && (counts[item.name] ?? 0) > 0) push(item);
    if (picked.length >= limit) break;
  }

  for (const item of withMatches) {
    push(item);
    if (picked.length >= limit) break;
  }

  return picked.slice(0, limit);
}

export function cyberMoreSports(
  sorted: CyberSportItem[],
  quick: CyberSportItem[],
  counts?: Record<string, number>,
): CyberSportItem[] {
  const quickSet = new Set(quick.map((item) => item.name));
  return sorted.filter((item) => {
    if (quickSet.has(item.name)) return false;
    // Hide empty 1win slots from «Ещё» unless we have no counts yet.
    if (counts && Object.keys(counts).length > 0) {
      return (counts[item.name] ?? 0) > 0;
    }
    return true;
  });
}

export function countActiveCyberDisciplines(counts: Record<string, number>): number {
  return Object.values(counts).filter((count) => count > 0).length;
}
