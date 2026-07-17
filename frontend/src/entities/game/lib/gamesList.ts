import {
  BasketballIcon,
  HockeyIcon,
  MmaIcon,
  SoccerIcon,
  TableTennisIcon,
  TennisIcon,
  VolleyballIcon,
} from "~/shared/assets";

import {
  CYBERSPORT_CATALOG,
  cyberIconForApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";

const coreGames = {
  soccer: { Icon: SoccerIcon, label: "Футбол", name: "soccer" },
  hockey: { Icon: HockeyIcon, label: "Хоккей", name: "hockey" },
  basketball: { Icon: BasketballIcon, label: "Баскетбол", name: "basketball" },
  ["table-tennis"]: {
    Icon: TableTennisIcon,
    label: "Настольный теннис",
    name: "table-tennis",
  },
  tennis: { Icon: TennisIcon, label: "Теннис", name: "tennis" },
  volleyball: { Icon: VolleyballIcon, label: "Волейбол", name: "volleyball" },
  mma: { Icon: MmaIcon, label: "UFC/MMA", name: "mma" },
  "cyber-football": { Icon: SoccerIcon, label: "Киберфутбол", name: "cyber-football" },
  "cyber-basketball": { Icon: BasketballIcon, label: "Кибербаскетбол", name: "cyber-basketball" },
} as const;

const esportsGames = Object.fromEntries(
  CYBERSPORT_CATALOG.map((entry) => [
    entry.apiSport,
    {
      Icon: cyberIconForApiSport(entry.apiSport),
      label: entry.label,
      name: entry.apiSport,
      hidden: true as const,
    },
  ]),
);

export const gamesList: Record<
  string,
  {
    Icon: React.FC<{ className?: string }>;
    label: string;
    name: string;
    hidden?: boolean;
  }
> = {
  ...coreGames,
  ...esportsGames,
};

export const visibleGamesList = () =>
  Object.values(gamesList).filter((sport) => !sport.hidden);
