"use client";

import { ReactNode } from "react";

import { DepositNotificationsProvider } from "~/entities/finance/providers/DepositNotificationsProvider";
import { WebSocketProvider } from "~/entities/game/lib/WebSocketContext";

export const RealtimeProviders = ({ children }: { children: ReactNode }) => (
  <WebSocketProvider>
    <DepositNotificationsProvider>{children}</DepositNotificationsProvider>
  </WebSocketProvider>
);
