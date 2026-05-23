import { api } from "~/shared/api";

type GetGame = {
  limit: number;
  markets?: Array<string>;
  offset?: number;
  sport: string;
  subcategory: string;
};

export const getGamesWithSportSubcategoryPrematch = async ({
  limit,
  markets,
  offset = 0,
  sport,
  subcategory,
}: GetGame) => {
  const { data: games, error } = await api.GET("/api/games/prematch/{sport}/{subcategory}", {
    params: {
      path: {
        sport,
        subcategory,
      },
      query: {
        limit,
        "markets[]": markets,
        offset,
      },
    },
  });
  
  if (error) throw error;
  return games;
}; 