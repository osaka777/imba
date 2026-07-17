export type OlimpbetCyberEventListItem = {
  id: number;
  eventDate: string;
  live?: boolean;
  status?: string;
  competitors?: Array<{ id: number; name: string }>;
  homeCompetitorIds?: number[];
  tournament?: {
    id?: number;
    name?: string;
    sportId?: number;
    tags?: Array<number | string>;
  };
  probabilities?: {
    markets?: OlimpbetCyberProbabilityMarket[];
  };
  statistics?: Array<{ code: string; value: string }>;
  broadcastAvailability?: { status?: string | null } | null;
  broadcastAvailabilityStatus?: string | null;
  tags?: Array<number | string>;
  outcomesCount?: number;
};

/** List item and detail share the fields needed for feed mapping. */
export type OlimpbetCyberEventSnapshot = OlimpbetCyberEventDetail;

export type OlimpbetCyberTournamentListItem = {
  id: number;
  name?: string;
  sportId?: number;
  liveEventCount?: number;
  lineEventCount?: number;
  tags?: Array<number | string>;
};

export type OlimpbetCyberEventListResponse = {
  items?: OlimpbetCyberEventListItem[];
  paginationKeyForward?: string | null;
};

export type OlimpbetCyberTournamentListResponse = {
  items?: OlimpbetCyberTournamentListItem[];
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
    tags?: Array<number | string>;
  };
  probabilities?: {
    markets?: OlimpbetCyberProbabilityMarket[];
  };
  statistics?: Array<{ code: string; value: string }>;
  broadcastAvailability?: { status?: string | null } | null;
  broadcastAvailabilityStatus?: string | null;
  tags?: Array<number | string>;
};
