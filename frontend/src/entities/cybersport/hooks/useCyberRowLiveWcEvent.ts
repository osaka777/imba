"use client";

import { useMemo } from "react";

import type { WcEvent } from "~/entities/wc-odds/api/client";
import { useWcOddsLiveStream } from "~/entities/wc-odds/lib/useWcOddsStream";

/** Merge WC live-feed odds into a cyber row event (list pages). */
export function useCyberRowLiveWcEvent(
  base: WcEvent | null,
  isLive: boolean,
): WcEvent | null {
  const { events } = useWcOddsLiveStream(isLive && Boolean(base));

  return useMemo(() => {
    if (!base) return null;
    if (!isLive) return base;

    const fresh = events.find((event) => event.id === base.id);
    if (!fresh) return base;

    return {
      ...base,
      oddsHome: fresh.oddsHome ?? base.oddsHome,
      oddsDraw: fresh.oddsDraw ?? base.oddsDraw,
      oddsAway: fresh.oddsAway ?? base.oddsAway,
      bettingOpen: fresh.bettingOpen,
      phase: fresh.phase,
      homeScore: fresh.homeScore ?? base.homeScore,
      awayScore: fresh.awayScore ?? base.awayScore,
      parsedScore: fresh.parsedScore ?? base.parsedScore,
      hasBroadcast: fresh.hasBroadcast ?? base.hasBroadcast,
      oddsUpdatedAt: fresh.oddsUpdatedAt ?? base.oddsUpdatedAt,
    };
  }, [base, isLive, events]);
}
