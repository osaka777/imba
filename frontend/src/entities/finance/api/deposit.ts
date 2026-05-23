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
};

export type MyKztForeignCardOrder = {
  id: number;
  /** Публичный номер заявки для UI (не совпадает с порядковым id в БД) */
  publicOrderId?: number;
  amount: number;
  currency: string;
  method: string;
  imageUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'processing';
  createdAt: string;
  reason?: string;
};

export type ManualForeignCardHistoryItem = {
  id: number;
  publicOrderId?: number;
  amount: number;
  currency: "KZT" | "RUB";
  method: "KZT_FOREIGN_CARD" | "RUB_FOREIGN_CARD";
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

export const getManualDepositConfig = async (currency: 'KZT' | 'RUB') => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET(`/api/deposit/manual-deposit/config?currency=${currency}`, {
    headers: authHeaders(),
  });
};

export const initManualForeignCardOrder = async (body: {
  amount: number;
  currency: 'KZT' | 'RUB';
  method: 'KZT_FOREIGN_CARD' | 'RUB_FOREIGN_CARD';
  source?: string;
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
  method?: 'KZT_FOREIGN_CARD' | 'RUB_FOREIGN_CARD';
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

export const getMyRubForeignCardOrder = async () => {
  const token = getSessionClient();
  if (!token) throw new Error('Не авторизован');
  return api.GET('/api/deposit/rub-foreign-card/me', {
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
