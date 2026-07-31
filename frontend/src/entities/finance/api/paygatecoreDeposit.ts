import { getSessionClient } from "~/entities/user/lib";
import { tOutside } from "~/shared/i18n";

const apiBase = () =>
  process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";

const authHeaders = () => {
  const token = getSessionClient();
  if (!token) throw new Error(tOutside("common.errUnauthorized"));
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

export type PayGateCoreRequisites = {
  cardNumber?: string;
  ownerName?: string;
  bankName?: string;
  phoneNumber?: string;
  paymentLink?: string;
  countryName?: string;
};

export type PayGateCoreDepositResponse = {
  ok: boolean;
  resumed?: boolean;
  depositId: number;
  publicOrderId: number;
  amount: number;
  currency: string;
  expiresAt?: string;
  requisites: PayGateCoreRequisites;
  paygatecoreId?: number;
};

export type PayGateCoreActiveResponse =
  | ({ ok: true; active: true } & PayGateCoreDepositResponse)
  | { ok: true; active: false };

export type PayGateCoreDepositStatus = {
  depositId: number;
  publicOrderId?: number;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "approved" | "rejected";
  expiresAt?: string;
  requisites?: PayGateCoreRequisites | null;
  paygatecoreStatus?: string;
  paidAmount?: number;
};

export const getMyPayGateCoreDeposit = async (): Promise<PayGateCoreActiveResponse> => {
  const res = await fetch(`${apiBase()}/api/payment-system/paygatecore/active`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || tOutside("common.errGetRequest"));
  }
  return data as PayGateCoreActiveResponse;
};

export const createPayGateCoreDeposit = async (body: {
  amount: number;
  currency: string;
  voucher?: string;
  source?: string;
}): Promise<PayGateCoreDepositResponse> => {
  const res = await fetch(`${apiBase()}/api/payment-system/paygatecore/deposit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
      data?.error ||
      tOutside("common.errCreateRequest");
    throw new Error(String(msg));
  }
  return data as PayGateCoreDepositResponse;
};

export const getPayGateCoreDepositStatus = async (
  depositId: number,
): Promise<PayGateCoreDepositStatus> => {
  const res = await fetch(
    `${apiBase()}/api/payment-system/paygatecore/status?depositId=${depositId}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || tOutside("common.errGetStatus"));
  }
  return data as PayGateCoreDepositStatus;
};

export const cancelPayGateCoreDeposit = async (depositId: number) => {
  const res = await fetch(`${apiBase()}/api/payment-system/paygatecore/cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ depositId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || tOutside("common.errCancelRequest"));
  }
  return data;
};
