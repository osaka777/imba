"use client";

import { useQuery } from "@tanstack/react-query";
import { BetsHistory } from "~/entities/bet";
import { getSessionClient } from "~/entities/user/lib";
import { api, components } from "~/shared/api";

type BetsData = {
  express: components["schemas"]["ExpressBetDto"][];
  ordinar: components["schemas"]["BetDto"][];
};

export default function BetHistoryPage() {
  const { data: bets, isLoading, error } = useQuery<BetsData>({
    queryKey: ["bets-history"],
    queryFn: async (): Promise<BetsData> => {
      const token = getSessionClient();
      if (!token) {
        throw new Error("Необходима авторизация для просмотра истории ставок");
      }

      const { data, error: apiError } = await api.GET("/api/bet", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (apiError) {
        console.error("Error fetching bets:", apiError);
        throw new Error(`Ошибка при загрузке истории ставок: ${(apiError as any)?.message || 'Неизвестная ошибка'}`);
      }

      return data || { express: [], ordinar: [] };
    },
    refetchInterval: 30000, // Обновляем каждые 30 секунд для отслеживания изменений статуса
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка истории ставок...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h3 className="text-lg text-red-600">
          {error instanceof Error ? error.message : "Неожиданная ошибка при загрузке истории ставок"}
        </h3>
      </div>
    );
  }

  return <BetsHistory bets={bets} />;
}
