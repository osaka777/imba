"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";
import { useLocale } from "~/shared/model/useLocale";
import {
  getMyKztForeignCardOrder,
  getMyRubForeignCardOrder,
  getUsdtTrc20OrderStatus,
} from "~/entities/finance/api/deposit";
import {
  getTrackedDepositOrders,
  untrackDepositOrder,
} from "~/shared/lib/appNotifications";

export const TrackedDepositPoller = () => {
  const { t } = useLocale();
  useEffect(() => {
    let active = true;

    const poll = async () => {
      const tracked = getTrackedDepositOrders();
      if (!tracked.length) return;

      for (const item of tracked) {
        try {
          const displayId = Number(item.publicOrderId ?? item.id);

          if (item.currency === "USDT") {
            const data = await getUsdtTrc20OrderStatus(item.id);
            const status = String(data?.status || "pending");
            if (status === "approved") {
              untrackDepositOrder(item.id);
              toast.success(t("deposit.orderApprovedId", { id: displayId }));
            } else if (status === "rejected" || status === "cancelled") {
              untrackDepositOrder(item.id);
              toast.error(t("deposit.orderRejectedId", { id: displayId }));
            } else if (status === "expired") {
              untrackDepositOrder(item.id);
              toast.info(t("deposit.orderExpiredId", { id: displayId }));
            }
            continue;
          }

          const fetcher =
            item.currency === "RUB"
              ? getMyRubForeignCardOrder
              : getMyKztForeignCardOrder;
          const { data } = await fetcher();
          const order = data as Record<string, unknown> | null | undefined;

          if (!order || !("id" in order)) {
            continue;
          }

          const status = String(order.status || "");
          if (status === "approved") {
            untrackDepositOrder(item.id);
            toast.success(t("deposit.orderApprovedId", { id: displayId }));
          } else if (status === "rejected") {
            untrackDepositOrder(item.id);
            toast.error(t("deposit.orderRejectedId", { id: displayId }));
          } else if (status === "expired") {
            untrackDepositOrder(item.id);
            toast.info(t("deposit.orderExpiredId", { id: displayId }));
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
