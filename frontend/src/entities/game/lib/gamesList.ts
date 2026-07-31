import {
  BasketballIcon,
  HockeyIcon,
  MmaIcon,
  SoccerIcon,
  TableTennisIcon,
  TennisIcon,
  VolleyballIcon,
} from "~/shared/assets";
import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";

import {
  CYBERSPORT_CATALOG,
  cyberIconForApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";

export type SportLabelKey = MessageKey;

const CORE_SPORT_LABEL_KEYS = {
  soccer: "sport.soccer",
  hockey: "sport.hockey",
  basketball: "sport.basketball",
  ["table-tennis"]: "sport.tableTennis",
  tennis: "sport.tennis",
  volleyball: "sport.volleyball",
  mma: "sport.mma",
  "cyber-football": "sport.cyberFootball",
  "cyber-basketball": "sport.cyberBasketball",
} as const satisfies Record<string, SportLabelKey>;

const coreGames = {
  soccer: { Icon: SoccerIcon, labelKey: CORE_SPORT_LABEL_KEYS.soccer, label: "Футбол", name: "soccer" },
  hockey: { Icon: HockeyIcon, labelKey: CORE_SPORT_LABEL_KEYS.hockey, label: "Хокей", name: "hockey" },
  basketball: { Icon: BasketballIcon, labelKey: CORE_SPORT_LABEL_KEYS.basketball, label: "Баскетбол", name: "basketball" },
  ["table-tennis"]: {
    Icon: TableTennisIcon,
    labelKey: CORE_SPORT_LABEL_KEYS["table-tennis"],
    label: "Настольный теннис",
    name: "table-tennis",
  },
  tennis: { Icon: TennisIcon, labelKey: CORE_SPORT_LABEL_KEYS.tennis, label: "Теннис", name: "tennis" },
  volleyball: { Icon: VolleyballIcon, labelKey: CORE_SPORT_LABEL_KEYS.volleyball, label: "Волейбол", name: "volleyball" },
  mma: { Icon: MmaIcon, labelKey: CORE_SPORT_LABEL_KEYS.mma, label: "UFC/MMA", name: "mma" },
  "cyber-football": { Icon: SoccerIcon, labelKey: CORE_SPORT_LABEL_KEYS["cyber-football"], label: "Киберфутбол", name: "cyber-football" },
  "cyber-basketball": { Icon: BasketballIcon, labelKey: CORE_SPORT_LABEL_KEYS["cyber-basketball"], label: "Кибербаскетбол", name: "cyber-basketball" },
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

type CoreGameDef = (typeof coreGames)[keyof typeof coreGames];
type EsportsGameDef = {
  Icon: React.FC<{ className?: string }>;
  label: string;
  name: string;
  hidden?: boolean;
};

export type GameListEntry = CoreGameDef | EsportsGameDef;

export const gamesList: Record<string, GameListEntry> = {
  ...coreGames,
  ...esportsGames,
};

export type SportTranslator = (key: MessageKey, params?: TranslateParams) => string;

export function getSportLabel(sport: string, t: SportTranslator): string {
  const def = gamesList[sport];
  if (!def) return sport;
  if ("labelKey" in def && def.labelKey) return t(def.labelKey);
  return def.label ?? sport;
}

export const visibleGamesList = () =>
  Object.values(gamesList).filter((sport) => !("hidden" in sport && sport.hidden));
