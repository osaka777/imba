import {
  CYBERSPORT_CATALOG,
  CYBER_SPORT_LABELS,
  cyberIconForApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";

export type CyberSportItem = {
  Icon: React.FC<{ className?: string }>;
  label: string;
  name: string;
};

export const CYBER_SPORTS: CyberSportItem[] = CYBERSPORT_CATALOG.map((entry) => ({
  Icon: cyberIconForApiSport(entry.apiSport),
  label: entry.label,
  name: entry.apiSport,
}));

export const DEFAULT_CYBER_SPORT = "esports.cs";

export function resolveCyberSportLabel(sport: string): string {
  return CYBER_SPORT_LABELS[sport] ?? sport;
}
