import { getSession } from "~/entities/user/lib";
import { api, components } from "~/shared/api";

export const bovaDeposit = async (
  body: components["schemas"]["BovaPaymentSystemDepositDto"],
) => {
  const token = await getSession();
  return api.POST("/api/payment-system/bova/deposit", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
