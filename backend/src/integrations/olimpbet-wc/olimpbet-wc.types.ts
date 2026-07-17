export type OlimpbetV2EventListResponse = {
  items: OlimpbetV2EventListItem[];
  paginationKey?: string | null;
  paginationKeyForward?: string | null;
  paginationKeyBackward?: string | null;
};

export type OlimpbetV2EventListItem = {
  id: number;
  live?: boolean;
  tags?: number[] | null;
  eventType?: { id?: number; name?: string | null; code?: string | null } | null;
  tournament?: {
    id: number;
    name?: string | null;
    sportId?: number;
    tags?: number[] | null;
  } | null;
  competitors?: Array<{ id: number; name: string; type?: string | null }> | null;
  homeCompetitorIds?: number[] | null;
  eventDate?: string | null;
  status?: string | null;
};

export type OlimpbetLinkedEventRef = {
  eventId: number;
  eventType?: { id?: number; name?: string; code?: string } | null;
  kind?: string | null;
};

export type OlimpbetEventDetail = {
  id: number;
  live?: boolean;
  status?: string | null;
  competitors: Array<{ id: number; name: string; type?: string | null }>;
  homeCompetitorIds?: number[] | null;
  eventDate: string;
  score?: { home?: number; away?: number } | null;
  statistics?: Array<{ code: string; value: string }> | null;
  fullStatistics?: {
    homeStatistics?: {
      score?: number | null;
      periodScores?: Array<{ periodNumber: number; score: number | string }> | null;
    } | null;
    awayStatistics?: {
      score?: number | null;
      periodScores?: Array<{ periodNumber: number; score: number | string }> | null;
    } | null;
  } | null;
  linkedEvents?: OlimpbetLinkedEventRef[] | null;
  eventType?: { id?: number; name?: string; code?: string } | null;
  tournament?: {
    id?: number;
    name?: string | null;
    sportId?: number;
  } | null;
  broadcastAvailabilityStatus?: string | null;
  broadcastAvailability?: { status?: string | null; requiresExternalIpDetection?: boolean | null } | null;
  integrations?: Array<{ type?: string | null; headToHeadId?: string | null }> | null;
  probabilities?: {
    eventId: number;
    markets: OlimpbetProbabilityMarket[];
  } | null;
};

export type OlimpbetProbabilityMarket = {
  marketId: number;
  probabilities: OlimpbetProbability[];
};

export type OlimpbetProbability = {
  outcomeTypeId: number;
  odd: number;
  suspended?: boolean | null;
  tradingStatus?: string | null;
  parameters?: Array<{ type: string; value: string }> | null;
};
