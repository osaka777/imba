import { CSIcon, DotaIcon } from "~/shared/assets";

export type CyberSportItem = {
  Icon: React.FC<{ className?: string }>;
  label: string;
  name: string;
};

export const CYBER_SPORTS: CyberSportItem[] = [
  {
    Icon: CSIcon,
    label: "CS2",
    name: "esports.cs",
  },
  {
    Icon: DotaIcon,
    label: "Dota 2",
    name: "esports.dota2",
  },
  {
    Icon: CSIcon,
    label: "Valorant",
    name: "esports.valorant",
  },
];

export const DEFAULT_CYBER_SPORT = CYBER_SPORTS[0]?.name ?? "esports.cs";

export function resolveCyberSportLabel(sport: string): string {
  return CYBER_SPORTS.find((item) => item.name === sport)?.label ?? sport;
}
