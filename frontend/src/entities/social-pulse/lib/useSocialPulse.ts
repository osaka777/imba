"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fetchSocialPulse,
  type SocialPulseItem,
} from "~/entities/social-pulse/api/client";

const POLL_MS = 30_000;

export function useSocialPulse() {
  const [items, setItems] = useState<SocialPulseItem[]>([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async (signal?: AbortSignal) => {
      try {
        const payload = await fetchSocialPulse(signal);
        if (active) setItems(payload.enabled ? payload.items : []);
      } catch {
        if (active) setItems([]);
      }
    };

    void load(controller.signal);
    const timer = window.setInterval(() => void load(), POLL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return useMemo(
    () => new Map(items.map((item) => [item.event.id, item] as const)),
    [items],
  );
}
