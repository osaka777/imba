import { getSession } from "~/entities/user/lib";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { api, components } from "~/shared/api";

export const aaioDeposit = async (
  body: components["schemas"]["AaioPaymentSystemDepositDto"],
) => {
  // Get token depending on environment
  const token = typeof window !== 'undefined'
    ? getSessionClient() || null
    : await getSession();

  if (!token) {
    throw new Error("Unauthorized: отсутствует токен авторизации");
  }

  return api.POST("/api/payment-system/aaio/deposit", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
