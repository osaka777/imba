"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCybersportTournaments } from "~/entities/cybersport/api/client";
import { apiSportToDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { cyberTournamentPageHref } from "~/entities/cybersport/lib/cyberTournamentPaths";
import { isEsportsSport } from "~/entities/cybersport/lib/isEsportsSport";

export type CybersportLeagueItem = {
  leagueName: string;
  count: number;
  tournamentId: number | null;
  tournamentSlug: string | null;
  href: string | null;
};

export function useCybersportLeagues(
  sport: string | undefined,
  mode: "live" | "line",
) {
  return useQuery({
    queryKey: ["cybersport-leagues", mode, sport],
    queryFn: async (): Promise<CybersportLeagueItem[]> => {
      const tournaments = await fetchCybersportTournaments(sport!);
      const discipline = apiSportToDisciplineSlug(sport!);

      return tournaments
        .map((row) => {
          const count = mode === "live" ? row.liveCount : row.lineCount;
          const href =
            discipline && count > 0
              ? cyberTournamentPageHref(discipline, row.slug)
              : null;
          return {
            leagueName: row.name,
            count,
            tournamentId: row.id,
            tournamentSlug: row.slug,
            href,
          };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count || a.leagueName.localeCompare(b.leagueName, "ru"));
    },
    enabled: Boolean(sport && isEsportsSport(sport)),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 5,
  });
}
