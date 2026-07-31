const FEED_TOKEN_KEY = "imba_feed_token";
const FEED_EXPIRES_KEY = "imba_feed_expires_at";

let inFlight: Promise<string | null> | null = null;

function readMemoryExpiry(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(FEED_EXPIRES_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function getFeedToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(FEED_TOKEN_KEY);
}

/**
 * Ensures httpOnly cookie `imba_feed` (+ memory token fallback) is valid.
 */
export async function ensureFeedSession(opts?: { force?: boolean }): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const now = Date.now();
  const expiresAt = readMemoryExpiry();
  if (!opts?.force && expiresAt - now > 60_000) {
    return getFeedToken();
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch("/api/feed/session", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    if (!res.ok) {
      throw new Error(`feed session ${res.status}`);
    }

    const data = (await res.json()) as { token?: string; expiresIn?: number };
    const token = data.token || null;
    const ttlMs = Math.max(60, Number(data.expiresIn) || 900) * 1000;
    if (token) {
      window.sessionStorage.setItem(FEED_TOKEN_KEY, token);
    }
    window.sessionStorage.setItem(FEED_EXPIRES_KEY, String(Date.now() + ttlMs));
    return token;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export function feedAuthHeaders(): HeadersInit {
  const token = getFeedToken();
  return token ? { "X-Imba-Feed-Token": token } : {};
}
