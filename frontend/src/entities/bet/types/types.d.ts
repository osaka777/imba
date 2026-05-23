import { components } from "~/shared/api";

export type Rate = {
  coef?: string;
  eventId?: string;
  eventName?: string;
  groupedMarket?: components["schemas"]["MarketDto"];
  isOpen?: boolean;
  market?: string;
  title?: string;
  isAvailable?: boolean;
  isLive?: boolean;
  oc_block?: any;
  blocked?: any;
  available?: any;
  sum?: string;
  subGameId?: number; // ID подигры для ставок на sub_games
  subGameName?: string; // Название подигры для отображения
  parentEventId?: string; // ID родительского события для subGame ставок
};

export type Rates = Rate[];
