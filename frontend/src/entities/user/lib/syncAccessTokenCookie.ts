"use client";

import { getSessionClient } from "./getSessionClient";

/** Matches backend JWT lifetime (30 days). */
const ACCESS_TOKEN_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** Ensures iframe/HLS proxy requests can authenticate via cookie. */
export function syncAccessTokenCookie(token?: string | null): void {
  if (typeof document === "undefined") return;

  const value = token ?? getSessionClient();
  if (!value) return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `accessToken=${encodeURIComponent(value)}; path=/; max-age=${ACCESS_TOKEN_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}
