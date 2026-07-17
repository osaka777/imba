import { deviceIdHeaders } from "~/shared/lib/deviceId";

import { createSessionClient } from "../lib/createSessionClient";
import { createSession } from "../lib/createSession";

export type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export type TelegramAuthMode = "login" | "register";

export type TelegramAuthResult =
  | { kind: "success"; isNewUser: boolean }
  | { kind: "profile"; profileToken: string };

function apiOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

async function persistAccessToken(accessToken: string): Promise<void> {
  await createSessionClient(accessToken);
  await createSession(accessToken);
}

export async function authenticateWithTelegram(
  user: TelegramWidgetUser,
  mode: TelegramAuthMode,
  extras?: {
    currencyCode?: string;
    birthDate?: string;
    tag?: string;
    promoCode?: string;
  },
): Promise<TelegramAuthResult> {
  const res = await fetch(`${apiOrigin()}/api/auth/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...deviceIdHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({
      ...user,
      mode,
      ...extras,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : res.status === 404
          ? "Аккаунт не найден. Зарегистрируйтесь через Telegram."
          : "Не удалось войти через Telegram";
    throw new Error(message);
  }

  if (data.requiresProfile && data.profileToken) {
    return { kind: "profile", profileToken: data.profileToken };
  }

  if (data.accessToken) {
    await persistAccessToken(data.accessToken);
    return { kind: "success", isNewUser: Boolean(data.isNewUser) };
  }

  throw new Error("Unexpected Telegram auth response");
}

export async function completeTelegramProfile(body: {
  profileToken: string;
  currencyCode: string;
  birthDate: string;
  tag?: string;
  promoCode?: string;
}): Promise<void> {
  const res = await fetch(`${apiOrigin()}/api/auth/telegram/complete-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...deviceIdHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Не удалось завершить регистрацию",
    );
  }

  if (data.accessToken) {
    await persistAccessToken(data.accessToken);
    return;
  }

  throw new Error("Unexpected Telegram profile response");
}

export function getTelegramBotUsername(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    || process.env.TELEGRAM_BOT_USERNAME
    || "imbabetalert_bot";
}

type TelegramAuthConfig = {
  botUsername: string;
  botId: string;
};

let cachedAuthConfig: TelegramAuthConfig | null = null;

export async function getTelegramAuthConfig(): Promise<TelegramAuthConfig> {
  if (cachedAuthConfig) return cachedAuthConfig;

  const res = await fetch(`${apiOrigin()}/api/auth/telegram/config`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load Telegram auth config");
  }

  const data = await res.json() as TelegramAuthConfig;
  cachedAuthConfig = {
    botUsername: data.botUsername || getTelegramBotUsername(),
    botId: String(data.botId),
  };
  return cachedAuthConfig;
}
