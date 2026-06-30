import { useEffect, useMemo, useRef, useState } from "react";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";

export const WC_STALE_CATEGORY_MS = 15_000;

type WcMarketEntry = [string, WcMarketGroup[]];

/**
 * During a live match the Olimpbet feed sometimes sends partial snapshots that
 * temporarily omit some market categories (suspended bets, round breaks, etc.).
 *
 * This hook:
 *   1. Always returns every category that is currently in `entries`.
 *   2. Additionally keeps recently-removed categories visible for up to `staleMs`
 *      so they don't flash in/out when the feed briefly drops them.
 *
 * OLD BUG: timestamps were updated only on *snapshot changes*, so stable odds
 * (unchanged >12 s) caused categories to disappear even while still in `entries`.
 */
export function useWcFreshMarketEntries(
  entries: WcMarketEntry[],
  options?: { enabled?: boolean; staleMs?: number },
): WcMarketEntry[] {
  const enabled = options?.enabled ?? true;
  const staleMs = options?.staleMs ?? WC_STALE_CATEGORY_MS;

  /** When a category was last seen in `entries` */
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  /** Last known groups for grace-period rendering of removed categories */
  const lastGroupsRef = useRef<Map<string, WcMarketGroup[]>>(new Map());
  /** Drives periodic expiry check of grace-period entries */
  const [now, setNow] = useState(() => Date.now());

  // Always update last-seen time whenever a category is present in entries.
  // (Previous impl only updated on snapshot change → stable odds → stale → hidden.)
  useEffect(() => {
    if (!enabled) return;
    const timestamp = Date.now();
    for (const [name, groups] of entries) {
      lastSeenRef.current.set(name, timestamp);
      lastGroupsRef.current.set(name, groups);
    }
  }, [entries, enabled]);

  // Tick every second so grace-period entries can expire.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  // Reset tracking when switching from live → pre-match.
  useEffect(() => {
    if (enabled) return;
    lastSeenRef.current.clear();
    lastGroupsRef.current.clear();
  }, [enabled]);

  return useMemo(() => {
    if (!enabled) return entries;

    const currentNames = new Set(entries.map(([name]) => name));

    // All current entries are always shown (fix for the main bug).
    const result: WcMarketEntry[] = [...entries];

    // Append recently-removed categories for the grace period.
    for (const [name, lastSeen] of lastSeenRef.current) {
      if (!currentNames.has(name) && now - lastSeen < staleMs) {
        const groups = lastGroupsRef.current.get(name);
        if (groups) {
          result.push([name, groups]);
        }
      }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, enabled, staleMs, now]);
}
