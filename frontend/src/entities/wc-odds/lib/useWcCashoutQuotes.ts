"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useWebSocketContext } from "~/entities/game/lib/WebSocketContext";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { useAdaptivePollInterval } from "~/shared/lib/useAdaptivePollInterval";
import {
  fetchWcCashoutQuotes,
  type WcCashoutQuote,
} from "~/entities/wc-odds/api/client";

function mergeQuotes(
  prev: Record<number, WcCashoutQuote> | undefined,
  incoming: Record<number, WcCashoutQuote>,
  betIds: number[],
): Record<number, WcCashoutQuote> {
  const next = { ...(prev ?? {}) };
  for (const id of betIds) {
    if (incoming[id] != null) {
      next[id] = incoming[id];
    }
  }
  return next;
}

export function useWcCashoutQuotes(betIds: number[], enabled = true) {
  const sortedKey = [...betIds].sort((a, b) => a - b).join(",");
  const queryClient = useQueryClient();
  const { addMessageHandler, removeMessageHandler, isConnected } = useWebSocketContext();
  const fallbackPoll = useAdaptivePollInterval(30_000);
  const active = enabled && betIds.length > 0 && Boolean(getSessionClient());

  const query = useQuery({
    queryKey: ["wc-cashout-quotes", sortedKey],
    queryFn: async () => {
      const token = getSessionClient();
      if (!token) return {} as Record<number, WcCashoutQuote>;
      return fetchWcCashoutQuotes(token, betIds);
    },
    enabled: active,
    refetchInterval: active && !isConnected ? fallbackPoll : false,
    refetchIntervalInBackground: false,
    staleTime: 12_000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!active) return;

    const handleMessage = (message: {
      type?: string;
      payload?: { quotes?: Record<number, WcCashoutQuote> };
    }) => {
      if (message.type !== "wc_cashout_quotes" || !message.payload?.quotes) return;

      queryClient.setQueryData<Record<number, WcCashoutQuote>>(
        ["wc-cashout-quotes", sortedKey],
        (prev) => mergeQuotes(prev, message.payload!.quotes!, betIds),
      );
    };

    addMessageHandler(handleMessage);
    return () => removeMessageHandler(handleMessage);
  }, [active, addMessageHandler, removeMessageHandler, queryClient, sortedKey, betIds]);

  return query;
}
