import { api } from "~/shared/api";

import { createSessionClient } from "../lib/createSessionClient";
import { createSession } from "../lib/createSession";

export const signUp = async (
  body: any,
  promo?: string,
) => {
  const { data, error } = await api.POST("/api/sign-up", { body });
  if (data) {
    await createSessionClient(data.accessToken);
    await createSession(data.accessToken);
    return;
  }
  throw error;
};
