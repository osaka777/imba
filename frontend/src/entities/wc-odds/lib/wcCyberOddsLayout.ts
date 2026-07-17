import type { WcEventDetail, WcMarketGroup } from "~/entities/wc-odds/api/client";
import { deriveTabKey, formatWcCategoryDisplayName } from "~/entities/wc-odds/lib/wcOddsCategories";

export type CyberOddsSectionId = "match" | `map-${number}` | "other";

const SECTION_ORDER: CyberOddsSectionId[] = [
  "match",
  "map-1",
  "map-2",
  "map-3",
  "map-4",
  "map-5",
  "map-6",
  "map-7",
  "other",
];

function isMapOtVariant(name: string): boolean {
  return /\(\s*без\s*ОТ\s*\)/i.test(name);
}

function mapCategoryBaseKey(name: string): string | null {
  const mapNum = parseMapNumberFromText(name);
  if (mapNum == null || mapNum < 1 || mapNum > 7) return null;
  return `map-${mapNum}`;
}

/** Схлопывает «1-я карта» и «1-я карта (без ОТ)» в одну категорию. */
export function dedupeCyberMapCategoryEntries(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const primaryMapKeys = new Set<string>();

  for (const [name] of entries) {
    const key = mapCategoryBaseKey(name);
    if (key && !isMapOtVariant(name)) primaryMapKeys.add(key);
  }

  const otGroupsByMap = new Map<string, WcMarketGroup[]>();
  const result: typeof entries = [];

  for (const [name, groups] of entries) {
    const key = mapCategoryBaseKey(name);
    if (key && isMapOtVariant(name) && primaryMapKeys.has(key)) {
      const existing = otGroupsByMap.get(key) ?? [];
      otGroupsByMap.set(key, [...existing, ...groups]);
      continue;
    }
    result.push([name, groups]);
  }

  if (!otGroupsByMap.size) return result;

  return result.map(([name, groups]) => {
    const key = mapCategoryBaseKey(name);
    if (!key || isMapOtVariant(name) || !otGroupsByMap.has(key)) {
      return [name, groups] as const;
    }

    const seen = new Set(groups.map((group) => group.key));
    const extra = otGroupsByMap.get(key)!.filter((group) => !seen.has(group.key));
    return extra.length ? ([name, [...groups, ...extra]] as const) : ([name, groups] as const);
  });
}

function parseMapNumberFromText(text: string): number | null {
  const compact = text.trim();
  const kPrefix = compact.match(/(?:^|[\s·])К(\d+)(?:[\s·]|$)/i);
  if (kPrefix) return Number(kPrefix[1]);

  const ordinal = compact.match(/(\d+)\s*[-–]?\s*[яЙ]\s*карт[аы]?/i);
  if (ordinal) return Number(ordinal[1]);

  const mapWord = compact.match(/(?:^|[\s·])map\s*(\d+)/i);
  if (mapWord) return Number(mapWord[1]);

  return null;
}

/** Группа рынков для cyber sidebar: матч / карта N / прочее. */
export function deriveCyberOddsSectionId(
  categoryName: string,
  displayName?: string,
): CyberOddsSectionId {
  const combined = `${categoryName} ${displayName ?? ""}`;
  const mapNum = parseMapNumberFromText(combined);
  if (mapNum != null && mapNum >= 1 && mapNum <= 7) {
    return `map-${mapNum}` as CyberOddsSectionId;
  }

  if (deriveTabKey(categoryName) === "Основные") return "match";
  if (/^1x2$/i.test(categoryName.trim())) return "match";
  if (/^исход\s+матча$/i.test(categoryName.trim())) return "match";

  return "other";
}

/** Текущая карта по счёту (1-based). */
export function resolveActiveCyberMapNumber(event: WcEventDetail): number | null {
  const details = event.parsedScore?.details;
  if (Array.isArray(details) && details.length > 0) {
    if (event.phase === "live") return details.length;
    return details.length;
  }

  const liveScore = event.parsedScore?.liveScore;
  if (liveScore && typeof liveScore.active === "number" && liveScore.active > 0) {
    return liveScore.active;
  }

  const period = event.parsedScore?.period;
  if (typeof period === "number" && period > 0) return period;
  if (typeof period === "string") {
    const m = period.match(/(\d+)/);
    if (m) return Number(m[1]);
  }

  return event.phase === "live" ? 1 : null;
}

export function formatCyberOddsSectionLabel(
  sectionId: CyberOddsSectionId,
  isActive = false,
): string {
  if (sectionId === "match") return "Матч";
  if (sectionId === "other") return "Другое";
  const n = sectionId.replace("map-", "");
  return isActive ? `К${n} · LIVE` : `К${n}`;
}

export type CyberOddsSectionGroup = {
  id: CyberOddsSectionId;
  label: string;
  isActive: boolean;
  entries: Array<[string, WcMarketGroup[]]>;
};

export function groupEntriesByCyberSection(
  entries: Array<[string, WcMarketGroup[]]>,
  event: WcEventDetail,
): CyberOddsSectionGroup[] {
  const activeMap = resolveActiveCyberMapNumber(event);
  const buckets = new Map<CyberOddsSectionId, CyberOddsSectionGroup["entries"]>();

  for (const entry of entries) {
    const display = formatWcCategoryDisplayName(entry[0], {
      sport: event.sport,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
    const id = deriveCyberOddsSectionId(entry[0], display);
    const list = buckets.get(id) ?? [];
    list.push(entry);
    buckets.set(id, list);
  }

  const result: CyberOddsSectionGroup[] = [];

  for (const id of SECTION_ORDER) {
    const sectionEntries = buckets.get(id);
    if (!sectionEntries?.length) continue;

    const mapNum = id.startsWith("map-") ? Number(id.replace("map-", "")) : null;
    const isActive = mapNum != null && activeMap != null && mapNum === activeMap;

    result.push({
      id,
      label: formatCyberOddsSectionLabel(id, isActive),
      isActive,
      entries: sectionEntries,
    });
    buckets.delete(id);
  }

  for (const [id, sectionEntries] of buckets) {
    if (!sectionEntries.length) continue;
    result.push({
      id,
      label: formatCyberOddsSectionLabel(id, false),
      isActive: false,
      entries: sectionEntries,
    });
  }

  return result;
}

export function shouldDefaultFoldCyberCategory(
  categoryName: string,
  event: WcEventDetail,
): boolean {
  const display = formatWcCategoryDisplayName(categoryName, {
    sport: event.sport,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
  });
  const sectionId = deriveCyberOddsSectionId(categoryName, display);

  if (sectionId === "match") return false;

  const activeMap = resolveActiveCyberMapNumber(event);
  if (sectionId.startsWith("map-") && activeMap != null) {
    const mapNum = Number(sectionId.replace("map-", ""));
    return mapNum !== activeMap;
  }

  if (sectionId === "other") return true;

  return false;
}

export function formatCyberTabCompactLabel(label: string, maxLen = 14): string {
  const compact = label
    .replace(/Результат\s*\+\s*тотал/i, "Р+Т")
    .replace(/Быстрые\s+события/i, "Быстрые")
    .replace(/(\d+)-(?:я|й)\s+половин(?:а|ы)?(?:\s*\([^)]*\))?/i, "$1P")
    .replace(/(\d+)-й\s+тайм/i, "$1T")
    .replace(/(\d+)-й\s+сет/i, "$1S")
    .trim();

  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1)}…`;
}

export function countEntriesByTab(
  entries: Array<[string, WcMarketGroup[]]>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [name] of entries) {
    const key = deriveTabKey(name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
