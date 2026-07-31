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
  promoCode?: string;
  subs?: {
    sub1?: string;
    sub2?: string;
    sub3?: string;
    sub4?: string;
    sub5?: string;
  };
};

async function persistSession(accessToken: string) {
  await createSessionClient(accessToken);
  try {
    await createSession(accessToken);
  } catch (error) {
    // Client localStorage + cookie already set; httpOnly cookie is best-effort.
    console.warn("createSession httpOnly cookie failed after sign-up:", error);
  }
}

export const signUp = async (body: SignUpBody) => {
  const { data, error } = await api.POST("/api/sign-up", { body });
  if (data?.accessToken) {
    await persistSession(data.accessToken);
    return;
  }
  throw error;
};
