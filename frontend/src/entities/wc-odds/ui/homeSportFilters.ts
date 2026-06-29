import { visibleGamesList } from "~/entities/game";

export type HomeSportFilterItem = {
  name: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
};

function buildHomeSportsList(): HomeSportFilterItem[] {
  return visibleGamesList().map(({ name, label, Icon }) => ({
    name,
    label,
    Icon,
  }));
}

/** Same sports as line/live menu (gamesList, non-hidden). */
export const LIVE_HOME_SPORTS: HomeSportFilterItem[] = buildHomeSportsList();
export const PREMATCH_HOME_SPORTS: HomeSportFilterItem[] = buildHomeSportsList();
/** @deprecated use PREMATCH_HOME_SPORTS */
export const POPULAR_HOME_SPORTS = PREMATCH_HOME_SPORTS;

export function resolveHomeSportMeta(
  sports: HomeSportFilterItem[],
  sport: string | undefined,
  fallback = "soccer",
): HomeSportFilterItem {
  return sports.find((item) => item.name === sport) ?? sports.find((item) => item.name === fallback)!;
}
