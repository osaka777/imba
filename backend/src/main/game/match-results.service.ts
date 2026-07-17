import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { parseMatchState } from '../../integrations/wc-odds/wc-match-state.types';
import { wcSlugToOlimpbetSportKey } from '../../integrations/olimpbet-wc/olimpbet-sport.util';
import { olimpbetIdFromWcEventId } from '../../integrations/wc-odds/wc-slug.util';
import {
  fetchOlimpbetCompetitorLogos,
  resolveOlimpbetCompetitorLogo,
} from '../../integrations/olimpbet-wc/olimpbet-logos.util';
import { OlimpbetWcService } from '../../integrations/olimpbet-wc/olimpbet-wc.service';
import type { OlimpbetStructuredStatistics } from '../../integrations/wc-odds/wc-odds-statistics.types';

export type MatchResultPeriod = {
  home: number;
  away: number;
};

export type MatchResultStat = {
  id: string;
  name: string;
  home: string;
  away: string;
};

export type MatchResultGoal = {
  index: number;
  side: 'home' | 'away';
  minute: number | null;
};

export type MatchResultItem = {
  id: string;
  tournamentId: number | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamIcon: string | null;
  awayTeamIcon: string | null;
  homeCompetitorId: number | null;
  awayCompetitorId: number | null;
  leagueName: string;
  commenceTime: string;
  settledAt: string | null;
  homeScore: number;
  awayScore: number;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  periodScores: MatchResultPeriod[];
  penaltyScore: MatchResultPeriod | null;
  goalTimeline: MatchResultGoal[];
  statList: MatchResultStat[];
  hasBroadcast: boolean;
  priorityLevel: number;
  isPriority: boolean;
  isLive: boolean;
  href: string;
  source: 'olimpbet';
};

export type MatchResultsGroup = {
  leagueName: string;
  matches: MatchResultItem[];
};

export type MatchResultsResponse = {
  date: string;
  sport: string;
  mode: 'finished' | 'live';
  groups: MatchResultsGroup[];
  total: number;
};

export const RESULTS_SPORT_SLUGS = [
  'soccer',
  'tennis',
  'basketball',
  'hockey',
  'volleyball',
  'table-tennis',
  'mma',
  'cyber-football',
  'cyber-basketball',
] as const;
export type ResultsSportSlug = (typeof RESULTS_SPORT_SLUGS)[number];

const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const OLIMPBET_RESULTS_SPORTS = new Set<string>(RESULTS_SPORT_SLUGS);

