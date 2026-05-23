import type { components } from "~/shared/api";
type GameDto = components["schemas"]["GameDtoWithGroupedMarkets"];
type MarketDto = components["schemas"]["MarketDto"];

export type ApiGamesWithSport = {
  [key: string]: GameDto[] | null;
};

export type League = {
  games: GameDto[];
  leagueName: string;
};

export type GamesWithLeague = {
  [key: string]: League[];
};

export type Game = GameDto & {
  subcategory?: {
    id: number;
    code: string;
    name: string;
    sport: string;
    type?: string;
    isActive: boolean;
    isPriority?: boolean;
    flag?: string;
  };
};

export type Games = Game[];

export type MessageRaw = {
  eventId: string;
  type: "removeMarkets" | "update_markets" | "updateParsedScore" | "update_event" | "detailed_update" | "update_event_full" | "gameStatusUpdate" | "heartbeat" | "subscribed";
};

export type MessageUpdateScore = {
  payload: components["schemas"]["GameDtoWithGroupedMarkets"]["parsedScore"];
  type: "updateParsedScore";
} & MessageRaw;

export type MessageUpdateMarkets = {
  payload: components["schemas"]["GameDtoWithGroupedMarkets"]["groupedMarkets"];
  type: "update_markets";
} & MessageRaw;

export type MessageRemoveMarkets = {
  payload: string[];
  type: "removeMarkets";
} & MessageRaw;

export type MessageUpdateEvent = {
  payload: {
    gameData: any;
    changes: string[];
    dataType: string;
    isPriority: boolean;
  };
  type: "update_event";
} & MessageRaw;

export type MessageDetailedUpdate = {
  payload: {
    gameData: any;
    changes: string[];
    dataType: string;
    isPriority: boolean;
  };
  type: "detailed_update";
} & MessageRaw;

export type MessageUpdateEventFull = {
  payload: {
    gameData?: any;
    groupedMarkets?: components["schemas"]["GameDtoWithGroupedMarkets"]["groupedMarkets"];
  };
  type: "update_event_full";
} & MessageRaw;

export type MessageGameStatusUpdate = {
  payload?: any;
  data?: any;
  status?: string;
  type: "gameStatusUpdate";
} & MessageRaw;

export type MessageHeartbeat = {
  payload?: any;
  timestamp?: string;
  type: "heartbeat";
} & MessageRaw;

export type MessageSubscribed = {
  status?: string;
  type: "subscribed";
} & Partial<MessageRaw>;

export type Message =
  | MessageRemoveMarkets
  | MessageUpdateMarkets
  | MessageUpdateScore
  | MessageUpdateEvent
  | MessageDetailedUpdate
  | MessageUpdateEventFull
  | MessageGameStatusUpdate
  | MessageHeartbeat
  | MessageSubscribed;
