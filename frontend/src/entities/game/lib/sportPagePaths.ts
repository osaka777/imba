export function liveAllHref(broadcastOnly = false): string {
  return broadcastOnly ? "/live?broadcast=1" : "/live";
}

export function liveSportHref(sport: string, broadcastOnly = false): string {
  const params = new URLSearchParams({ sport });
  if (broadcastOnly) params.set("broadcast", "1");
  return `/live?${params.toString()}`;
}

export function lineAllHref(): string {
  return "/line";
}

export function lineSportHref(sport: string): string {
  return `/line?sport=${encodeURIComponent(sport)}`;
}

export function liveLeagueHref(
  sport: string,
  tournament?: { tournamentId: number | null; leagueName: string } | null,
): string {
  const params = new URLSearchParams({ sport });
  if (tournament?.tournamentId != null) {
    params.set("tournament", String(tournament.tournamentId));
  } else if (tournament?.leagueName) {
    params.set("league", tournament.leagueName);
  }
  return `/live?${params.toString()}`;
}

export function lineLeagueHref(
  sport: string,
  tournament?: { tournamentId: number | null; leagueName: string } | null,
): string {
  const params = new URLSearchParams({ sport });
  if (tournament?.tournamentId != null) {
    params.set("tournament", String(tournament.tournamentId));
  } else if (tournament?.leagueName) {
    params.set("league", tournament.leagueName);
  }
  return `/line?${params.toString()}`;
}
