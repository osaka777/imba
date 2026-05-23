import { api } from "~/shared/api";

type GetGame = {
  limit: number;
  markets?: Array<string>;
  offset?: number;
  sport: string;
};

export const getGamesWithSport = async ({
  limit,
  markets,
  offset = 0,
  sport,
}: GetGame) => {
  const { data: games } = await api.GET("/api/games/live/{sport}", {
    params: {
      path: {
        sport,
      },
      query: {
        limit,
        "markets[]": markets,
        offset,
      },
    },
  });
  return games;
};
