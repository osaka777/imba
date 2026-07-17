import type { WcOddsBetService } from '~/integrations/wc-odds/wc-odds-bet.service';

export type FeaturedLiveMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  sport: string;
  phase: string;
};

export async function findFeaturedLiveMatch(
  wcOddsBet: WcOddsBetService,
): Promise<FeaturedLiveMatch | null> {
  for (const sport of ['cs2', 'dota2'] as const) {
    try {
      const events = await wcOddsBet.listLiveEvents({ sport, limit: 8 });
      const match =
        events.find((event) => event.phase === 'live' && event.bettingOpen)
        ?? events.find((event) => event.phase === 'live')
        ?? events[0];

      if (match) {
        return {
          id: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeScore: match.homeScore ?? null,
          awayScore: match.awayScore ?? null,
          sport,
          phase: match.phase,
        };
      }
    } catch {
      /* try next sport */
    }
  }
  return null;
}
