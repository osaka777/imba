import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { tOutside } from "~/shared/i18n";

export type SupportConfig = {
  telegramUrl: string;
  telegramLabel: string;
  botUsername: string;
  supportBotUsername?: string;
};

export type SupportChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  at: number;
  status?: "sending" | "sent" | "failed";
  imageUrl?: string;
};

export type SupportSessionStatus = "online" | "delivered" | "reading";

export type SupportSessionMeta = {
  closed?: boolean;
  closedAt?: number | null;
  tag?: string;
  csat?: number | null;
  awaitingCsat?: boolean;
};

export type SupportAppeal = {
  sessionId: string;
  tag?: string;
  preview?: string;
  updatedAt?: number;
  closed?: boolean;
  csat?: number | null;
  awaitingCsat?: boolean;
};

export type SupportStats = {
  avgResponseMin: number;
  under5mPct: number;
  openCount: number;
  pendingOver10m: number;
  avgCsat?: number | null;
};

export type SendSupportMessagePayload = {
  sessionId: string;
  message: string;
  pageUrl?: string;
  pageTitle?: string;
  imageUrl?: string;
};

const apiBase = () => process.env.NEXT_PUBLIC_HOST || "https://imba.bet";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getSessionClient();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function createSupportSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function fetchSupportConfig(): Promise<SupportConfig> {
  const res = await fetch(`${apiBase()}/support-chat/config`, { cache: "no-store" });
  if (!res.ok) {
    return {
      botUsername: "imbabetalert_bot",
      telegramLabel: tOutside("support.chatLabel"),
      telegramUrl: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL || "https://t.me/imbabetchat",
    };
  }
  return res.json() as Promise<SupportConfig>;
}

export async function fetchSupportSession(): Promise<{
  sessionId: string | null;
  messages: SupportChatMessage[];
  meta: SupportSessionMeta | null;
}> {
  const res = await fetch(`${apiBase()}/support-chat/session`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) return { sessionId: null, messages: [], meta: null };
  const data = (await res.json()) as {
    sessionId?: string | null;
    messages?: SupportChatMessage[];
    meta?: SupportSessionMeta | null;
  };
  return {
    sessionId: data.sessionId || null,
    meta: data.meta || null,
    messages: (data.messages || []).map((item) => ({
      id: item.id || `${item.at}-${item.role}`,
      role: item.role === "user" ? "user" : "agent",
      text: item.text,
      at: item.at,
      imageUrl: item.imageUrl,
    })),
  };
}

export async function fetchSupportMessages(
  sessionId: string,
  since = 0,
): Promise<{
  messages: SupportChatMessage[];
  status: SupportSessionStatus;
  meta: SupportSessionMeta | null;
}> {
  const params = new URLSearchParams({ sessionId, since: String(since) });
  const res = await fetch(`${apiBase()}/support-chat/messages?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return { messages: [], status: "online", meta: null };
  const data = (await res.json()) as {
    messages?: SupportChatMessage[];
    status?: SupportSessionStatus;
    meta?: SupportSessionMeta | null;
  };
  return {
    status: data.status || "online",
    meta: data.meta || null,
    messages: (data.messages || []).map((item) => ({
      id: item.id || `${item.at}-${item.role}`,
      role: item.role === "user" ? "user" : "agent",
      text: item.text,
      at: item.at,
      imageUrl: item.imageUrl,
    })),
  };
}

export async function fetchSupportStats(): Promise<SupportStats> {
  const res = await fetch(`${apiBase()}/support-chat/stats`, { cache: "no-store" });
  if (!res.ok) {
    return { avgResponseMin: 3, under5mPct: 0, openCount: 0, pendingOver10m: 0 };
  }
  return res.json() as Promise<SupportStats>;
}

export async function fetchSupportAppeals(): Promise<SupportAppeal[]> {
  const res = await fetch(`${apiBase()}/support-chat/appeals`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { appeals?: SupportAppeal[] };
  return data.appeals || [];
}

export async function submitSupportCsat(
  sessionId: string,
  rating: number,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${apiBase()}/support-chat/csat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ sessionId, rating }),
  });
  return { ok: res.ok };
}

export async function uploadSupportImage(
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const body = new FormData();
  body.append("file", file, file.name || "screenshot.jpg");
  const res = await fetch(`${apiBase()}/support-chat/upload`, {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    url?: string;
    error?: string;
  } | null;
  if (!res.ok || !data?.ok || !data.url) {
    return { ok: false, error: data?.error || tOutside("common.errLoadScreenshot") };
  }
  return { ok: true, url: data.url };
}

export async function sendSupportMessage(
  payload: SendSupportMessagePayload,
): Promise<{ ok: boolean; telegramUrl?: string; error?: string }> {
  const res = await fetch(`${apiBase()}/support-chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      telegramUrl?: string;
    } | null;
    return {
      ok: false,
      error: data?.error || tOutside("common.errSendMessage"),
      telegramUrl: data?.telegramUrl,
    };
  }

  return res.json() as Promise<{ ok: boolean; telegramUrl?: string; error?: string }>;
}

export function buildTelegramDeepLink(botUsername: string) {
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=support`;
}
