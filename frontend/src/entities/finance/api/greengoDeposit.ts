import { getSession } from "~/entities/user/lib";
import { api } from "~/shared/api";

export const greengoDeposit = async (body: {
  amount: number;
  currency: string;
}) => {
  const token = await getSession();
  return api.POST("/api/payment-system/greengo/deposit", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// export const greengoDeposit = async (
//     body: components["schemas"]["GreengoPaymentSystemDepositNotificationDto"],
//   ) => {
//     const token = await getSession();
//     return api.POST("/api/payment-system/bova/deposit", {
//       body,
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });
//   };
