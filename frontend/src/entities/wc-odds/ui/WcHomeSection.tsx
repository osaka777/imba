"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  fetchWcLiveCounts,
  fetchWcLiveEvents,
  fetchWcLineCounts,
  fetchWcLineEvents,
  fetchWcStatus,
  type WcEvent,
} from "~/entities/wc-odds/api/client";
import {
  filterVisibleWcLiveEvents,
  filterVisibleWcLineEvents,
} from "~/entities/wc-odds/lib/wcLineEvents";
import {
  useWcOddsLineStream,
  useWcOddsLiveStream,
} from "~/entities/wc-odds/lib/useWcOddsStream";
import { filterWcEventsBySport } from "~/entities/wc-odds/line/groupWcByLeague";
import { WcHomeMatchRow } from "~/entities/wc-odds/ui/WcHomeMatchRow";
import { WcHomeSkeleton } from "~/entities/wc-odds/ui/WcHomeSkeleton";
import { WcHomeSportFilter } from "~/entities/wc-odds/ui/WcHomeSportFilter";
import {
  getHomeSports,
  getHomeTableColumnsForSport,
  isHomeSportTwoWay,
  mergeHomePanelEvents,
  pickBestSportFromCounts,
  pickVisibleEvents,
  pickVisibleLiveHomeEvents,
  sortPrematchEvents,
  sortLiveHomeEvents,
  LIVE_HOME_FETCH_LIMIT,
} from "~/entities/wc-odds/ui/homeSectionUtils";
import { resolveHomeSportMeta } from "~/entities/wc-odds/ui/homeSportFilters";
import { cn } from "~/shared/lib";
import { FireIcon } from "~/shared/assets";

import styles from "~/entities/wc-odds/ui/WcHomeSection.module.css";

const LIVE_LIMIT = 12;
const LINE_LIMIT = 12;
const MOBILE_HOME_MQ = "(max-width: 767px)";

function useMobileHomeLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_HOME_MQ);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

type MobilePanel = "live" | "prematch";

type HomePanelProps = {
  variant: "live" | "prematch";
  href: string;
  events: WcEvent[];
  loading: boolean;
  sport: string;
  onSportChange: (sport: string) => void;
  className?: string;
  isMobile: boolean;
  onMobilePanelToggle?: () => void;
};

function HomeTableHead({ sport, isMobile }: { sport: string; isMobile: boolean }) {
  const isTwoWay = isHomeSportTwoWay(sport);
  const gridColumns = getHomeTableColumnsForSport(sport);

  if (isMobile) {
    return (
      <div
        className={cn(
          styles.tableHeadMobile,
          isTwoWay && styles.tableHeadMobile_twoWay,
        )}
      >
        <span className={styles.colTime}>Время</span>
        <span className={styles.colTeams}>Команды</span>
        <span className={styles.colOdd}>1</span>
        {!isTwoWay && <span className={styles.colOdd}>X</span>}
        <span className={styles.colOdd}>2</span>
      </div>
    );
  }

  return (
    <div className={styles.tableHead} style={{ gridTemplateColumns: gridColumns }}>
      <span className={styles.colTime}>Время</span>
      <span className={styles.colTeams}>Команды</span>
      <span className={styles.colOdd}>1</span>
      {!isTwoWay && <span className={styles.colOdd}>X</span>}
      <span className={styles.colOdd}>2</span>
    </div>
  );
}

function HomeEmptyState({
  variant,
  sport,
  href,
}: {
  variant: "live" | "prematch";
  sport: string;
  href: string;
}) {
  const sports = getHomeSports(variant);
  const meta = resolveHomeSportMeta(sports, sport);
  const isLive = variant === "live";

  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>
        {isLive
          ? `Сейчас нет live по ${meta.label.toLowerCase()}`
          : `Нет матчей в линии по ${meta.label.toLowerCase()}`}
      </p>
      <p className={styles.emptyHint}>Попробуйте другой вид спорта или откройте полный список</p>
      <Link className={styles.emptyCta} href={href}>
        {isLive ? "Смотреть все live" : "Перейти в линию"}
      </Link>
    </div>
  );
}

