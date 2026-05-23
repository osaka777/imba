import { api } from "~/shared/api";

export const getGamesByParams = async (
  query:
    | {
        eventName?: string;
        league?: string;
      }
    | undefined,
) => {
  const { data: games } = await api.GET(`/api/find`, {
    params: {
      query,
    },
  });

  return games;
};
