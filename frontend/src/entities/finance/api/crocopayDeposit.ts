import { getSession } from "~/entities/user/lib";
import { api, components } from "~/shared/api";

export const crocopayDeposit = async (
  body: components["schemas"]["CrocopayPaymentSystemDepositDto"],
) => {
  const token = await getSession();
  return api.POST("/api/payment-system/crocopay/deposite", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
