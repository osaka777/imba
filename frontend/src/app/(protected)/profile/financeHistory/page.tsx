"use client";

import { useEffect, useState } from "react";
import { FinanceHistory } from "~/entities/finance";
import { getSessionClient } from "~/entities/user/lib";
import { api, components } from "~/shared/api";

type OperationsData = components["schemas"]["OperationDto"][];

export default function FinanceHistoryPage() {
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const token = getSessionClient();
        if (!token) {
          setError("Необходима авторизация для просмотра финансовых операций");
          setIsLoading(false);
          return;
        }

        const { data, error: apiError } = await api.GET("/api/finance/operation", {
    headers: {
            Authorization: `Bearer ${token}`,
    },
  });

        if (apiError) {
          console.error("Error fetching operations:", apiError);
          setError(`Ошибка при загрузке финансовых операций: ${(apiError as any)?.message || 'Неизвестная ошибка'}`);
        } else {
          setOperations(data);
        }
      } catch (err) {
        console.error("Unexpected error in FinanceHistoryPage:", err);
        setError("Неожиданная ошибка при загрузке финансовых операций");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOperations();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка финансовых операций...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h3 className="text-lg text-red-600">{error}</h3>
      </div>
    );
  }

  return <FinanceHistory operations={operations || undefined} />;
}