function dayBoundsUtc(date: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split('-').map(Number);
  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - ALMATY_OFFSET_MS;
  const endMs = startMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

function normalizeTeamsKey(home: string, away: string): string {
  return `${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
}

function shouldSkipMatch(leagueName: string, homeTeam: string, awayTeam: string): boolean {
  const league = leagueName.toLowerCase();
  const teams = `${homeTeam} ${awayTeam}`.toLowerCase();

  if (league.includes('статистик')) return true;
  if (/5x5|2x12\s*мин|budnesliga/i.test(leagueName)) return true;
  if (/\(угловые\)|\(офсайды\)|\(фолы\)|\(удары|\(желтые карточки\)/i.test(teams)) {
    return true;
  }

  return false;
}

function extractPeriodScores(sport: string, matchStateJson: unknown): MatchResultPeriod[] {
  const state = parseMatchState(matchStateJson);
  if (!state) return [];
  if (state.result?.periodScores?.length) {
    return state.result.periodScores;
  }

  if (sport === 'tennis' || sport === 'table-tennis' || sport === 'volleyball') {
    return (state.tennis?.setScores ?? []).map((p) => ({ home: p.home, away: p.away }));
  }

  return (state.soccer?.periodScores ?? []).map((p) => ({ home: p.home, away: p.away }));
}

function extractPersistedStats(matchStateJson: unknown): MatchResultStat[] {
  const state = parseMatchState(matchStateJson);
  return (state?.result?.statList ?? []).map((stat) => ({
    id: stat.id,
    name: stat.name,
    home: stat.opp1,
    away: stat.opp2,
  }));
}

function extractPenaltyScore(matchStateJson: unknown): MatchResultPeriod | null {
  const state = parseMatchState(matchStateJson);
  return state?.soccer?.penaltyScore ?? null;
}

function extractGoalTimeline(matchStateJson: unknown): MatchResultGoal[] {
  const state = parseMatchState(matchStateJson);
  if (!state?.soccer?.goalScorers) return [];

  return Object.entries(state.soccer.goalScorers)
    .map(([index, side]) => ({
      index: Number(index),
      side,
      minute: state.soccer?.goalMinutes?.[index] ?? null,
    }))
    .filter((goal) => Number.isFinite(goal.index))
    .sort((a, b) => a.index - b.index);
}

function addStatRow(
  list: MatchResultStat[],
  id: string,
  name: string,
  home: number | string | null | undefined,
  away: number | string | null | undefined,
) {
  if (home == null && away == null) return;
  const h = home ?? 0;
  const a = away ?? 0;
  if (h === 0 && a === 0 && !['red_cards', 'yellow_cards', 'yellow_red_cards'].includes(id)) {
    return;
  }
  list.push({ id, name, home: String(h), away: String(a) });
}

function buildStructuredStatList(
  sport: string,
  structured: OlimpbetStructuredStatistics | null,
): MatchResultStat[] {
  if (!structured) return [];

  const home = structured.homeStatistics ?? null;
  const away = structured.awayStatistics ?? null;
  const list: MatchResultStat[] = [];

  if (sport === 'soccer') {
    addStatRow(list, 'corners', 'Угловые', home?.corners, away?.corners);
    addStatRow(list, 'yellow_cards', 'Жёлтые', home?.yellowCards, away?.yellowCards);
    addStatRow(list, 'red_cards', 'Красные', home?.redCards, away?.redCards);
    addStatRow(list, 'shots_on', 'Удары в створ', home?.shotsOnTarget, away?.shotsOnTarget);
    addStatRow(list, 'shots_off', 'Удары мимо', home?.shotsOffTarget, away?.shotsOffTarget);
    addStatRow(list, 'offsides', 'Офсайды', home?.offsides, away?.offsides);
    addStatRow(list, 'fouls', 'Фолы', home?.fouls, away?.fouls);
    addStatRow(list, 'dangerous_attacks', 'Опасные атаки', home?.dangerousAttacks, away?.dangerousAttacks);
    return list;
  }

  if (sport === 'tennis') {
    addStatRow(list, 'aces', 'Эйсы', home?.aces, away?.aces);
    addStatRow(list, 'double_faults', 'Двойные ошибки', home?.doubleFaults, away?.doubleFaults);
    return list;
  }

  if (sport === 'hockey') {
    addStatRow(list, 'players_on_ice', 'Игроки на льду', home?.playersOnIce, away?.playersOnIce);
  }

  return list;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0;

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(items[index], index);
    }
  }));

  return result;
}

async function enrichStats(
  olimpbet: OlimpbetWcService,
  sport: string,
  item: MatchResultItem,
): Promise<MatchResultItem> {
  const olimpbetEventId = olimpbetIdFromWcEventId(item.id);
  if (!olimpbetEventId) return item;

  try {
    const structured = await olimpbet.fetchEventStatistics(olimpbetEventId);
    const statList = buildStructuredStatList(sport, structured);
    return statList.length > 0 ? { ...item, statList } : item;
  } catch {
    return item;
  }
}

function buildMatchItem(params: {
  id: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  commenceTime: string;
  homeScore: number;
  awayScore: number;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  periodScores?: MatchResultPeriod[];
  isLive: boolean;
  href: string;
  source: 'olimpbet';
  tournamentId?: number | null;
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
  homeCompetitorId?: number | null;
  awayCompetitorId?: number | null;
  settledAt?: string | null;
  penaltyScore?: MatchResultPeriod | null;
  goalTimeline?: MatchResultGoal[];
  statList?: MatchResultStat[];
  hasBroadcast?: boolean;
  priorityLevel?: number;
}): MatchResultItem | null {
  if (shouldSkipMatch(params.leagueName, params.homeTeam, params.awayTeam)) {
    return null;
  }

  const periodScores = params.periodScores ?? [];
  const halfTimeHome = params.halfTimeHome ?? periodScores[0]?.home ?? null;
  const halfTimeAway = params.halfTimeAway ?? periodScores[0]?.away ?? null;

  return {
    id: params.id,
    tournamentId: params.tournamentId ?? null,
    homeTeam: params.homeTeam,
    awayTeam: params.awayTeam,
    homeTeamIcon: params.homeTeamIcon ?? null,
    awayTeamIcon: params.awayTeamIcon ?? null,
    homeCompetitorId: params.homeCompetitorId ?? null,
    awayCompetitorId: params.awayCompetitorId ?? null,
    leagueName: params.leagueName,
    commenceTime: params.commenceTime,
    settledAt: params.settledAt ?? null,
    homeScore: params.homeScore,
    awayScore: params.awayScore,
    halfTimeHome,
    halfTimeAway,
    periodScores,
    penaltyScore: params.penaltyScore ?? null,
    goalTimeline: params.goalTimeline ?? [],
    statList: params.statList ?? [],
    hasBroadcast: Boolean(params.hasBroadcast),
    priorityLevel: params.priorityLevel ?? 0,
    isPriority: (params.priorityLevel ?? 0) > 0,
    isLive: params.isLive,
    href: params.href,
    source: params.source,
  };
}

@Injectable()
export class MatchResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
  ) {}

  async getResults(
    sport: string,
    date: string,
    mode: 'finished' | 'live' = 'finished',
  ): Promise<MatchResultsResponse> {
    const bounds = dayBoundsUtc(date);
    if (!bounds || !OLIMPBET_RESULTS_SPORTS.has(sport)) {
      return { date, sport, mode, groups: [], total: 0 };
    }

    const sportKey = wcSlugToOlimpbetSportKey(sport);
    const items: MatchResultItem[] = [];
    const seen = new Set<string>();

    if (sportKey) {
      const wcRows = await this.prisma.wcOddsEvent.findMany({
        where: mode === 'finished'
          ? {
              completed: true,
              sportKey,
              commenceTime: { gte: bounds.start, lt: bounds.end },
              homeScore: { not: null },
              awayScore: { not: null },
            }
          : {
              completed: false,
              sportKey,
              commenceTime: { gte: bounds.start, lt: bounds.end },
            },
        orderBy: { commenceTime: 'desc' },
        take: 500,
      });

      const logoIds = wcRows.flatMap((row) => [
        row.homeCompetitorId,
        row.awayCompetitorId,
      ]).filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
      const logoMap = await fetchOlimpbetCompetitorLogos(logoIds);

      for (const row of wcRows) {
        const homeScore = row.homeScore ?? 0;
        const awayScore = row.awayScore ?? 0;
        if (mode === 'live' && homeScore === 0 && awayScore === 0 && row.commenceTime > new Date()) {
          continue;
        }

        const periodScores = extractPeriodScores(sport, row.matchStateJson);
        const penaltyScore = extractPenaltyScore(row.matchStateJson);
        const goalTimeline = extractGoalTimeline(row.matchStateJson);
        const statList = extractPersistedStats(row.matchStateJson);
        const item = buildMatchItem({
          id: row.id,
          tournamentId: row.tournamentId,
          homeTeam: row.homeTeam,
          awayTeam: row.awayTeam,
          homeTeamIcon: resolveOlimpbetCompetitorLogo(row.homeCompetitorId, logoMap),
          awayTeamIcon: resolveOlimpbetCompetitorLogo(row.awayCompetitorId, logoMap),
          homeCompetitorId: row.homeCompetitorId,
          awayCompetitorId: row.awayCompetitorId,
          leagueName: row.leagueName?.trim() || 'Турнир',
          commenceTime: row.commenceTime.toISOString(),
          settledAt: row.settledAt?.toISOString() ?? null,
          homeScore,
          awayScore,
          periodScores,
          penaltyScore,
          goalTimeline,
          statList,
          hasBroadcast: row.hasBroadcast,
          priorityLevel: row.priorityLevel,
          isLive: mode === 'live',
          href: `/game/${encodeURIComponent(row.slug?.trim() || row.id)}`,
          source: 'olimpbet',
        });
        if (!item) continue;

        const key = `${item.commenceTime}|${normalizeTeamsKey(item.homeTeam, item.awayTeam)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    }

    const enrichedItems = mode === 'live'
      ? await mapWithConcurrency(items, 8, (item) =>
          enrichStats(this.olimpbet, sport, item))
      : items;

    enrichedItems.sort(
      (a, b) =>
        b.priorityLevel - a.priorityLevel
        ||
        Date.parse(b.commenceTime) - Date.parse(a.commenceTime)
        || a.leagueName.localeCompare(b.leagueName, 'ru')
        || a.homeTeam.localeCompare(b.homeTeam, 'ru'),
    );

    const groupsMap = new Map<string, { leagueName: string; matches: MatchResultItem[] }>();
    for (const item of enrichedItems) {
      const key = `${item.tournamentId ?? 'none'}:${item.leagueName}`;
      const group = groupsMap.get(key) ?? { leagueName: item.leagueName, matches: [] };
      group.matches.push(item);
      groupsMap.set(key, group);
    }

    const groups: MatchResultsGroup[] = [...groupsMap.values()]
      .sort((a, b) => a.leagueName.localeCompare(b.leagueName, 'ru'));

    return {
      date,
      sport,
      mode,
      groups,
      total: enrichedItems.length,
    };
  }
}
