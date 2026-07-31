"use client";

import { useEffect, useState } from "react";

import { fetchWcLiveTracker } from "~/entities/wc-odds/api/client";

/** First attempts are aggressive so tracker appears without a long wait. */
const RETRY_MS = [1_500, 2_500, 4_000, 8_000, 12_000] as const;

/** Lazily probes the 1win Live Tracker while the match is live; retries until found. */
export function useWcLiveTracker(eventRef: null | string, isLive: boolean): null | string {
  const [trackerUrl, setTrackerUrl] = useState<null | string>(null);

  useEffect(() => {
    setTrackerUrl(null);
    if (!isLive || !eventRef) return undefined;

    let cancelled = false;
    let timer: number | undefined;
    let attempt = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetchWcLiveTracker(eventRef);
        if (cancelled) return;
        if (res.available && res.trackerUrl) {
          setTrackerUrl(res.trackerUrl);
          return;
        }
      } catch {
        // retry below
      }
      const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)];
      attempt += 1;
      timer = window.setTimeout(tick, delay);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isLive, eventRef]);

  return trackerUrl;
}
