import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";

export const getBalance = async () => {
  const accessToken = getSessionClient();

  const { data, error } = await api.GET("/api/finance/balance", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  return data;
}; 