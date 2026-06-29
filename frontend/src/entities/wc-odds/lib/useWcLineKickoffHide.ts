"use client";

import { useEffect } from "react";

import type { WcEvent } from "~/entities/wc-odds/api/client";

/** Remove row at kickoff without waiting for the next poll. */
export function useWcLineKickoffHide(
  events: WcEvent[],
  onHide: (eventId: string) => void,
) {
  useEffect(() => {
    const timerIds: number[] = [];

    for (const event of events) {
      if (event.completed) continue;
      const kickoffMs = Date.parse(event.commenceTime);
      if (!Number.isFinite(kickoffMs)) continue;
      const msUntilClose = kickoffMs - Date.now();
      if (msUntilClose <= 0) {
        onHide(event.id);
        continue;
      }
      timerIds.push(
        window.setTimeout(() => {
          onHide(event.id);
        }, msUntilClose),
      );
    }

    return () => {
      timerIds.forEach((id) => window.clearTimeout(id));
    };
  }, [events, onHide]);
}
