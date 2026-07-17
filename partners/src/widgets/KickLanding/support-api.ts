export type KickSupportMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  at: number;
  status?: "sending" | "sent" | "failed";
};

export type KickSupportConfig = {
  telegramUrl: string;
  telegramLabel: string;
  supportBotUsername?: string;
};

const IMBA_ORIGIN = "https://imba.bet";
const STORAGE_KEY = "kick_landing_support_v1";

export function createSupportSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function loadSupportSession(): { sessionId: string; messages: KickSupportMessage[] } {
  if (typeof window === "undefined") {
    return { sessionId: createSupportSessionId(), messages: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessionId: createSupportSessionId(), messages: [] };
    const parsed = JSON.parse(raw) as { sessionId?: string; messages?: KickSupportMessage[] };
    return {
      sessionId: parsed.sessionId || createSupportSessionId(),
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { sessionId: createSupportSessionId(), messages: [] };
  }
}

export function saveSupportSession(data: { sessionId: string; messages: KickSupportMessage[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export async function fetchKickSupportConfig(): Promise<KickSupportConfig> {
  try {
    const res = await fetch(`${IMBA_ORIGIN}/support-chat/config`, { cache: "no-store" });
    if (!res.ok) throw new Error("config failed");
    const data = (await res.json()) as KickSupportConfig & { supportBotUsername?: string };
    return {
      telegramUrl: data.telegramUrl || "https://t.me/imbabetchat",
      telegramLabel: data.telegramLabel || "Поддержка imba.bet",
      supportBotUsername: data.supportBotUsername || "Imbabetsupport_bot",
    };
  } catch {
    return {
      telegramUrl: "https://t.me/imbabetchat",
      telegramLabel: "Поддержка imba.bet",
      supportBotUsername: "Imbabetsupport_bot",
    };
  }
}

export async function sendKickSupportMessage(payload: {
  sessionId: string;
  message: string;
  pageUrl?: string;
}): Promise<{ ok: boolean; telegramUrl?: string; error?: string }> {
  try {
    const res = await fetch(`${IMBA_ORIGIN}/support-chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId: payload.sessionId,
        message: payload.message,
        pageUrl: payload.pageUrl || "https://kick.imba.bet/",
        pageTitle: "Kick × imba Partners",
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string; telegramUrl?: string } | null;
      return {
        ok: false,
        error: data?.error || "Не удалось отправить",
        telegramUrl: data?.telegramUrl,
      };
    }
    return res.json() as Promise<{ ok: boolean; telegramUrl?: string }>;
  } catch {
    return { ok: false, error: "Нет связи с чатом поддержки" };
  }
}

export async function pollKickSupportMessages(
  sessionId: string,
  since = 0,
): Promise<KickSupportMessage[]> {
  try {
    const params = new URLSearchParams({ sessionId, since: String(since) });
    const res = await fetch(`${IMBA_ORIGIN}/support-chat/messages?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: KickSupportMessage[] };
    return (data.messages || []).map((item) => ({
      id: item.id || `${item.at}-${item.role}`,
      role: item.role === "user" ? "user" : "agent",
      text: item.text,
      at: item.at,
    }));
  } catch {
    return [];
  }
}
