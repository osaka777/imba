"use client";

import { useEffect } from "react";

export const TELEGRAM_LINKED_EVENT = "imba:telegram-linked";

export type TelegramLinkedDetail = {
  username?: string | null;
};

export function dispatchTelegramLinked(detail: TelegramLinkedDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TELEGRAM_LINKED_EVENT, { detail }));
}

export function useTelegramLinkEvent(onLinked: (detail: TelegramLinkedDetail) => void) {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TelegramLinkedDetail>).detail ?? {};
      onLinked(detail);
    };
    window.addEventListener(TELEGRAM_LINKED_EVENT, handler);
    return () => window.removeEventListener(TELEGRAM_LINKED_EVENT, handler);
  }, [onLinked]);
}
