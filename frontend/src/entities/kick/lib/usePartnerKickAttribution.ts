"use client";

import { useEffect, useState } from "react";

import type { KickPartnerWidget } from "~/entities/kick/api/client";

const TAG_RE = /^[0-9a-f-]{36}$/i;

function readPartnerTagFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )partnerTag=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function readPartnerTagFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const tag = new URLSearchParams(window.location.search).get("tag")?.trim();
  if (!tag || !TAG_RE.test(tag)) return null;
  return tag;
}

function isKickAttribution(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("sub1")?.toLowerCase() === "kick") return true;

  const subs = document.cookie.match(/(?:^|; )affiliateSubs=([^;]*)/)?.[1];
  if (!subs) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(subs)) as { sub1?: string };
    return parsed.sub1?.toLowerCase() === "kick";
  } catch {
    return false;
  }
}

function persistPartnerTagCookie(tag: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `partnerTag=${encodeURIComponent(tag)}; Max-Age=${60 * 60 * 24 * 90}; Path=/; SameSite=Lax${secure}`;
}

export function usePartnerKickAttribution(requireLive = false) {
  const [partner, setPartner] = useState<KickPartnerWidget | null>(null);
  const [isKickTraffic, setIsKickTraffic] = useState(false);

  useEffect(() => {
    const tagFromUrl = readPartnerTagFromUrl();
    if (tagFromUrl) persistPartnerTagCookie(tagFromUrl);

    const tag = tagFromUrl ?? readPartnerTagFromCookie();
    const kickTraffic = isKickAttribution();

    setIsKickTraffic(kickTraffic);

    if (!tag || !kickTraffic) {
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
          const ok = data?.found && data.channelSlug && (!requireLive || data.isLive);
          setPartner(ok ? data : null);
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
  }, [requireLive]);

  return { partner, isKickTraffic };
}
