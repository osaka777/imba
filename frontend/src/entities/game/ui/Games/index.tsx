"use client";

import { api } from "~/shared/api";

import { Games as TGames } from "../../types";
import { Games } from "./Games";

export const GamesBySport = ({
  className,
  initialData,
  sport,
}: {
  className?: string;
  initialData?: TGames; // Сделали опциональным
  sport: string;
}) => {
  return (
    <Games
      className={className}
      queryOptions={{
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          const { data, error } = await api.GET(
            "/api/games/live/{sport}",
            {
              params: {
                path: { sport: sport },
                query: pageParam,
              },
            },
          );
          if (error) throw new Error("No data");
          return data;
        },
        queryKey: ["games", sport],
      }}
    />
  );
};

export const AllGames = ({
  className,
  initialData,
}: {
  className?: string;
  initialData?: TGames; // Сделали опциональным
}) => {
  return (
    <Games
      className={className}
      queryOptions={{
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          // Уменьшаем начальный размер запроса для быстрой загрузки
          const limit = pageParam?.offset === 0 ? 10 : 20;
          const { data, error } = await api.GET("/api/games/live", {
            params: {
              query: {
                ...pageParam,
                limit,
              },
            },
          });
          if (error) throw new Error("No data");
          return data;
        },
        queryKey: ["games"],
      }}
    />
  );
};

export const GamesBySportAndSubcategory = ({
  className,
  initialData,
  sport,
  subcategory,
}: {
  className?: string;
  initialData?: TGames; // Сделали опциональным
  sport: string;
  subcategory: string;
}) => {
  return (
    <Games
      className={className}
      queryOptions={{
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          const { data, error } = await api.GET(
            "/api/games/live/{sport}/{subcategory}",
            {
              params: {
                path: { sport, subcategory },
                query: pageParam,
              },
            },
          );
          if (error) throw new Error("No data");
          return data;
        },
        queryKey: ["games", sport, subcategory],
      }}
    />
  );
};
