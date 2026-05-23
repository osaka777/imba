import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { api } from "~/shared/api";
import type { components } from "~/shared/api/types";

type FrontCreateBetDto = components["schemas"]["CreateBetDto"] & Record<string, unknown>;

export const createBet = async (
  createBetDto: FrontCreateBetDto,
) => {
  const accessToken = getSessionClient();

  if (!accessToken) {
    console.error('[createBet] No access token found');
    return false;
  }

  const { data, error } = await api.POST("/api/bet", {
    body: createBetDto as any,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    console.error('[createBet] Request failed:', error);
    throw error;
  }

  return data;
};
