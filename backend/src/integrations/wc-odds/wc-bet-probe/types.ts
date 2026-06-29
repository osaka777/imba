import type { WcOddsBetStatus } from '@prisma/client';

import type { WcGroupedMarkets, WcMarketGroup, WcMarketOutcome } from '../wc-odds-markets.util';
import type { WcOddsEventDetailDto } from '../wc-odds.types';

export type WcBetProbeMode = 'dry-run' | 'live';

export type WcBetProbeSeverity = 'error' | 'warning' | 'info';

export type WcBetProbeFinding = {
  severity: WcBetProbeSeverity;
  code: string;
  message: string;
  eventId?: string;
  slug?: string;
  sport?: string;
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
  line?: string | null;
  expected?: WcOddsBetStatus | null;
  actual?: WcOddsBetStatus | null;
  meta?: Record<string, unknown>;
};

export type WcBetProbeCandidate = {
  marketKey: string;
  groupKey: string;
  groupLabel: string;
  outcome: WcMarketOutcome;
  line: string | null;
  outcomeName: string;
  clientOdds: number;
  totalsGroupLabel?: string;
};

export type WcBetProbeEventResult = {
  slug: string;
  eventId: string;
  sport: string;
  phase: string;
  homeTeam: string;
  awayTeam: string;
  bettingOpen: boolean;
  completed: boolean;
  marketsCount: number;
  smokeOk: boolean;
  candidates: number;
  probed: number;
  placed: number;
  findings: WcBetProbeFinding[];
};

export type WcBetProbeReport = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  baseUrl: string;
  mode: WcBetProbeMode;
  config: Record<string, string | number | boolean>;
  summary: {
    eventsScanned: number;
    outcomesCollected: number;
    outcomesProbed: number;
    betsPlaced: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  events: WcBetProbeEventResult[];
  findings: WcBetProbeFinding[];
};

export type WcBetProbeEventDetail = WcOddsEventDetailDto & {
  groupedMarkets: WcGroupedMarkets;
};

export type WcBetProbeListEvent = {
  id: string;
  slug: string;
  sport?: string;
  marketsCount?: number;
  homeTeam?: string;
  awayTeam?: string;
  phase?: string;
  bettingOpen?: boolean;
};

export type WcBetProbeGroupRef = WcMarketGroup & {
  category: string;
};
