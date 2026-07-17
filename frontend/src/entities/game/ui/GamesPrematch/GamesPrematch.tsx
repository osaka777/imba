"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { LoadingSpinner } from "~/shared/ui";
import { SportsbookPageShell } from "~/shared/ui/sportsbook";
import { Header } from "~/widgets/Header";

import { transformApiGames } from "../../lib/transformApiGames";
import { useSportFilter } from "../../lib/useSportFilter";
import { Games as GamesType } from "../../types";
import { OlimpbetLineBlocks } from "~/entities/wc-odds/line/OlimpbetLineBlocks";
import { OlimpbetLineFilter } from "~/entities/wc-odds/line/OlimpbetLineFilter";
import { OlimpbetTimeFilter } from "~/entities/wc-odds/line/OlimpbetTimeFilter";
import { useOlimpbetLine } from "~/entities/wc-odds/line/useOlimpbetLine";
import {
  WC_LINE_INITIAL_LIMIT,
  WC_LINE_INITIAL_LIMIT_MOBILE,
  WC_LINE_PAGE_SIZE,
} from "~/entities/wc-odds/line/wcLinePagination";
import { useWcListPaginationLimits } from "~/entities/wc-odds/lib/useWcListPaginationLimits";
import type { WcLineHoursFilter } from "~/entities/wc-odds/line/wcLineTimeFilter";
import {
  readStoredLineHoursFilter,
  writeStoredLineHoursFilter,
} from "~/entities/wc-odds/line/wcLineTimeFilter";
import {
  readStoredLineDateFilter,
  writeStoredLineDateFilter,
} from "~/entities/wc-odds/line/wcLineDateFilter";
import { WcLeagueMenu } from "~/entities/wc-odds/ui/WcLeagueMenu";
import { isEsportsSport } from "~/entities/cybersport/lib/isEsportsSport";
import { useCybersportFeed } from "~/entities/cybersport/hooks/useCybersportFeed";
import { CybersportLeagueMenu } from "~/entities/cybersport/ui/CybersportLeagueMenu";
import { Search } from "../Search";
import { SubcategoryMenu } from "../SubcategoryMenu/SubcategoryMenu";
import { TournamentTable } from "../TournamentTable";
import styles from "./GamesPrematch.module.css";
import shellStyles from "../SportPageShell.module.css";
import { Menu } from "./Menu";
import { LuckyDriveBanner } from "../LuckyDrive/LuckyDriveBanner";
import { isSegmentedLineFilterDesign } from "~/entities/wc-odds/line/lineFilterDesign";
import { operations } from "~/shared/api/api";

type Game = GamesType[number];

type GamesPrematchProps = {
  className?: string;
  queryOptions: {
    queryFn: (options: {
      pageParam: operations["GameController_getGames"]["parameters"]["query"];
    }) => Promise<Game[]>;
    queryKey: string[];
  };
};

