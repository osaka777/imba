"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchWcLiveEvents,
  fetchWcStatus,
  type WcEvent,
} from "~/entities/wc-odds/api/client";
import {
  filterWcEventsBySport,
  filterWcEventsByTournament,
  filterWcEventsByBroadcast,
  groupWcEventsByLeague,
  type WcLeagueBlock,
} from "~/entities/wc-odds/line/groupWcByLeague";
import {
  WC_LIVE_INITIAL_LIMIT,
  WC_LIVE_INITIAL_LIMIT_MOBILE,
  WC_LIVE_PAGE_SIZE,
} from "~/entities/wc-odds/live/wcLivePagination";
import { filterVisibleWcLiveEvents } from "~/entities/wc-odds/lib/wcLineEvents";
import { useWcListPaginationLimits } from "~/entities/wc-odds/lib/useWcListPaginationLimits";
import { useWcOddsLiveStream } from "~/entities/wc-odds/lib/useWcOddsStream";

export function useOlimpbetLive(sport?: string) {
  const searchParams = useSearchParams();
  const tournamentFilter = searchParams.get("tournament");
  const leagueFilter = searchParams.get("league");
  const broadcastOnly =
    searchParams.get("broadcast") === "1" || searchParams.get("broadcast") === "true";
  const { initialLimit, pageSize } = useWcListPaginationLimits(
    WC_LIVE_INITIAL_LIMIT,
    WC_LIVE_INITIAL_LIMIT_MOBILE,
    WC_LIVE_PAGE_SIZE,
  );
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadedOffsetRef = useRef(0);

  const { events: streamEvents, setEvents } = useWcOddsLiveStream(enabled === true);

  const hideEvent = useCallback(
    (eventId: string) => {
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      loadedOffsetRef.current = Math.max(0, loadedOffsetRef.current - 1);
    },
    [setEvents],
  );

  const loadPage = useCallback(
    async (offset: number, limit: number, replace: boolean) => {
      const rawEvents = await fetchWcLiveEvents(
        sport,
        limit,
        offset,
        tournamentFilter,
        leagueFilter,
        broadcastOnly,
      );
      const visible = filterVisibleWcLiveEvents(rawEvents);
      setHasMore(visible.length === limit);
      setEvents((prev) => {
        if (replace) return visible;
        const seen = new Set(prev.map((event) => event.id));
        const appended = visible.filter((event) => !seen.has(event.id));
        return [...prev, ...appended];
      });
      loadedOffsetRef.current = offset + visible.length;
      return visible.length;
    },
    [broadcastOnly, leagueFilter, setEvents, sport, tournamentFilter],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setInitialLoading(true);
      setHasMore(true);
      loadedOffsetRef.current = 0;
      try {
        const status = await fetchWcStatus();
        if (cancelled) return;
        setEnabled(status.enabled);
        if (!status.enabled) {
          setEvents([]);
          return;
        }
        await loadPage(0, initialLimit, true);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [broadcastOnly, initialLimit, loadPage, setEvents, sport, tournamentFilter, leagueFilter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || initialLoading || enabled === false) return;
    setLoadingMore(true);
    try {
      await loadPage(loadedOffsetRef.current, pageSize, false);
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, hasMore, initialLoading, loadPage, loadingMore, pageSize]);

  const visibleEvents = useMemo(() => {
    const filtered = filterVisibleWcLiveEvents(streamEvents);
    const byBroadcast = filterWcEventsByBroadcast(filtered, broadcastOnly);
    const bySport = filterWcEventsBySport(byBroadcast, sport);
    return filterWcEventsByTournament(bySport, tournamentFilter, leagueFilter);
  }, [streamEvents, sport, tournamentFilter, leagueFilter, broadcastOnly]);

  useEffect(() => {
    for (const event of streamEvents) {
      if (event.completed || event.phase === "finished") hideEvent(event.id);
    }
  }, [streamEvents, hideEvent]);

  const leagues = useMemo(
    () => groupWcEventsByLeague(visibleEvents),
    [visibleEvents],
  );

  return {
    enabled,
    initialLoading,
    loadingMore,
    hasMore,
    loadMore,
    leagues,
    visibleEvents,
  };
}

export type { WcLeagueBlock, WcEvent };
