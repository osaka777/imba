"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { TbBell, TbBellFilled } from "react-icons/tb";

import {
  fetchWcEventSubscription,
  subscribeWcEvent,
  unsubscribeWcEvent,
} from "~/entities/wc-odds/api/client";
import { getTelegramNotifications } from "~/entities/user/api/telegram";
import { getSessionClient } from "~/entities/user/lib";
import { cn } from "~/shared/lib";

import styles from "~/entities/wc-odds/ui/WcMatchTelegramSubscribe.module.css";

type WcMatchTelegramSubscribeProps = {
  eventRef: string;
  variant?: "meta";
};

export function WcMatchTelegramSubscribe({
  eventRef,
  variant = "meta",
}: WcMatchTelegramSubscribeProps) {
  const [linked, setLinked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getSessionClient();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [prefs, sub] = await Promise.all([
        getTelegramNotifications(token),
        fetchWcEventSubscription(token, eventRef),
      ]);
      setLinked(prefs.linked);
      setSubscribed(sub.subscribed);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [eventRef]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async () => {
    const token = getSessionClient();
    if (!token) {
      toast.error("Войдите в аккаунт");
      return;
    }

    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribeWcEvent(token, eventRef);
        setSubscribed(false);
        toast.success("Уведомления по матчу отключены");
      } else {
        await subscribeWcEvent(token, eventRef);
        setSubscribed(true);
        toast.success("Голы и старт матча — в Telegram");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [eventRef, subscribed]);

  if (loading || !linked || variant !== "meta") return null;

  const label = subscribed
    ? "Уведомления в Telegram включены"
    : "Уведомления о голах в Telegram";

  return (
    <button
      type="button"
      className={cn(styles.metaBtn, subscribed && styles.metaBtnActive)}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
      aria-label={label}
      title={label}
    >
      {subscribed ? (
        <TbBellFilled className={styles.icon} aria-hidden />
      ) : (
        <TbBell className={styles.icon} aria-hidden />
      )}
    </button>
  );
}
