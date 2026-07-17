"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchWcDates,
  fetchWcLineEvents,
  fetchWcLineTimeCounts,
  fetchWcStatus,
  type WcEvent,
} from "~/entities/wc-odds/api/client";
import {
  filterWcEventsByDate,
  filterWcEventsByHours,
  filterWcEventsBySport,
  filterWcEventsByTournament,
  groupWcEventsByLeague,
  type WcLeagueBlock,
} from "~/entities/wc-odds/line/groupWcByLeague";
import {
  WC_LINE_INITIAL_LIMIT,
  WC_LINE_INITIAL_LIMIT_MOBILE,
  WC_LINE_PAGE_SIZE,
} from "~/entities/wc-odds/line/wcLinePagination";
import type { WcLineHoursFilter } from "~/entities/wc-odds/line/wcLineTimeFilter";
import { filterVisibleWcLineEvents } from "~/entities/wc-odds/lib/wcLineEvents";
import { isEsportsSport } from "~/entities/cybersport/lib/isEsportsSport";
import { useWcListPaginationLimits } from "~/entities/wc-odds/lib/useWcListPaginationLimits";
import { useWcLineKickoffHide } from "~/entities/wc-odds/lib/useWcLineKickoffHide";
import { useWcOddsLineStream } from "~/entities/wc-odds/lib/useWcOddsStream";

export function useOlimpbetLine(
  sport?: string,
  hoursFilter: WcLineHoursFilter = "all",
  dateFilter: string | null = null,
) {
  const esportsOnly = Boolean(sport && isEsportsSport(sport));
  const searchParams = useSearchParams();
  const tournamentFilter = searchParams.get("tournament");
  const leagueFilter = searchParams.get("league");
  const { initialLimit, pageSize } = useWcListPaginationLimits(
    WC_LINE_INITIAL_LIMIT,
    WC_LINE_INITIAL_LIMIT_MOBILE,
    WC_LINE_PAGE_SIZE,
  );
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [timeCounts, setTimeCounts] = useState<Record<string, number>>({ all: 0 });
  const [dates, setDates] = useState<string[]>([]);
  const loadedOffsetRef = useRef(0);

  const { events: streamEvents, setEvents } = useWcOddsLineStream(enabled === true);

  const hideEvent = useCallback(
    (eventId: string) => {
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      loadedOffsetRef.current = Math.max(0, loadedOffsetRef.current - 1);
    },
    [setEvents],
  );

  const loadPage = useCallback(
    async (offset: number, limit: number, replace: boolean) => {
      const hoursParam = dateFilter ? undefined : hoursFilter;
      const rawEvents = await fetchWcLineEvents(
        sport,
        hoursParam,
        dateFilter ?? undefined,
        limit,
        offset,
        tournamentFilter,
        leagueFilter,
      );
      const visible = filterVisibleWcLineEvents(rawEvents);
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
    [dateFilter, hoursFilter, leagueFilter, setEvents, sport, tournamentFilter],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setInitialLoading(true);
      setHasMore(true);
      loadedOffsetRef.current = 0;
      setEvents([]);

      if (esportsOnly) {
        setEnabled(false);
        setTimeCounts({ all: 0 });
        setDates([]);
        setInitialLoading(false);
        return;
      }

      try {
        const status = await fetchWcStatus();
        if (cancelled) return;
        setEnabled(status.enabled);
        if (!status.enabled) {
          setTimeCounts({ all: 0 });
          setDates([]);
          return;
        }

        const [counts, apiDates] = await Promise.all([
          fetchWcLineTimeCounts(sport),
          fetchWcDates(),
        ]);
        if (cancelled) return;
        setTimeCounts(counts);
        setDates(apiDates);
        await loadPage(0, initialLimit, true);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    void bootstrap();

    const onLocale = () => {
      void bootstrap();
    };
    window.addEventListener("localeChanged", onLocale);

    return () => {
      cancelled = true;
      window.removeEventListener("localeChanged", onLocale);
    };
  }, [dateFilter, esportsOnly, hoursFilter, initialLimit, leagueFilter, loadPage, setEvents, sport, tournamentFilter]);

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
    const filtered = filterVisibleWcLineEvents(streamEvents);
    const bySport = filterWcEventsBySport(filtered, sport);
    const byTournament = filterWcEventsByTournament(bySport, tournamentFilter, leagueFilter);
    const byDate = filterWcEventsByDate(byTournament, dateFilter);
    return filterWcEventsByHours(byDate, dateFilter ? "all" : hoursFilter);
  }, [streamEvents, sport, hoursFilter, dateFilter, tournamentFilter, leagueFilter]);

  useWcLineKickoffHide(visibleEvents, hideEvent);

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
    timeCounts,
    dates,
  };
}

export type { WcLeagueBlock, WcEvent };
