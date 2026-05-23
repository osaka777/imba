import { getSession } from "~/entities/user/lib";
import { api, components } from "~/shared/api";

export const greengoDepositNotification = async (
  body: components["schemas"]["GreengoPaymentSystemDepositNotificationDto"],
): Promise<{ data: any; error: any }> => {
  const token = await getSession();
  return api.POST("/api/payment-system/greengo/check/deposit", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
