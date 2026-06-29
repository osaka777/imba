"use client";

import { isWcEventBettingOpen, type WcBettingEvent } from "~/entities/wc-odds/lib/wcRate";

export function useWcBettingOpen(event: WcBettingEvent): boolean {
  return isWcEventBettingOpen(event);
}
