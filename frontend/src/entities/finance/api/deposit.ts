import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";

export interface DepositDto {
  amount: number;
  currency: string;
  token?: string;
  email?: string;
}

export interface NirvanaPayDepositDto {
  amount: number;
  currency: string;
  tokenCode?: 'Kaspi Bank' | 'Mbank (transfer to Kyrgyzstan)';
  redirectURL: string;
  siteName: string;
  callbackURL: string;
  externalID: string;
  userInfo?: {
    id?: string;
    ip?: string;
    userAgent?: string;
    email?: string;
  };
}

export type ManualDepositConfigItem = {
  cardNumber: string;
  holderName: string;
  bankName: string;
  qrImageUrl?: string;
  minAmount: number;
  rubPerBrl?: number;
};

export type ManualForeignCardMethod =
  | "KZT_FOREIGN_CARD"
  | "KZT_KASPI"
  | "RUB_FOREIGN_CARD"
  | "RUB_SBERBANK";

export type MyKztForeignCardOrder = {
  id: number;
  /** Публичный номер заявки для UI (не совпадает с порядковым id в БД) */
  publicOrderId?: number;
  amount: number;
  currency: string;
  method: string;
  imageUrl?: string;
  brlAmount?: number;
  rubPerBrl?: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'processing';
  createdAt: string;
  reason?: string;
};

export type ManualForeignCardHistoryItem = {
  id: number;
  publicOrderId?: number;
  amount: number;
  currency: "KZT" | "RUB";
  method: ManualForeignCardMethod;
  status: "pending" | "processing" | "approved" | "rejected" | "expired";
  createdAt: string;
  reason?: string;
  canRetry: boolean;
};

const apiBase = () =>
  process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';

const authHeaders = () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return { Authorization: `Bearer ${token}` };
};

export const getManualDepositConfig = async (currency: 'KZT' | 'KZT_KASPI' | 'RUB' | 'RUB_SBERBANK') => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET(`/api/deposit/manual-deposit/config?currency=${currency}`, {
    headers: authHeaders(),
  });
};

export const initManualForeignCardOrder = async (body: {
  amount: number;
  currency: 'KZT' | 'RUB';
  method: ManualForeignCardMethod;
  source?: string;
  voucher?: string;
}) => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  const res = await fetch(`${apiBase()}/api/deposit/manual-foreign-card/init`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    } as any,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Не удалось создать заявку');
  }
  return res.json() as Promise<{
    ok: boolean;
    order: { id: number; publicOrderId?: number };
  }>;
};

export const cancelManualForeignCardOrder = async (body: {
  orderId?: number;
  method?: ManualForeignCardMethod;
}) => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  const res = await fetch(`${apiBase()}/api/deposit/manual-foreign-card/cancel`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    } as any,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Не удалось отменить заявку');
  }
  return res.json() as Promise<{ ok: boolean; cancelled: boolean; orderId?: number }>;
};

export const getManualForeignCardHistory = async () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET('/api/deposit/manual-foreign-card/history', {
    headers: authHeaders(),
  });
};

export const getMyKztForeignCardOrder = async () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET('/api/deposit/kzt-foreign-card/me', {
    headers: authHeaders(),
  });
};

export const getMyKztKaspiOrder = async () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET('/api/deposit/kzt-kaspi/me', {
    headers: authHeaders(),
  });
};

export const getMyRubForeignCardOrder = async () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET('/api/deposit/rub-foreign-card/me', {
    headers: authHeaders(),
  });
};

export const getMyRubSberbankOrder = async () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET('/api/deposit/rub-sberbank/me', {
    headers: authHeaders(),
  });
};

