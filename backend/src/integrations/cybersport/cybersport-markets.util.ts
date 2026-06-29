import { GameStatus } from '@prisma/client';

import {
  GameDtoWithGroupedMarkets,
  type MarketDto,
  type ParsedScoreDto,
} from '~/main/game/dto/available-games.dto';

import {
  loadOlimpbetMarketCatalog,
  type OlimpbetMarketCatalog,
} from '../olimpbet-wc/olimpbet-wc-catalog';
import {
  resolveOlimpbetCompetitorIds,
} from '../olimpbet-wc/olimpbet-competitor.util';
import {
  fetchOlimpbetCompetitorLogos,
  resolveOlimpbetCompetitorLogo,
} from '../olimpbet-wc/olimpbet-logos.util';

import { cyberGameRefFromOlimpbetId, maskCybersportLabel, maskCybersportTeamName } from './cybersport-mask.util';
import { cyberSlugFromOlimpbetSportId } from './cybersport-sport.util';
import type { OlimpbetCyberEventDetail, OlimpbetCyberProbability } from './cybersport.types';

const WINNER_MARKET_NAMES = /^MATCH_WINNER|^WINNER_MAP$/i;

function isTrading(prob: OlimpbetCyberProbability): boolean {
  if (prob.odd == null || !Number.isFinite(prob.odd) || prob.odd <= 1) return false;
  const status = prob.tradingStatus ?? '';
  return !status || status === 'PROBABILITY_TRADING';
}

function outcomeToWinKey(code: string): string | null {
  const norm = code.trim();
  if (/^П1/i.test(norm) || norm === '1' || /HOME/i.test(norm)) return 'WIN__P1';
  if (/^П2/i.test(norm) || norm === '2' || /AWAY/i.test(norm)) return 'WIN__P2';
  if (/^X$/i.test(norm) || norm === 'Х') return 'WIN__PX';
  return null;
}

function buildWinnerMarkets(
  catalog: OlimpbetMarketCatalog,
  detail: OlimpbetCyberEventDetail,
): MarketDto[] {
  const winners: MarketDto[] = [];

  for (const market of detail.probabilities?.markets ?? []) {
    const catalogMarket = catalog.markets.get(market.marketId);
    const catalogName = catalogMarket?.name ?? '';
    if (!WINNER_MARKET_NAMES.test(catalogName)) continue;
    if (catalogName === 'WINNER_MAP') continue;

    const mapNumber = market.probabilities?.some((p) =>
      p.parameters?.some((param) => param.type === 'PARAMETER_MAP_NUMBER'),
    );
    if (mapNumber) continue;

    for (const prob of market.probabilities ?? []) {
      if (!isTrading(prob)) continue;
      const outcome = catalogMarket?.outcomes.get(prob.outcomeTypeId);
      const code = outcome?.code ?? '';
      const winKey = outcomeToWinKey(code);
      if (!winKey) continue;

      winners.push({
        cf: prob.odd!,
        isOpen: true,
        market: winKey,
        plr: winKey === 'WIN__P1' ? 'P1' : winKey === 'WIN__P2' ? 'P2' : 'PX',
        basis: 'WIN',
      });
    }

    if (winners.length >= 2) break;
  }

  return winners;
}

function inlineStat(
  detail: OlimpbetCyberEventDetail,
  code: string,
): string | null {
  const row = detail.statistics?.find((s) => s.code === code);
  return row?.value?.trim() || null;
}

function buildParsedScore(detail: OlimpbetCyberEventDetail): ParsedScoreDto {
  const scoreRaw = inlineStat(detail, 'score');
  const periodsRaw = inlineStat(detail, 'scores_by_periods');
  const phase = inlineStat(detail, 'match_phase');

  const parsed: ParsedScoreDto = {
    currentScore: scoreRaw ? scoreRaw.split(':').map(Number) : [0, 0],
    text: {
      currentScore: scoreRaw ?? '-:-',
      details: periodsRaw?.replace(/,\s*/g, ', ') ?? undefined,
    },
  };

  if (scoreRaw) {
    const [home, away] = scoreRaw.split(':');
    parsed.currentScore = [Number(home) || 0, Number(away) || 0];
  }

  if (phase) parsed.period = Number(phase) || undefined;

  return parsed;
}

