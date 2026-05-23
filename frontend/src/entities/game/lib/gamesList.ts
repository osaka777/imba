import {
  BasketballIcon,
  CSIcon,
  DotaIcon,
  HockeyIcon,
  SoccerIcon,
  TableTennisIcon,
  TennisIcon,
  VolleyballIcon,
} from "~/shared/assets";

export const gamesList: Record<
  string,
  { Icon: React.FC<{ className?: string }>; label: string; name: string }
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
  // eslint-disable-next-line perfectionist/sort-objects
  ["esports.cs"]: { Icon: CSIcon, label: "Counter strike", name: "esports.cs" },
  // eslint-disable-next-line perfectionist/sort-objects
  ["esports.dota2"]: {
    Icon: DotaIcon,
    label: "Dota 2",
    name: "esports.dota2",
  },
};
