"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import InfiniteScroll from "react-infinite-scroller";

import { gamesList } from "~/entities/game";
import {
  fetchWcDates,
  fetchWcEvents,
  fetchWcStatus,
  type WcEvent,
} from "~/entities/wc-odds/api/client";
import {
  filterVisibleWcLineEvents,
  wcLineDatesFromEvents,
} from "~/entities/wc-odds/lib/wcLineEvents";
import { useWcLineKickoffHide } from "~/entities/wc-odds/lib/useWcLineKickoffHide";
import { useWcOddsLineStream } from "~/entities/wc-odds/lib/useWcOddsStream";
import { WcMatchRow } from "~/entities/wc-odds/ui/WcMatchRow";
import { WcTournamentHead } from "~/entities/wc-odds/ui/WcTournamentHead";
import { cn } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";

import menuStyles from "~/entities/game/ui/GamesPrematch/Menu.module.css";
import gamesStyles from "~/entities/game/ui/GamesPrematch/GamesPrematch.module.css";
import tableStyles from "~/entities/game/ui/TournamentTable/TournamentTable.module.css";
import wcStyles from "~/entities/wc-odds/ui/WcLine.module.css";

const INITIAL_VISIBLE = 10;
const LOAD_STEP = 10;

function formatDateLabel(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Almaty",
  });
}

function groupEventsByDate(events: WcEvent[]) {
  const map: Record<string, WcEvent[]> = {};
  for (const event of events) {
    const date = event.commenceTime.slice(0, 10);
    (map[date] ??= []).push(event);
  }
  return map;
}

const WcTournamentBlock = memo(function WcTournamentBlock({
  events,
  title,
}: {
  events: WcEvent[];
  title: string;
}) {
  if (events.length === 0) return null;

  const SoccerIcon = gamesList.soccer.Icon;

  return (
    <div className={`${tableStyles.Tournament} ${wcStyles.wcTournament}`}>
      <WcTournamentHead Icon={SoccerIcon} name={title} sport="soccer" />
      <div className={tableStyles.body}>
        {events.map((ev, index) => (
          <WcMatchRow key={ev.id} event={ev} rowIndex={index} />
        ))}
      </div>
    </div>
  );
});

export function WcLinePage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const { events: streamEvents, setEvents } = useWcOddsLineStream(enabled === true);
  const events = streamEvents;

  const hideEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }, [setEvents]);

  useWcLineKickoffHide(events, hideEvent);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setInitialLoading(true);
      try {
        const status = await fetchWcStatus();
        if (cancelled) return;
        setEnabled(status.enabled);
        if (!status.enabled) {
          setEvents([]);
          setDates([]);
          return;
        }

        const [apiDates, rawEvents] = await Promise.all([fetchWcDates(), fetchWcEvents()]);
        if (cancelled) return;

        const visible = filterVisibleWcLineEvents(rawEvents);
        const lineDates = apiDates.length > 0 ? apiDates : wcLineDatesFromEvents(visible);
        setDates(lineDates);
        setEvents(visible);
        setSelectedDate((prev) => {
          if (prev && lineDates.includes(prev)) return prev;
          return lineDates[0] ?? "";
        });
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [setEvents]);

  const visibleEvents = useMemo(() => filterVisibleWcLineEvents(events), [events]);

  useEffect(() => {
    if (visibleEvents.length === 0) return;
    setDates((prev) => {
      const fromEvents = wcLineDatesFromEvents(visibleEvents);
      const merged = Array.from(new Set([...prev, ...fromEvents])).sort();
      if (merged.length === prev.length && merged.every((date, index) => date === prev[index])) {
        return prev;
      }
      return merged;
    });
  }, [visibleEvents]);

  const eventsByDate = useMemo(() => groupEventsByDate(visibleEvents), [visibleEvents]);
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] ?? [] : [];
  const displayedEvents = useMemo(
    () => selectedEvents.slice(0, visibleCount),
    [selectedEvents, visibleCount],
  );
  const hasMore = visibleCount < selectedEvents.length;

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [selectedDate]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => {
      if (count >= selectedEvents.length) return count;
      return count + LOAD_STEP;
    });
  }, [selectedEvents.length]);

  if (enabled === false) {
    return (
      <div className={gamesStyles.GamesPrematch}>
        <p className="p-4 text-center bg-white/5">Линия временно недоступна</p>
      </div>
    );
  }

  return (
    <div className={`${gamesStyles.GamesPrematch} ${wcStyles.wcPage}`}>
      {dates.length > 0 && (
        <div className={menuStyles.Menu}>
          <div className={menuStyles.wrapper}>
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                className={cn(menuStyles.item, selectedDate === d && menuStyles.item_active)}
                onClick={() => setSelectedDate(d)}
              >
                <p className={menuStyles.text}>{formatDateLabel(d)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {initialLoading && <LoadingSpinner className={gamesStyles.loading} />}

      {!initialLoading && visibleEvents.length === 0 && (
        <p className="p-4 text-center bg-white/5">Матчи не найдены</p>
      )}

      {!initialLoading && selectedEvents.length === 0 && visibleEvents.length > 0 && (
        <p className="p-4 text-center bg-white/5">На выбранную дату матчей нет</p>
      )}

      {!initialLoading && displayedEvents.length > 0 && (
        <InfiniteScroll
          className={gamesStyles.GamesPrematch}
          hasMore={hasMore}
          loadMore={loadMore}
          loader={
            hasMore ? (
              <LoadingSpinner key="wc-line-loading-more" className={gamesStyles.loading} />
            ) : undefined
          }
          pageStart={0}
          threshold={250}
          useWindow
        >
          <WcTournamentBlock
            events={displayedEvents}
            title="Линия"
          />
        </InfiniteScroll>
      )}
    </div>
  );
}
