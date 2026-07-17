"use client";

import { useEffect, useState } from "react";

import type { KickPartnerWidget } from "~/entities/kick/api/client";

function readPartnerTagCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )partnerTag=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function usePartnerKickStream() {
  const [partner, setPartner] = useState<KickPartnerWidget | null>(null);

  useEffect(() => {
    const tag = readPartnerTagCookie();
    if (!tag) {
      setPartner(null);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/kick/partners/by-tag/${encodeURIComponent(tag)}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as KickPartnerWidget;
        if (!cancelled) {
          setPartner(data?.found && data.isLive && data.channelSlug ? data : null);
        }
      } catch {
        if (!cancelled) setPartner(null);
      }
    };

    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return partner;
}
