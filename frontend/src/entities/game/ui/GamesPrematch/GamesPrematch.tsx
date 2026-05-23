"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import { cn } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";

import { transformApiGames } from "../../lib/transformApiGames";
import { Games as GamesType } from "../../types";
import { Search } from "../Search";
import { SubcategoryMenu } from "../SubcategoryMenu/SubcategoryMenu";
import { TournamentTable } from "../TournamentTable";
import styles from "./GamesPrematch.module.css";
import { Menu } from "./Menu";
import { LuckyDriveBanner } from "../LuckyDrive/LuckyDriveBanner";
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
  const params = useParams();
  const sport = params?.sport as string | undefined;

  const queryClient = useQueryClient();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const uniqueEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAllGames([]);
    uniqueEventIds.current.clear();
    queryClient.invalidateQueries({ queryKey: [...queryKey, sport] });
  }, [sport, queryClient, queryKey]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: [...queryKey, sport],
    queryFn,
    initialPageParam: { limit: 20, offset: 0 },
    getNextPageParam: (lastPage: Game[], _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      return {
        ...lastPageParam,
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
  });

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

  return (
    <div className={cn(styles.GamesPrematch, className)}>
      {sport ? <SubcategoryMenu type="prematch" /> : <Menu />}
      <LuckyDriveBanner />
      <Search />
      <InfiniteScroll
        className={styles.GamesPrematch}
        hasMore={hasNextPage && !isFetchingNextPage}
        loadMore={loadMore}
        loader={
          <LoadingSpinner key="loading-spinner" className={styles.loading} />
        }
        pageStart={0}
        threshold={250}
        useWindow={true}
      >
        {error && (
          <div className="p-4 text-center bg-red-500/10 text-red-500">
            Ошибка загрузки игр. Пожалуйста, попробуйте позже.
          </div>
        )}
        {games.length === 0 && !isLoading && !error && (
          <p className="p-4 text-center bg-white/5">Игры не найдены</p>
        )}
        {games.map((league, index) => (
          <TournamentTable
            games={league.games}
            isLive={false}
            key={league.leagueName + index}
            league={league.leagueName}
            sport={league.games[0].sport}
          />
        ))}
      </InfiniteScroll>
    </div>
  );
};
