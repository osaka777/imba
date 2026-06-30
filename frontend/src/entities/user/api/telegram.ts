const apiBase = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export type TelegramLinkTokenResponse = {
  deepLink: string;
  botUsername: string;
  expiresAt: string;
};

export type ForgotPasswordResponse = {
  ok: true;
  channel: "telegram" | "none";
};

export type TelegramNotifications = {
  linked: boolean;
  deposit: boolean;
  withdraw: boolean;
  bets: boolean;
  promo: boolean;
  twoFaEnabled: boolean;
  liveMatch: boolean;
  preMatch: boolean;
};

export async function createTelegramLinkToken(token: string | false): Promise<TelegramLinkTokenResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/telegram/link-token`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  return parseJson(res);
}

export async function unlinkTelegram(token: string | false): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/telegram`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    await parseJson(res);
  }
}

export async function getTelegramNotifications(token: string | false): Promise<TelegramNotifications> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/telegram/notifications`, {
    headers,
    credentials: "include",
  });
  return parseJson(res);
}

export async function updateTelegramNotifications(
  token: string | false,
  prefs: Partial<Pick<TelegramNotifications, "deposit" | "withdraw" | "bets" | "promo" | "liveMatch" | "preMatch">>,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/telegram/notifications`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify(prefs),
  });
  await parseJson(res);
}

export async function updateTelegram2fa(
  token: string | false,
  enabled: boolean,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/telegram/2fa`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify({ enabled }),
  });
  await parseJson(res);
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  const res = await fetch(`${apiBase()}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseJson(res);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    await parseJson(res);
  }
}
