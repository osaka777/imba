"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TelegramSvgrepoIcon } from "~/shared/assets/icons";
import { getTelegramAuthConfig } from "~/entities/user/api/telegramAuth";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./TelegramAuthButton.module.css";

type TelegramAuthButtonProps = {
  onAuth: (user: Record<string, unknown>) => void;
  disabled?: boolean;
};

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (
          options: { bot_id: string; request_access?: boolean | string },
          callback: (data: Record<string, unknown> | false) => void,
        ) => void;
      };
    };
  }
}

let widgetScriptPromise: Promise<void> | null = null;

function loadTelegramWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Telegram?.Login) return Promise.resolve();

  if (!widgetScriptPromise) {
    widgetScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src*="telegram-widget.js"]',
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Telegram widget failed to load"));
      document.head.appendChild(script);
    });
  }

  return widgetScriptPromise;
}

export function TelegramAuthButton({ onAuth, disabled = false }: TelegramAuthButtonProps) {
  const onAuthRef = useRef(onAuth);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { t } = useLocale();

  onAuthRef.current = onAuth;

  useEffect(() => {
    let cancelled = false;
    void loadTelegramWidgetScript()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (disabled || loading) return;

    setLoading(true);
    try {
      await loadTelegramWidgetScript();
      const { botId } = await getTelegramAuthConfig();

      if (!window.Telegram?.Login) {
        throw new Error("Telegram login unavailable");
      }

      window.Telegram.Login.auth(
        { bot_id: botId, request_access: "write" },
        (data) => {
          setLoading(false);
          if (!data) return;
          onAuthRef.current(data);
        },
      );
    } catch {
      setLoading(false);
    }
  }, [disabled, loading]);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        disabled={disabled || loading || !ready}
        onClick={() => void handleClick()}
      >
        <TelegramSvgrepoIcon aria-hidden className={styles.icon} />
        <span>{loading ? t("auth.connecting") : t("auth.loginTelegram")}</span>
      </button>
    </div>
  );
}
