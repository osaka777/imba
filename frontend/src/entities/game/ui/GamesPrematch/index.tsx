"use client";

import { useMemo } from "react";

import { api } from "~/shared/api";

import { useSportFilter } from "../../lib/useSportFilter";
import { Games as TGames } from "../../types";
import { GamesPrematch } from "./GamesPrematch";

export const LineGames = ({
  className,
  initialData,
}: {
  className?: string;
  initialData?: TGames;
}) => {
  const sport = useSportFilter();

  const queryOptions = useMemo(() => {
    if (sport) {
      return {
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          const { data, error } = await api.GET("/api/games/prematch/{sport}", {
            params: {
              path: { sport },
              query: pageParam,
            },
          });
          if (error) throw new Error("No data");
          return data;
        },
        queryKey: ["gamesPrematch", sport],
      };
    }

    return {
      initialData,
      queryFn: async ({ pageParam }: { pageParam: any }) => {
        const { data, error } = await api.GET("/api/games/prematch", {
          params: {
            query: pageParam,
          },
        });
        if (error) throw new Error("No data");
        return data;
      },
      queryKey: ["gamesPrematch"],
    };
  }, [initialData, sport]);

  return <GamesPrematch className={className} queryOptions={queryOptions} />;
};

export const GamesBySportPrematch = ({
  className,
  initialData,
  sport,
}: {
  className?: string;
  initialData?: TGames; // Сделали опциональным
  sport: string;
}) => {
  return (
    <GamesPrematch
      className={className}
      queryOptions={{
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          const { data, error } = await api.GET(
            "/api/games/prematch/{sport}",
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
        queryKey: ["gamesPrematch", sport],
      }}
    />
  );
};

export const AllGamesPrematch = ({
  className,
  initialData,
}: {
  className?: string;
  initialData?: TGames; // Сделали опциональным
}) => {
  return (
    <GamesPrematch
      className={className}
      queryOptions={{
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          const { data, error } = await api.GET("/api/games/prematch", {
            params: {
              query: pageParam,
            },
          });
          if (error) throw new Error("No data");
          return data;
        },
        queryKey: ["gamesPrematch"],
      }}
    />
  );
};

export const GamesPrematchBySportAndSubcategory = ({
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
    <GamesPrematch
      className={className}
      queryOptions={{
        initialData,
        queryFn: async ({ pageParam }: { pageParam: any }) => {
          const { data, error } = await api.GET(
            "/api/games/prematch/{sport}/{subcategory}",
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
        queryKey: ["games-prematch", sport, subcategory],
      }}
    />
  );
};
