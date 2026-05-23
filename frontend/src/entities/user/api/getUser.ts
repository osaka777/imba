import { api } from "~/shared/api";

import { getSessionClient } from "../lib/getSessionClient";

export const getUser = async () => {
  const token = getSessionClient();

  if (!token) return null;

  const { data: user } = await api.GET("/api/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return user;
};
