export type OlimpbetCyberEventListItem = {
  id: number;
  eventDate: string;
  live?: boolean;
  competitors?: Array<{ id: number; name: string }>;
  homeCompetitorIds?: number[];
  tournament?: {
    id?: number;
    name?: string;
    sportId?: number;
  };
};

export type OlimpbetCyberEventListResponse = {
  items?: OlimpbetCyberEventListItem[];
  paginationKeyForward?: string | null;
};

export type OlimpbetCyberProbability = {
  outcomeTypeId: number;
  odd?: number | null;
  tradingStatus?: string | null;
  parameters?: Array<{ type: string; value: string }>;
};

export type OlimpbetCyberProbabilityMarket = {
  marketId: number;
  probabilities?: OlimpbetCyberProbability[];
};

export type OlimpbetCyberEventDetail = {
  id: number;
  eventDate: string;
  live?: boolean;
  competitors?: Array<{ id: number; name: string }>;
  homeCompetitorIds?: number[];
  tournament?: {
    id?: number;
    name?: string;
    sportId?: number;
  };
  probabilities?: {
    markets?: OlimpbetCyberProbabilityMarket[];
  };
  statistics?: Array<{ code: string; value: string }>;
};