// NirvanaPay create payin
export const createNirvanaPayDeposit = async (body: NirvanaPayDepositDto) => {
  const token = getSessionClient();
  if (!token) {
    throw new Error('Не авторизован: отсутствует токен. Пожалуйста, выполните вход.');
  }
  return api.POST("/api/nirvanapay-payin/create", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const createDeposit = async (body: DepositDto) => {
  const token = getSessionClient();
  if (!token) {
    throw new Error('Не авторизован: отсутствует токен. Пожалуйста, выполните вход.');
  }
  return api.POST("/api/deposit", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const uploadKztForeignCardReceipt = async (form: FormData) => {
  const token = getSessionClient();
  if (!token) {
    throw new Error('Не авторизован: отсутствует токен. Пожалуйста, выполните вход.');
  }
  const res = await fetch(`${apiBase()}/api/deposit/kzt-foreign-card`, {
    method: 'POST',
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    } as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Ошибка загрузки чека');
  }
  try {
    return await res.json();
  } catch {
    return { ok: true } as any;
  }
};

export const uploadKztKaspiReceipt = async (form: FormData) => {
  const token = getSessionClient();
  if (!token) {
    throw new Error('Не авторизован: отсутствует токен. Пожалуйста, выполните вход.');
  }
  const res = await fetch(`${apiBase()}/api/deposit/kzt-kaspi`, {
    method: 'POST',
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    } as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Ошибка загрузки чека');
  }
  try {
    return await res.json();
  } catch {
    return { ok: true } as any;
  }
};

export const uploadRubForeignCardReceipt = async (form: FormData) => {
  const token = getSessionClient();
  if (!token) {
    throw new Error('Не авторизован: отсутствует токен. Пожалуйста, выполните вход.');
  }
  const res = await fetch(`${apiBase()}/api/deposit/rub-foreign-card`, {
    method: 'POST',
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    } as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Ошибка загрузки чека');
  }
  try {
    return await res.json();
  } catch {
    return { ok: true } as any;
  }
};

export const uploadRubSberbankReceipt = async (form: FormData) => {
  const token = getSessionClient();
  if (!token) {
    throw new Error('Не авторизован: отсутствует токен. Пожалуйста, выполните вход.');
  }
  const res = await fetch(`${apiBase()}/api/deposit/rub-sberbank`, {
    method: 'POST',
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    } as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Ошибка загрузки чека');
  }
  try {
    return await res.json();
  } catch {
    return { ok: true } as any;
  }
};

// Admin endpoints
export type AdminDeposit = {
  id: number;
  userId: number;
  email?: string;
  amount: number;
  currency: string;
  method: string;
  imageUrl?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
};

export const adminListDeposits = async (status: 'pending' | 'approved' | 'rejected' = 'pending') => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET(`/api/admin/deposits?status=${status}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const adminApproveDeposit = async (id: number) => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.POST(`/api/admin/deposits/${id}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const adminRejectDeposit = async (id: number) => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.POST(`/api/admin/deposits/${id}/reject`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export type UsdtTrc20Config = {
  walletAddress: string;
  network: string;
  token: string;
  minAmount: number;
  qrImageUrl?: string;
};

export type UsdtTrc20Order = {
  id: number;
  publicOrderId?: number;
  amount: number;
  payAmount?: number;
  walletAddress?: string;
  network?: string;
  currency: string;
  method: string;
  status: string;
  txHash?: string;
  createdAt: string;
};

export const getUsdtTrc20Config = async (): Promise<UsdtTrc20Config> => {
  const { data } = await api.GET('/api/deposit/usdt-trc20/config', {
    headers: authHeaders(),
  });
  return data as UsdtTrc20Config;
};

export const initUsdtTrc20Order = async (amount: number, source = 'deposit-modal') => {
  const res = await fetch(`${apiBase()}/api/deposit/usdt-trc20/init`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    } as any,
    body: JSON.stringify({ amount, source }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Не удалось создать заявку');
  }
  return res.json() as Promise<{ ok: boolean; order: UsdtTrc20Order }>;
};

export const getMyUsdtTrc20Order = async (): Promise<UsdtTrc20Order | Record<string, never>> => {
  const { data } = await api.GET('/api/deposit/usdt-trc20/me', {
    headers: authHeaders(),
  });
  return (data || {}) as UsdtTrc20Order | Record<string, never>;
};

export const getUsdtTrc20OrderStatus = async (orderId: number): Promise<UsdtTrc20Order> => {
  const { data } = await api.GET(`/api/deposit/usdt-trc20/order/${orderId}`, {
    headers: authHeaders(),
  });
  return data as UsdtTrc20Order;
};

export const cancelUsdtTrc20Order = async (orderId?: number) => {
  const res = await fetch(`${apiBase()}/api/deposit/usdt-trc20/cancel`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    } as any,
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Не удалось отменить заявку');
  }
  return res.json();
};
