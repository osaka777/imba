"use client";

import { useEffect, useState } from "react";

import { WC_MOBILE_DEFAULT_OPEN_CANONICAL_COUNT } from "~/entities/wc-odds/lib/wcOddsCategories";

/** Align with balanced odds columns breakpoint. */
export const WC_MATCH_MOBILE_MQ = "(max-width: 479px)";

/** Single-column odds grid — tablets portrait and phones. */
export const WC_MATCH_NARROW_MQ = "(max-width: 767px)";

export const WC_MATCH_MOBILE_OPEN_CATEGORIES = WC_MOBILE_DEFAULT_OPEN_CANONICAL_COUNT;

function useMatchMedia(mq: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(mq).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(mq);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mq]);

  return matches;
}

export function useWcMatchMobileLayout(): boolean {
  return useMatchMedia(WC_MATCH_MOBILE_MQ);
}

export function useWcMatchNarrowLayout(): boolean {
  return useMatchMedia(WC_MATCH_NARROW_MQ);
}
