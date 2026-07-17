"use client";

import { syncAccessTokenCookie } from "./syncAccessTokenCookie";

export async function createSessionClient(accessToken: string) {
  try {
    localStorage.setItem("accessToken", accessToken);
    syncAccessTokenCookie(accessToken);
  } catch (error) {
    console.error("createSessionClient: Error saving token:", error);
  }
}