function resolveTeams(detail: OlimpbetCyberEventDetail): { team1: string; team2: string } {
  const comps = detail.competitors ?? [];
  const homeId = (detail.homeCompetitorIds ?? [])[0];
  const team1 = maskCybersportTeamName(
    comps.find((c) => c.id === homeId)?.name ?? comps[0]?.name ?? 'Команда 1',
  );
  const team2 = maskCybersportTeamName(
    comps.find((c) => c.id !== homeId)?.name ?? comps[1]?.name ?? 'Команда 2',
  );
  return { team1, team2 };
}

export async function mapOlimpbetCyberEventToGameDto(
  detail: OlimpbetCyberEventDetail,
  fallbackSportId?: number,
): Promise<GameDtoWithGroupedMarkets> {
  const catalog = await loadOlimpbetMarketCatalog();
  const sportId = detail.tournament?.sportId ?? fallbackSportId ?? 1040;
  const sport = cyberSlugFromOlimpbetSportId(sportId);
  const { team1, team2 } = resolveTeams(detail);
  const leagueName = maskCybersportLabel(detail.tournament?.name?.trim() || 'Киберспорт');
  const winnerMarkets = buildWinnerMarkets(catalog, detail);
  const scoreRaw = inlineStat(detail, 'score') ?? '';

  const { homeId, awayId } = resolveOlimpbetCompetitorIds({
    competitors: detail.competitors ?? [],
    homeCompetitorIds: detail.homeCompetitorIds,
  });
  const logoMap = await fetchOlimpbetCompetitorLogos(
    [homeId, awayId].filter((id): id is number => id != null),
  );
  const team1Icon = resolveOlimpbetCompetitorLogo(homeId, logoMap);
  const team2Icon = resolveOlimpbetCompetitorLogo(awayId, logoMap);

  const now = new Date();
  const kickoff = Date.parse(detail.eventDate);
  const status: GameStatus = detail.live
    ? GameStatus.IN_PROGRESS
    : Number.isFinite(kickoff) && kickoff <= Date.now()
      ? GameStatus.IN_PROGRESS
      : GameStatus.PREMATCH;

  return new GameDtoWithGroupedMarkets({
    eventId: cyberGameRefFromOlimpbetId(detail.id),
    eventName: `${team1} — ${team2}`,
    leagueName,
    team1,
    team2,
    team1Icon,
    team2Icon,
    sport,
    score: scoreRaw,
    parsedScore: buildParsedScore(detail),
    status,
    priority: detail.live ? 1 : 0,
    createdAt: now,
    updatedAt: now,
    groupedMarkets: winnerMarkets.length > 0 ? { WIN: winnerMarkets } : {},
    meta: {
      source: 'cybersport',
      olimpbetEventId: detail.id,
      commenceTime: detail.eventDate,
    },
  });
}

export async function countCyberListMarkets(detail: OlimpbetCyberEventDetail): Promise<number> {
  let count = 0;
  for (const market of detail.probabilities?.markets ?? []) {
    count += (market.probabilities ?? []).filter(isTrading).length;
  }
  return count;
}

export function cyberGameHasTeamLogos(dto: Pick<GameDtoWithGroupedMarkets, 'team1Icon' | 'team2Icon'>): boolean {
  return Boolean(dto.team1Icon?.trim() && dto.team2Icon?.trim());
}

export function cyberGameHasWinnerOdds(dto: GameDtoWithGroupedMarkets): boolean {
  const markets = dto.groupedMarkets?.WIN ?? [];
  return markets.some((market) => {
    const cf = Number(market.cf);
    return market.market?.startsWith('WIN__P') && Number.isFinite(cf) && cf > 1;
  });
}
