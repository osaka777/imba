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
  subGameId?: number;
  subGameName?: string;
  parentEventId?: string;
  /** Isolated WC module — not BetAPI */
  source?: "wc-odds";
  wcPick?: "HOME" | "DRAW" | "AWAY";
  wcMarketKey?: string;
  wcGroupKey?: string;
  wcOutcomeKey?: string;
  wcLine?: string;
  wcCommenceTime?: string;
  wcCompleted?: boolean;
  sport?: string;
  leagueName?: string;
  wcPhase?: "prematch" | "live" | "finished";
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  wcLiveTimeLabel?: string;
};

export type Rates = Rate[];
