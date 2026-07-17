"use client";

import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { syncAccessTokenCookie } from "~/entities/user/lib/syncAccessTokenCookie";

export type BroadcastAuthMode = "login" | "register";

export function isBroadcastAuthed(): boolean {
  const token = getSessionClient();
  if (token) syncAccessTokenCookie(token);
  return Boolean(token);
}

export function requestBroadcastAuth(mode: BroadcastAuthMode = "register"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("imba:open-auth", { detail: { mode } }),
  );
}

export function broadcastAuthHeaders(): HeadersInit {
  const token = getSessionClient();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
