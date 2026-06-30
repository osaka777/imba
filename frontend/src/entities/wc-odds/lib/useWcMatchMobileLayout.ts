"use client";

import { useEffect, useState } from "react";

import { WC_MOBILE_DEFAULT_OPEN_CANONICAL_COUNT } from "~/entities/wc-odds/lib/wcOddsCategories";

/** Align with WcMatchPage single-column breakpoint. */
export const WC_MATCH_MOBILE_MQ = "(max-width: 630px)";

export const WC_MATCH_MOBILE_OPEN_CATEGORIES = WC_MOBILE_DEFAULT_OPEN_CANONICAL_COUNT;

export function useWcMatchMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(WC_MATCH_MOBILE_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(WC_MATCH_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
