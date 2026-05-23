import { api } from "~/shared/api";

export const getGamesByIds = async (eventIds: string[]) => {
  const { data: games } = await api.GET(`/api/gamesByIds`, {
    params: {
      query: {
        "ids[]": eventIds,
      },
    },
  });

  return games;
};
