"use client";

import { api } from "~/shared/api";

import { Games as TGames } from "../../types";
import { GamesPrematch } from "./GamesPrematch";

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
