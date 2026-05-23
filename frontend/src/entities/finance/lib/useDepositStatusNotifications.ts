"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "~/app/providers/AuthProvider";
import { getUser } from "~/entities/user/api";
import { useWebSocketContext } from "~/entities/game/lib/WebSocketContext";
import {
  emitDepositResult,
  untrackDepositOrder,
} from "~/shared/lib/appNotifications";

type DepositWsPayload = {
  orderId: number;
  publicOrderId?: number;
  status: "approved" | "rejected" | "expired";
  amount?: number;
  currency?: string;
};

export const useDepositStatusNotifications = () => {
  const { isAuth } = useAuth();
  const queryClient = useQueryClient();
  const {
    subscribe,
    unsubscribe,
    sendJsonMessage,
    addMessageHandler,
    removeMessageHandler,
    isConnected,
  } = useWebSocketContext();
  const subscribedRef = useRef(false);

  const { data: userData } = useQuery({
    queryFn: getUser,
    queryKey: ["user"],
    enabled: isAuth,
  });

  useEffect(() => {
    if (!isAuth || !userData?.id) return;

    const eventId = `user_${userData.id}`;
    subscribe(eventId, "detailed");

    return () => {
      unsubscribe(eventId);
    };
  }, [isAuth, userData?.id, subscribe, unsubscribe]);

  useEffect(() => {
    if (!isAuth || !isConnected || !userData?.id) return;

    const userId = userData.id.toString();
    const eventId = `user_${userId}`;

    if (!subscribedRef.current) {
      subscribedRef.current = true;
      sendJsonMessage({ type: "subscribe_user", userId });
      sendJsonMessage({
        type: "subscribe",
        filter: { eventIds: [eventId], subscriptionType: "detailed" },
      });
    }

    const handleMessage = (message: Record<string, unknown>) => {
      if (
        message.status === "success" ||
        message.type === "heartbeat" ||
        message.type === "pong" ||
        message.type === "connection" ||
        message.type === "subscribed" ||
        message.type === "unsubscribed"
      ) {
        return;
      }

      if (message.type !== "deposit_status_changed") return;

      const msgEventId = message.eventId as string | undefined;
      if (msgEventId && msgEventId !== eventId) return;

      const payload = message.payload as DepositWsPayload | undefined;
      if (!payload?.orderId || !payload.status) return;

      untrackDepositOrder(payload.orderId);
      emitDepositResult({
        orderId: payload.orderId,
        publicOrderId: payload.publicOrderId,
        status: payload.status,
        currency:
          payload.currency === "RUB" || payload.currency === "KZT"
            ? payload.currency
            : undefined,
        amount: payload.amount,
      });

      queryClient.invalidateQueries({ queryKey: ["user"] });
    };

    addMessageHandler(handleMessage);

    return () => {
      subscribedRef.current = false;
      removeMessageHandler(handleMessage);
    };
  }, [
    isAuth,
    isConnected,
    userData?.id,
    addMessageHandler,
    removeMessageHandler,
    queryClient,
    sendJsonMessage,
  ]);
};
