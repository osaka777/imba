import { getSession } from "~/entities/user/lib";
import { api } from "~/shared/api";

interface PinCashWithdrawDto {
  amount: number;
  currency: string;
  method: string;
  wallet: string;
}

export const pincashWithdraw = async (body: PinCashWithdrawDto): Promise<{ data: any; error: any }> => {
  const token = await getSession();
  return api.POST("/api/payment-system/pincash/withdraw", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}; 