import type { WcParsedScore, WcStatListItem } from './wc-odds-statistics.types';

export type { WcParsedScore, WcStatListItem } from './wc-odds-statistics.types';

export type WcTournamentDto = {
  tournamentId: number | null;
  leagueName: string;
  count: number;
  priorityLevel?: number;
  isPriority?: boolean;
};

export type WcOddsEventDto = {
  id: string;
  slug: string;
  sport: string;
  leagueName: string;
  tournamentId: number | null;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  oddsOver: number | null;
  oddsUnder: number | null;
  bookmaker: string;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  bettingOpen: boolean;
  phase: 'prematch' | 'live' | 'finished';
  oddsUpdatedAt: string | null;
  marketsCount: number;
  odds1X: number | null;
  odds12: number | null;
  oddsX2: number | null;
  parsedScore?: WcParsedScore | null;
  statList?: WcStatListItem[];
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
  hasBroadcast?: boolean;
  /** Live tracker / statistics widget available (1win). */
  hasLiveTracker?: boolean;
  olimpbetEventId?: number | null;
  priorityLevel?: number;
  isPriority?: boolean;
  /** Raw Olimpbet event status (e.g. EVENT_SUSPENDED). */
  feedStatus?: string | null;
  hasHeadToHead?: boolean;
};

export type { WcGroupedMarkets, WcMarketGroup, WcMarketOutcome } from './wc-odds-markets.util';

export type WcOddsEventDetailDto = WcOddsEventDto & {
  groupedMarkets: import('./wc-odds-markets.util').WcGroupedMarkets;
};
