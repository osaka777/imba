import type { WcGroupedMarkets, WcMarketGroup } from '../wc-odds/wc-odds-markets.util';

export type ListH2hOdds = {
  home: number | null;
  draw: number | null;
  away: number | null;
};

function isH2hGroup(group: WcMarketGroup): boolean {
  return group.marketKey === 'h2h' || group.marketKey.includes('MATCH_WINNER');
}

function readH2hFromGroup(group: WcMarketGroup): ListH2hOdds | null {
  const home = group.outcomes.find((o) => o.outcomeKey === 'HOME')?.price ?? null;
  const draw = group.outcomes.find((o) => o.outcomeKey === 'DRAW')?.price ?? null;
  const away = group.outcomes.find((o) => o.outcomeKey === 'AWAY')?.price ?? null;

  if (home != null && away != null) {
    return { home, draw, away };
  }

  // Только если нет HOME/AWAY — не используем позиционный fallback (частая причина перевёрнутых кэфов).
  return null;
}

/** Согласовать кэфы со счётом: лидер матча не должен иметь завышенный кэф. */
export function alignH2hOddsWithScore(
  odds: ListH2hOdds,
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
): ListH2hOdds {
  if (
    homeScore == null
    || awayScore == null
    || homeScore === awayScore
    || odds.home == null
    || odds.away == null
  ) {
    return odds;
  }

  const homeLeads = homeScore > awayScore;
  const favoriteIsHome = odds.home < odds.away;
  const gap = Math.abs(odds.home - odds.away);

  if (homeLeads !== favoriteIsHome && gap >= 1.5) {
    return {
      home: odds.away,
      draw: odds.draw,
      away: odds.home,
    };
  }

  return odds;
}

/** Кэфы 1X2 для списка live/линии — только основной рынок, без stat/period маркетов. */
export function extractListH2hOdds(
  grouped: WcGroupedMarkets,
  score?: { homeScore: number | null; awayScore: number | null },
): ListH2hOdds {
  const candidates: WcMarketGroup[] = [];

  const primary = grouped['1X2'] ?? [];
  for (const group of primary) {
    if (isH2hGroup(group)) candidates.push(group);
  }

  if (candidates.length === 0) {
    for (const groups of Object.values(grouped)) {
      for (const group of groups) {
        if (isH2hGroup(group)) candidates.push(group);
      }
    }
  }

  for (const group of candidates) {
    const parsed = readH2hFromGroup(group);
    if (!parsed) continue;
    return alignH2hOddsWithScore(parsed, score?.homeScore, score?.awayScore);
  }

  return { home: null, draw: null, away: null };
}