export const GamesPrematch = ({
  className,
  queryOptions: { queryFn, queryKey },
}: GamesPrematchProps) => {
  const { t } = useLocale();
  const sport = useSportFilter();
  const isEsports = Boolean(sport && isEsportsSport(sport));
  const { initialLimit, pageSize } = useWcListPaginationLimits(
    WC_LINE_INITIAL_LIMIT,
    WC_LINE_INITIAL_LIMIT_MOBILE,
    WC_LINE_PAGE_SIZE,
  );
  const prevSportRef = useRef(sport);
  const [hoursFilter, setHoursFilter] = useState<WcLineHoursFilter>("all");
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  useEffect(() => {
    const storedDate = readStoredLineDateFilter();
    const storedHours = readStoredLineHoursFilter();
    if (storedDate) {
      setDateFilter(storedDate);
      setHoursFilter("all");
      return;
    }
    setHoursFilter(storedHours);
    setDateFilter(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    setHoursFilter("all");
    setDateFilter(null);
    writeStoredLineHoursFilter("all");
    writeStoredLineDateFilter(null);
  }, []);

  const handleHoursFilterChange = useCallback((next: WcLineHoursFilter) => {
    setHoursFilter(next);
    setDateFilter(null);
    writeStoredLineHoursFilter(next);
    writeStoredLineDateFilter(null);
  }, []);

  const handleDateFilterChange = useCallback((next: string) => {
    setDateFilter(next);
    setHoursFilter("all");
    writeStoredLineDateFilter(next);
    writeStoredLineHoursFilter("all");
  }, []);

  const {
    enabled: olimpbetEnabled,
    initialLoading: olimpbetLoading,
    loadingMore: olimpbetLoadingMore,
    hasMore: olimpbetHasMore,
    loadMore: loadMoreOlimpbet,
    leagues: olimpbetLeagues,
    timeCounts,
    dates,
  } = useOlimpbetLine(sport, hoursFilter, dateFilter);
  const hasOlimpbetLine = !isEsports && olimpbetEnabled !== false && olimpbetLeagues.length > 0;

  const {
    leagues: cyberLeagues,
    isLoading: cyberLoading,
    isFetchingNextPage: cyberLoadingMore,
    hasNextPage: cyberHasMore,
    fetchNextPage: fetchMoreCyber,
    error: cyberError,
  } = useCybersportFeed(sport, "line");

  const queryClient = useQueryClient();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const uniqueEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (prevSportRef.current === sport) return;
    prevSportRef.current = sport;
    setHoursFilter("all");
    setDateFilter(null);
    writeStoredLineHoursFilter("all");
    writeStoredLineDateFilter(null);
  }, [sport]);

  useEffect(() => {
    setAllGames([]);
    uniqueEventIds.current.clear();
    queryClient.invalidateQueries({ queryKey: [...queryKey, sport, initialLimit] });
  }, [sport, initialLimit, queryClient, queryKey]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: [...queryKey, sport, initialLimit],
    queryFn,
    initialPageParam: { limit: initialLimit, offset: 0 },
    getNextPageParam: (lastPage: Game[], _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      return {
        limit: pageSize,
        offset: lastPageParam.offset + lastPageParam.limit,
      };
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Увеличили до 30 секунд для лучшего кэширования
    gcTime: 1000 * 60 * 10, // Увеличили до 10 минут для экономии запросов
    retry: 1,
    retryDelay: 1000,
    // Добавляем агрессивное кэширование
    placeholderData: (previousData) => previousData,
    enabled: !isEsports,
  });

  const loadMore = useCallback(() => {
    if (isEsports) {
      if (cyberHasMore && !cyberLoadingMore) {
        void fetchMoreCyber();
      }
      return;
    }
    if (olimpbetEnabled !== false && olimpbetHasMore && !olimpbetLoadingMore) {
      void loadMoreOlimpbet();
      return;
    }
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [
    cyberHasMore,
    cyberLoadingMore,
    fetchMoreCyber,
    fetchNextPage,
    hasNextPage,
    isEsports,
    isFetchingNextPage,
    loadMoreOlimpbet,
    olimpbetEnabled,
    olimpbetHasMore,
    olimpbetLoadingMore,
  ]);

  const hasMoreToLoad = isEsports
    ? cyberHasMore
    : (olimpbetEnabled !== false && olimpbetHasMore) || Boolean(hasNextPage);

  const games = useMemo(() => {
    if (!data?.pages) return [];

    const transformedGames = data.pages.flatMap((page) => {
      if (!page) return [];
      return transformApiGames(page as Game[]);
    });

    // Сохраняем порядок игр от бэкенда (новые игры сначала)
    // Не пересортировываем, так как бэкенд уже возвращает правильный порядок
    return transformedGames;
  }, [data?.pages]);

  // Добавляем логирование для отладки
  useEffect(() => {
    if (error) {
      console.error('Error fetching prematch games:', error);
    }
  }, [error]);

  const showGamesLoader =
    isFetchingNextPage
    || olimpbetLoadingMore
    || cyberLoadingMore
    || (isEsports && cyberLoading && cyberLeagues.length === 0)
    || (olimpbetEnabled !== false && olimpbetLoading && olimpbetLeagues.length === 0)
    || (olimpbetEnabled === false && !isEsports && isLoading && games.length === 0);

  return (
    <SportsbookPageShell className={cn(styles.GamesPrematch, className)}>
      <div className={shellStyles.pageShell}>
        <div className={shellStyles.pageHeaderSlot}>
          <Header />
        </div>
        <div className={shellStyles.pageFlow}>
        <div className={shellStyles.sidebarColumn}>
        <aside className={shellStyles.sportsSidebar}>
          <div
            className={cn(
              shellStyles.sidebarControls,
              isSegmentedLineFilterDesign() && shellStyles.sidebarControls_segmented,
            )}
          >
            {olimpbetEnabled !== false && !isEsports ? (
              <div className={shellStyles.sidebarTimeFilterSlot}>
                <OlimpbetLineFilter
                  dateFilter={dateFilter}
                  dates={dates}
                  hoursFilter={hoursFilter}
                  onDateChange={handleDateFilterChange}
                  onHoursChange={handleHoursFilterChange}
                  onSelectAll={handleSelectAll}
                  timeCounts={timeCounts}
                />
              </div>
            ) : null}
            <div className={shellStyles.sidebarSearchSlot}>
              <Search sport={sport} />
            </div>
          </div>
          <div className={shellStyles.sidebarMenuScroll}>
          <Menu
            layout="sidebar"
            className={sport ? shellStyles.sportsMenuSlot_mobileHidden : undefined}
          />
          {sport ? (
            isEsports ? (
              <CybersportLeagueMenu type="prematch" layout="sidebar" />
            ) : olimpbetEnabled !== false ? (
              <WcLeagueMenu type="prematch" layout="sidebar" />
            ) : (
              <SubcategoryMenu type="prematch" layout="sidebar" />
            )
          ) : null}
          </div>
        </aside>
        </div>

        <div className={shellStyles.pageMain}>
      <div className={shellStyles.pageMainLead}>
      <LuckyDriveBanner compact placement="line" />
      </div>
      <div className={shellStyles.pageMainBody}>
      {olimpbetEnabled !== false && !isEsports ? (
        <div className={styles.lineToolbar}>
          <OlimpbetTimeFilter
            className={styles.lineToolbar_filter}
            counts={timeCounts}
            onChange={handleHoursFilterChange}
            onSelectAll={handleSelectAll}
            value={hoursFilter}
          />
          <Search sport={sport} layout="toolbar" className={styles.lineToolbar_search} hideOnDesktop />
        </div>
      ) : (
        <Search sport={sport} hideOnDesktop />
      )}
      <InfiniteScroll
        className={styles.GamesPrematch}
        hasMore={hasMoreToLoad && !isFetchingNextPage && !olimpbetLoadingMore && !cyberLoadingMore}
        loadMore={loadMore}
        pageStart={0}
        threshold={250}
        useWindow={true}
      >
        {(cyberError) && (
          <div className="p-4 text-center bg-red-500/10 text-red-500">
            {t("common.gamesLoadError")}
          </div>
        )}
        {(error && olimpbetEnabled === false) && (
          <div className="p-4 text-center bg-red-500/10 text-red-500">
            {t("common.gamesLoadError")}
          </div>
        )}
        {!isEsports ? <OlimpbetLineBlocks leagues={olimpbetLeagues} /> : null}
        {isEsports ? (
          cyberLeagues.length === 0 && !cyberLoading && !cyberError ? (
            <p className="p-4 text-center bg-white/5">{t("common.gamesNotFound")}</p>
          ) : (
            cyberLeagues.map((league, index) => (
              <TournamentTable
                gameLinkPrefix="/cybersport/game/"
                games={league.games}
                isLive={false}
                key={league.leagueName + index}
                league={league.leagueName}
                sport={league.games[0]?.sport ?? sport!}
              />
            ))
          )
        ) : null}
        {!isEsports && games.length === 0 && !isLoading && !error && !hasOlimpbetLine && !olimpbetLoading && (
          <p className="p-4 text-center bg-white/5">{t("common.gamesNotFound")}</p>
        )}
        {!isEsports
          ? games.map((league, index) => (
              <TournamentTable
                games={league.games}
                isLive={false}
                key={league.leagueName + index}
                league={league.leagueName}
                sport={league.games[0].sport}
              />
            ))
          : null}
        {showGamesLoader ? (
          <LoadingSpinner key="games-loading" className={styles.loading} />
        ) : null}
      </InfiniteScroll>
      </div>
        </div>
        </div>
      </div>
    </SportsbookPageShell>
  );
};
