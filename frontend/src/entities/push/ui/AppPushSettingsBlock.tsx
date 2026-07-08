"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { getSessionClient } from "~/entities/user/lib";
import {
  getPushNotifications,
  updatePushNotifications,
} from "~/entities/push/api/push";
import {
  getNativeFcmToken,
  hasNativeNotificationPermission,
  isNativeApp,
  requestNativeNotificationPermission,
} from "~/entities/push/lib/nativeApp";

import styles from "./AppPushSettingsBlock.module.css";

type ToggleKey = "bets" | "deposit" | "withdraw" | "promo" | "liveMatch";

export function AppPushSettingsBlock() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({
    bets: true,
    deposit: true,
    withdraw: true,
    promo: false,
    liveMatch: true,
  });

  const load = useCallback(async () => {
    if (!isNativeApp()) {
      setLoading(false);
      return;
    }

    const granted = hasNativeNotificationPermission();
    setEnabled(granted);

    const token = getSessionClient();
    const fcmToken = getNativeFcmToken();
    if (!token || !fcmToken || !granted) {
      setLoading(false);
      return;
    }

    try {
      const data = await getPushNotifications(token, fcmToken);
      setPrefs({
        bets: data.bets,
        deposit: data.deposit,
        withdraw: data.withdraw,
        promo: data.promo,
        liveMatch: data.liveMatch,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onPermission = () => void load();
    window.addEventListener("imba:notification-permission", onPermission);
    window.addEventListener("imba:fcm-token", onPermission);
    return () => {
      window.removeEventListener("imba:notification-permission", onPermission);
      window.removeEventListener("imba:fcm-token", onPermission);
    };
  }, [load]);

  if (!isNativeApp()) return null;

  const toggle = async (key: ToggleKey, value: boolean) => {
    const token = getSessionClient();
    const fcmToken = getNativeFcmToken();
    if (!token || !fcmToken) return;

    setPrefs((prev) => ({ ...prev, [key]: value }));
    try {
      await updatePushNotifications(token, fcmToken, { [key]: value });
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !value }));
      toast.error("Не удалось сохранить настройку");
    }
  };

  return (
    <section className={styles.block}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Push в приложении</h3>
          <p className={styles.desc}>
            Уведомления на телефон, когда приложение свёрнуто.
          </p>
        </div>
        {!enabled ? (
          <button
            className={styles.enableBtn}
            onClick={() => requestNativeNotificationPermission()}
            type="button"
          >
            Включить
          </button>
        ) : (
          <span className={styles.enabledBadge}>Включено</span>
        )}
      </div>

      {enabled ? (
        <div className={loading ? styles.prefsMuted : styles.prefs}>
          {([
            ["bets", "Расчёт ставок"],
            ["deposit", "Пополнения"],
            ["withdraw", "Выводы"],
            ["promo", "Акции и бонусы"],
            ["liveMatch", "Live-матчи"],
          ] as const).map(([key, label]) => (
            <label className={styles.row} key={key}>
              <span>{label}</span>
              <input
                checked={prefs[key]}
                disabled={loading}
                onChange={(e) => void toggle(key, e.target.checked)}
                type="checkbox"
              />
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
