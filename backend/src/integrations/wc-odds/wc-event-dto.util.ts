import { Decimal } from '@prisma/client/runtime/library';

import { getWcEventPhase, isWcBettingOpen } from './wc-betting.util';
import { isOlimpbetPriorityLevel } from '../olimpbet-wc/olimpbet-priority.util';
import { resolveOneWinEsportsTeamIcon } from '../onewin-wc/onewin-esports-logos.util';
import {
  buildWcLineExtras,
  extractMainTotalLine,
  type WcGroupedMarkets,
} from './wc-odds-markets.util';
import type { WcOddsEventDto } from './wc-odds.types';
import { parseMatchState } from './wc-match-state.types';
import { baseWcSlug, isBrokenWcSlug } from './wc-slug.util';
import { wcLeagueNameFromSportKey, wcSportKeyToSlug } from './wc-sport.util';

function isOneWinEventId(id: string): boolean {
  return /^ow-\d+$/i.test(id);
}

export type WcEventRowForDto = {
  id: string;
  slug: string | null;
  sportKey: string;
  leagueName?: string | null;
  tournamentId?: number | null;
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  oddsHome: Decimal | null;
  oddsDraw: Decimal | null;
  oddsAway: Decimal | null;
  bookmakerTitle: string | null;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeCompetitorId?: number | null;
  awayCompetitorId?: number | null;
  hasBroadcast?: boolean;
  priorityLevel?: number | null;
  marketsJson?: unknown;
  matchStateJson?: unknown;
  oddsUpdatedAt?: Date | null;
};

export function buildWcOddsEventDto(event: WcEventRowForDto): WcOddsEventDto {
  const bettingOpen = isWcBettingOpen(event.completed, event.commenceTime);
  const phase = getWcEventPhase(event.completed, event.commenceTime);
  const slug =
    event.slug && !isBrokenWcSlug(event.slug)
      ? event.slug
      : `${baseWcSlug(event.homeTeam, event.awayTeam)}-${event.id.replace(/^ol-/, '')}`;
  const grouped = (event.marketsJson ?? {}) as WcGroupedMarkets;
  const totals = extractMainTotalLine(grouped);
  const lineExtras = buildWcLineExtras(grouped);
  const priorityLevel = event.priorityLevel ?? 0;
  const persistedResult = parseMatchState(event.matchStateJson)?.result;
  const persistedParsedScore = persistedResult?.parsedScore
    ?? (persistedResult?.periodScores?.length
      ? {
          details: persistedResult.periodScores.map(
            (period) => [period.home, period.away] as [number, number],
          ),
          currentScore: event.homeScore != null && event.awayScore != null
            ? [event.homeScore, event.awayScore] as [number, number]
            : undefined,
          text: event.homeScore != null && event.awayScore != null
            ? { currentScore: `${event.homeScore}:${event.awayScore}` }
            : undefined,
        }
      : undefined);

  const oneWinIcons = isOneWinEventId(event.id)
    ? {
        awayTeamIcon: event.awayCompetitorId
          ? resolveOneWinEsportsTeamIcon({ id: event.awayCompetitorId })
          : null,
        homeTeamIcon: event.homeCompetitorId
          ? resolveOneWinEsportsTeamIcon({ id: event.homeCompetitorId })
          : null,
      }
    : { awayTeamIcon: null as null | string, homeTeamIcon: null as null | string };

  return {
    id: event.id,
    slug,
    sport: wcSportKeyToSlug(event.sportKey),
    leagueName: event.leagueName?.trim() || wcLeagueNameFromSportKey(event.sportKey),
    tournamentId: event.tournamentId ?? null,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    commenceTime: event.commenceTime.toISOString(),
    oddsHome: event.oddsHome ? Number(event.oddsHome) : null,
    oddsDraw: event.oddsDraw ? Number(event.oddsDraw) : null,
    oddsAway: event.oddsAway ? Number(event.oddsAway) : null,
    totalLine: totals.totalLine,
    oddsOver: totals.oddsOver,
    oddsUnder: totals.oddsUnder,
    bookmaker: event.bookmakerTitle ?? '',
    completed: event.completed,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    bettingOpen,
    phase,
    oddsUpdatedAt: event.oddsUpdatedAt?.toISOString() ?? null,
    homeTeamIcon: oneWinIcons.homeTeamIcon,
    awayTeamIcon: oneWinIcons.awayTeamIcon,
    hasBroadcast: Boolean(event.hasBroadcast),
    hasLiveTracker: Boolean(persistedResult?.hasLiveTracker),
    priorityLevel,
    isPriority: isOlimpbetPriorityLevel(priorityLevel),
    parsedScore: persistedParsedScore,
    statList: persistedResult?.statList,
    ...lineExtras,
  };
}
