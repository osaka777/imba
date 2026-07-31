import {
  CYBERSPORT_CATALOG,
  cyberIconForApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { sortCyberSportItems } from "~/entities/cybersport/lib/cyberDisciplineSort";

export type SportMenuItem = {
  Icon: React.FC<{ className?: string }>;
  iconUrl?: string | null;
  label: string;
  name: string;
};

/** Esports disciplines with at least one match (live + line), cybersport sort order. */
export function esportsMenuItems(counts: Record<string, number>): SportMenuItem[] {
  const items = CYBERSPORT_CATALOG.filter((entry) => (counts[entry.apiSport] ?? 0) > 0).map(
    (entry) => ({
      Icon: cyberIconForApiSport(entry.apiSport),
      iconUrl: entry.iconUrl ?? null,
      label: entry.label,
      name: entry.apiSport,
    }),
  );

  return sortCyberSportItems(items, counts);
}

export function mergeSportCounts(
  ...sources: Array<Record<string, number> | undefined>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [sport, count] of Object.entries(source)) {
      if (!Number.isFinite(count) || count <= 0) continue;
      merged[sport] = Math.max(merged[sport] ?? 0, count);
    }
  }
  return merged;
}
