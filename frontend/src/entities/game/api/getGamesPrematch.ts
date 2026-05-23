import { api } from "~/shared/api";

type GetGame = {
  limit: number;
  offset?: number;
};

export const getGamesPrematch = async ({ limit, offset = 0 }: GetGame) => {
  const { data: games } = await api.GET("/api/games/prematch", {
    params: {
      query: {
        limit,
        offset,
      },
    },
  });
  return games;
};
