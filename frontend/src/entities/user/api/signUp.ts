import { api } from "~/shared/api";

import { createSessionClient } from "../lib/createSessionClient";
import { createSession } from "../lib/createSession";

export type SignUpBody = {
  email: string;
  password: string;
  currencyCode: string;
  phone: string;
  birthDate: string;
  tag?: string;
};

export const signUp = async (body: SignUpBody, promo?: string) => {
  const { data, error } = await api.POST("/api/sign-up", { body });
  if (data) {
    await createSessionClient(data.accessToken);
    await createSession(data.accessToken);
    return;
  }
  throw error;
};
