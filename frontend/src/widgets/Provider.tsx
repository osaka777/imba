"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useState } from "react";

// Создаем QueryClient только один раз при инициализации
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 10 * 1000, // 10 секунд для лучшего кэширования
      gcTime: 1000 * 60 * 3, // 3 минуты для экономии памяти
      // Добавляем ограничения для предотвращения утечек памяти
      maxRetries: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0, // Отключаем повторные попытки для мутаций
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    },
  },
});

export const Provider = ({ children }: { children: React.ReactNode }) => {
  // Используем useState для создания QueryClient только один раз
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ProgressBar shallowRouting />
    </QueryClientProvider>
  );
};
