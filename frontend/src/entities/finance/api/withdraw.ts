import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";
import { tOutside } from "~/shared/i18n";

export const withdraw = async (data: any) => {
  const token = getSessionClient();

  console.log('[Withdraw API] Request data:', data);

  // Всегда используем стандартный endpoint для сохранения заявок в базе данных
  const endpoint = "/api/withdraw";

  console.log('[Withdraw API] Using endpoint:', endpoint);

  try {
    const { data: response, error } = await api.POST(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    });
    
    console.log('[Withdraw API] Response:', { response, error });
    
    if (error) {
      console.error('[Withdraw API] Error details:', error);
      const raw = (error as { message?: unknown }).message;
      let message: string;
      if (typeof raw === 'string') message = raw;
      else if (Array.isArray(raw)) message = raw.map(String).join(', ');
      else if (raw && typeof raw === 'object' && 'message' in (raw as object)) {
        message = String((raw as { message: unknown }).message);
      } else {
        message = typeof error === 'string' ? error : JSON.stringify(error);
      }
      throw new Error(message);
    }
    
    return { data: response };
  } catch (err) {
    console.error('[Withdraw API] Catch block error:', err);
    throw new Error(err instanceof Error ? err.message : tOutside("common.errWithdrawUnknown"));
  }
};

function apiBase() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export type UserWithdrawal = {
  id: number;
  amount: number | string;
  currencyCode: string;
  status: string;
  type?: string;
  wallet?: string | null;
  createdAt: string;
};

export const fetchUserWithdrawals = async (): Promise<UserWithdrawal[]> => {
  const token = getSessionClient();
  if (!token) return [];

  const res = await fetch(`${apiBase()}/api/withdrawals`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || tOutside("common.errLoadWithdrawals"));
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

export const cancelWithdrawal = async (withdrawalId: number) => {
  const token = getSessionClient();
  if (!token) throw new Error(tOutside("common.errAuthRequired"));

  const res = await fetch(`${apiBase()}/api/withdrawals/${withdrawalId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || tOutside("common.errCancelWithdraw");
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(json.message)) message = json.message.join(", ");
      else if (json.message) message = json.message;
    } catch {
      /* keep text */
    }
    throw new Error(message);
  }

  return res.json() as Promise<{ success: boolean; data?: { refunded?: number } }>;
};

export const forfeitBonus = async (currencyCode: string) => {
  const token = getSessionClient();
  if (!token) throw new Error(tOutside("common.errAuthRequired"));

  const res = await fetch(`${apiBase()}/api/bonus-balance/forfeit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currencyCode }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || tOutside("common.errForfeitBonus");
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(json.message)) message = json.message.join(", ");
      else if (typeof json.message === "string") message = json.message;
    } catch {
      /* keep text */
    }
    throw new Error(message);
  }

  return res.json() as Promise<{
    ok: boolean;
    forfeitedAmount?: number;
    currencyCode?: string;
    message?: string;
  }>;
};

/** Ошибка вывода из-за неотыгранного / заблокированного бонуса */
export function isBonusWagerWithdrawError(message: string | undefined | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("отыграйте бонус")
    || lower.includes("отыграть бонус")
    || lower.includes("welcome-бонус")
    || lower.includes("welcome")
    || lower.includes("bonus_wager")
    || lower.includes("bonus_lock")
    || lower.includes("откажитесь от бонуса")
  );
}