function HomePanel({
  variant,
  href,
  events,
  loading,
  sport,
  onSportChange,
  className,
  isMobile,
  onMobilePanelToggle,
}: HomePanelProps) {
  const isLive = variant === "live";
  const gridColumns = getHomeTableColumnsForSport(sport);

  const tabPrimaryContent = isLive ? (
    <>
      <span className={styles.liveDot} />
      Live
    </>
  ) : (
    <>
      <FireIcon aria-hidden className={styles.fireIcon} />
      Prematch
    </>
  );

  return (
    <section className={cn(styles.panel, className)}>
      <div className={cn(styles.panelStack, isMobile && styles.panelStack_mobile)}>
        <div className={styles.topRow}>
          <div className={cn(styles.tabGroup, isMobile && styles.tabGroup_mobile)}>
            {isMobile && onMobilePanelToggle ? (
              <button
                aria-label={isLive ? "Переключить на Prematch" : "Переключить на Live"}
                className={styles.tabPrimary}
                onClick={onMobilePanelToggle}
                type="button"
              >
                {tabPrimaryContent}
              </button>
            ) : (
              <div className={styles.tabPrimary}>{tabPrimaryContent}</div>
            )}

            <Link className={styles.tabSecondary} href={href}>
              Все
            </Link>
          </div>

          <div className={cn(styles.panelToolbar, isMobile && styles.panelToolbar_mobile)}>
            <WcHomeSportFilter
              onChange={onSportChange}
              sport={sport}
              variant={variant}
            />
          </div>
        </div>

        <div className={cn(styles.card, isMobile && styles.card_mobile)}>
          <HomeTableHead isMobile={isMobile} sport={sport} />
          <div className={styles.tableBody}>
            {loading && events.length === 0 && (
              <WcHomeSkeleton isTwoWay={isHomeSportTwoWay(sport)} rows={5} sport={sport} />
            )}
            {!loading && events.length === 0 && (
              <HomeEmptyState href={href} sport={sport} variant={variant} />
            )}
            {events.map((event, index) => (
              <WcHomeMatchRow
                event={event}
                gridColumns={gridColumns}
                key={event.id}
                rowIndex={index}
                variant={variant}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function WcHomeSection() {
  const isMobile = useMobileHomeLayout();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("live");
  const [liveSport, setLiveSport] = useState("soccer");
  const [lineSport, setLineSport] = useState("soccer");
  const [liveLoading, setLiveLoading] = useState(true);
  const [lineLoading, setLineLoading] = useState(true);

  const { events: liveEvents, setEvents: setLiveEvents } = useWcOddsLiveStream(
    enabled === true && (!isMobile || mobilePanel === "live"),
  );
  const { events: lineEvents, setEvents: setLineEvents } = useWcOddsLineStream(
    enabled === true && (!isMobile || mobilePanel === "prematch"),
  );

  const loadSportEvents = useCallback(
    async (variant: "live" | "prematch", sport: string) => {
      if (variant === "live") {
        setLiveLoading(true);
        try {
          const fetchLimit = isMobile ? LIVE_LIMIT : LIVE_HOME_FETCH_LIMIT;
          const raw = await fetchWcLiveEvents(sport, fetchLimit, 0, null, null).catch(() => []);
          const visible = sortLiveHomeEvents(filterVisibleWcLiveEvents(raw)).slice(0, LIVE_LIMIT);
          setLiveEvents((prev) => mergeHomePanelEvents(prev, visible, sport));
        } finally {
          setLiveLoading(false);
        }
        return;
      }

      setLineLoading(true);
      try {
        const raw = await fetchWcLineEvents(sport, "all", undefined, LINE_LIMIT, 0, null, null).catch(
          () => [],
        );
        const visible = filterVisibleWcLineEvents(raw);
        setLineEvents((prev) => mergeHomePanelEvents(prev, visible, sport));
      } finally {
        setLineLoading(false);
      }
    },
    [setLiveEvents, setLineEvents, isMobile],
  );

  const loadInitial = useCallback(
    async (
      liveC: Record<string, number>,
      lineC: Record<string, number>,
    ) => {
    const initialLiveSport =
      pickBestSportFromCounts(liveC, getHomeSports("live"), "soccer") ?? "soccer";
    const initialLineSport =
      pickBestSportFromCounts(lineC, getHomeSports("prematch"), "soccer") ?? "soccer";

    setLiveSport(initialLiveSport);
    setLineSport(initialLineSport);

    await Promise.all([
      loadSportEvents("live", initialLiveSport),
      loadSportEvents("prematch", initialLineSport),
    ]);
  }, [loadSportEvents]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const [status, liveC, lineC] = await Promise.all([
        fetchWcStatus().catch(() => ({ enabled: false })),
        fetchWcLiveCounts().catch(() => ({})),
        fetchWcLineCounts().catch(() => ({})),
      ]);
      if (cancelled) return;
      setEnabled(status.enabled);
      if (!status.enabled) {
        setLiveEvents([]);
        setLineEvents([]);
        setLiveLoading(false);
        setLineLoading(false);
        return;
      }
      await loadInitial(liveC, lineC);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadInitial, setLiveEvents, setLineEvents]);

  const handleLiveSportChange = useCallback(
    (sport: string) => {
      setLiveSport(sport);
      if (filterWcEventsBySport(liveEvents, sport).length > 0) return;
      void loadSportEvents("live", sport);
    },
    [liveEvents, loadSportEvents],
  );

  const handleLineSportChange = useCallback(
    (sport: string) => {
      setLineSport(sport);
      if (filterWcEventsBySport(lineEvents, sport).length > 0) return;
      void loadSportEvents("prematch", sport);
    },
    [lineEvents, loadSportEvents],
  );

  const sortedLineEvents = useMemo(
    () => sortPrematchEvents(lineEvents),
    [lineEvents],
  );

  const visibleLive = useMemo(
    () => pickVisibleLiveHomeEvents(filterVisibleWcLiveEvents(liveEvents), liveSport, LIVE_LIMIT),
    [liveEvents, liveSport],
  );

  const visibleLine = useMemo(
    () => pickVisibleEvents(sortedLineEvents, lineSport, LINE_LIMIT),
    [sortedLineEvents, lineSport],
  );

  if (enabled === false) return null;

  return (
    <div className={cn(styles.wrap, isMobile && styles.wrap_mobile)}>
      <div className={cn(styles.grid, isMobile && styles.grid_mobile)}>
        <HomePanel
          className={
            isMobile
              ? mobilePanel === "live"
                ? styles.panel_mobileVisible
                : styles.panel_mobileHidden
              : undefined
          }
          events={visibleLive}
          href="/live"
          isMobile={isMobile}
          loading={liveLoading}
          onMobilePanelToggle={
            isMobile
              ? () => setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"))
              : undefined
          }
          onSportChange={handleLiveSportChange}
          sport={liveSport}
          variant="live"
        />
        <HomePanel
          className={
            isMobile
              ? mobilePanel === "prematch"
                ? styles.panel_mobileVisible
                : styles.panel_mobileHidden
              : undefined
          }
          events={visibleLine}
          href="/line"
          isMobile={isMobile}
          loading={lineLoading}
          onMobilePanelToggle={
            isMobile
              ? () => setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"))
              : undefined
          }
          onSportChange={handleLineSportChange}
          sport={lineSport}
          variant="prematch"
        />
      </div>
    </div>
  );
}
