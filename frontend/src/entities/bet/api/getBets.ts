import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";
import { components } from "~/shared/api";

export const getBets = async (status: null | string = null): Promise<{ express: components["schemas"]["ExpressBetDto"][], ordinar: components["schemas"]["BetDto"][] }> => {
  const accessToken = getSessionClient();

  if (!accessToken) {
    return { express: [], ordinar: [] };
  }

  try {
  const { data, error } = await api.GET("/api/bet", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      query: {
        status,
      },
    },
  });
    
    if (error) {
      console.error('Error fetching bets:', error);
      return { express: [], ordinar: [] };
    }
    
    return data || { express: [], ordinar: [] };
  } catch (error) {
    console.error('Error in getBets:', error);
    return { express: [], ordinar: [] };
  }
};
