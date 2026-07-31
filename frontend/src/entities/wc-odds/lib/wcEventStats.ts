import type { WcEvent } from "~/entities/wc-odds/api/client";
import { wcEventHasGameStats } from "~/entities/wc-odds/lib/wcListStatCols";

export function wcEventHasStats(
  event: Pick<WcEvent, "sport" | "statList" | "phase" | "hasLiveTracker">,
): boolean {
  return wcEventHasGameStats(event);
}
