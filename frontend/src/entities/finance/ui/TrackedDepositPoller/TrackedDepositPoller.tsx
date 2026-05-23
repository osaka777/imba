"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";
import {
  getMyKztForeignCardOrder,
  getMyRubForeignCardOrder,
} from "~/entities/finance/api/deposit";
import {
  getTrackedDepositOrders,
  untrackDepositOrder,
} from "~/shared/lib/appNotifications";

export const TrackedDepositPoller = () => {
  useEffect(() => {
    let active = true;

    const poll = async () => {
      const tracked = getTrackedDepositOrders();
      if (!tracked.length) return;

      for (const item of tracked) {
        try {
          const fetcher =
            item.currency === "RUB"
              ? getMyRubForeignCardOrder
              : getMyKztForeignCardOrder;
          const { data } = await fetcher();
          const order = data as Record<string, unknown> | null | undefined;
          const displayId = Number(item.publicOrderId ?? item.id);

          if (!order || !("id" in order)) {
            untrackDepositOrder(item.id);
            toast.success(`Заявка #${displayId} обработана`);
            continue;
          }

          const status = String(order.status || "");
          if (status === "approved") {
            untrackDepositOrder(item.id);
            toast.success(`Заявка #${displayId} одобрена`);
          } else if (status === "rejected") {
            untrackDepositOrder(item.id);
            toast.error(`Заявка #${displayId} отклонена`);
          } else if (status === "expired") {
            untrackDepositOrder(item.id);
            toast.info(`Заявка #${displayId} истекла`);
          }
        } catch {
          // ignore transient errors
        }
      }
    };

    const id = setInterval(() => {
      if (active) void poll();
    }, 8000);
    void poll();

    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return null;
};
