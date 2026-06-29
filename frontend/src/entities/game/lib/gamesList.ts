import {
  BasketballIcon,
  CSIcon,
  DotaIcon,
  HockeyIcon,
  MmaIcon,
  SoccerIcon,
  TableTennisIcon,
  TennisIcon,
  VolleyballIcon,
} from "~/shared/assets";

export const gamesList: Record<
  string,
  {
    Icon: React.FC<{ className?: string }>;
    label: string;
    name: string;
    /** Temporarily hidden from line/live sport menu */
    hidden?: boolean;
  }
> = {
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
  // eslint-disable-next-line perfectionist/sort-objects
  ["esports.cs"]: {
    Icon: CSIcon,
    label: "Counter strike",
    name: "esports.cs",
    hidden: true,
  },
  // eslint-disable-next-line perfectionist/sort-objects
  ["esports.dota2"]: {
    Icon: DotaIcon,
    label: "Dota 2",
    name: "esports.dota2",
    hidden: true,
  },
  ["esports.valorant"]: {
    Icon: CSIcon,
    label: "Valorant",
    name: "esports.valorant",
    hidden: true,
  },
};

export const visibleGamesList = () =>
  Object.values(gamesList).filter((sport) => !sport.hidden);
