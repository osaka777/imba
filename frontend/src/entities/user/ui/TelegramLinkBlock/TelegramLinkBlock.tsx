"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  createTelegramLinkToken,
  getTelegramNotifications,
  unlinkTelegram,
  updateTelegram2fa,
  updateTelegramNotifications,
} from "~/entities/user/api/telegram";
import { getSessionClient } from "~/entities/user/lib";

function openTelegramDeepLink(deepLink: string) {
  const popup = window.open(deepLink, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(deepLink);
  }
}

type TelegramLinkBlockProps = {
  linked?: boolean;
  username?: string | null;
  className?: string;
  headClassName?: string;
  buttonClassName?: string;
  unlinkButtonClassName?: string;
  labelClassName?: string;
  descClassName?: string;
  prefsClassName?: string;
  prefRowClassName?: string;
  toggleClassName?: string;
  toggleSliderClassName?: string;
  actionsClassName?: string;
  onLinkedChange?: (linked: boolean, username?: string | null) => void;
};

export function TelegramLinkBlock({
  linked: linkedProp = false,
  username: usernameProp = "",
  className,
  headClassName,
  buttonClassName,
  unlinkButtonClassName,
  labelClassName,
  descClassName,
  prefsClassName,
  prefRowClassName,
  toggleClassName,
  toggleSliderClassName,
  actionsClassName,
  onLinkedChange,
}: TelegramLinkBlockProps) {
  const [linked, setLinked] = useState(linkedProp);
  const [username, setUsername] = useState(usernameProp || "");
  const [loading, setLoading] = useState(false);
  const [awaitingLink, setAwaitingLink] = useState(false);
  const [notifyDeposit, setNotifyDeposit] = useState(true);
  const [notifyWithdraw, setNotifyWithdraw] = useState(true);
  const [notifyBets, setNotifyBets] = useState(true);
  const [notifyPromo, setNotifyPromo] = useState(false);
  const [notifyLiveMatch, setNotifyLiveMatch] = useState(true);
  const [notifyPreMatch, setNotifyPreMatch] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const pollUntilRef = useRef(0);

  useEffect(() => {
    setLinked(linkedProp);
    setUsername(usernameProp || "");
  }, [linkedProp, usernameProp]);

  const applyLinked = useCallback(
    (nextUsername?: string | null) => {
      setLinked(true);
      setAwaitingLink(false);
      setUsername(nextUsername || "");
      onLinkedChange?.(true, nextUsername || null);
      toast.success("Telegram привязан");
    },
    [onLinkedChange],
  );

  const loadPrefs = useCallback(async () => {
    const token = getSessionClient();
    if (!token) return;
    setPrefsLoading(true);
    try {
      const prefs = await getTelegramNotifications(token);
      if (prefs.linked) {
        setLinked(true);
      }
      setNotifyDeposit(prefs.deposit);
      setNotifyWithdraw(prefs.withdraw);
      setNotifyBets(prefs.bets);
      setNotifyPromo(prefs.promo);
      setNotifyLiveMatch(prefs.liveMatch);
      setNotifyPreMatch(prefs.preMatch);
      setTwoFaEnabled(prefs.twoFaEnabled);
    } catch {
      // ignore
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (linked) {
      void loadPrefs();
    }
  }, [linked, loadPrefs]);

  useEffect(() => {
    if (!awaitingLink || linked) return;
    const token = getSessionClient();
    if (!token) return;

    pollUntilRef.current = Date.now() + 3 * 60 * 1000;
    const timer = window.setInterval(() => {
      if (Date.now() > pollUntilRef.current) {
        setAwaitingLink(false);
        window.clearInterval(timer);
        return;
      }
      getTelegramNotifications(token)
        .then((prefs) => {
          if (prefs.linked) {
            applyLinked(username || null);
            window.clearInterval(timer);
          }
        })
        .catch(() => undefined);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [applyLinked, awaitingLink, linked, username]);

  const handleLink = useCallback(async () => {
    const token = getSessionClient();
    if (!token) {
      toast.error("Необходима авторизация — перезайдите в аккаунт");
      return;
    }

    setLoading(true);
    try {
      const { deepLink } = await createTelegramLinkToken(token);
      setAwaitingLink(true);
      openTelegramDeepLink(deepLink);
      toast.info("Откройте Telegram и нажмите Start в боте");
    } catch (error) {
      console.error(error);
      toast.error("Не удалось создать ссылку для привязки");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUnlink = useCallback(async () => {
    const token = getSessionClient();
    if (!token) return;

    setLoading(true);
    try {
      await unlinkTelegram(token);
      setLinked(false);
      setUsername("");
      setTwoFaEnabled(false);
      onLinkedChange?.(false, null);
      toast.success("Telegram отвязан");
    } catch (error) {
      console.error(error);
      toast.error("Не удалось отвязать Telegram");
    } finally {
      setLoading(false);
    }
  }, [onLinkedChange]);

  const savePref = useCallback(
    async (key: "deposit" | "withdraw" | "bets" | "promo" | "liveMatch" | "preMatch", value: boolean) => {
      const token = getSessionClient();
      if (!token) return;

      const prev = {
        deposit: notifyDeposit,
        withdraw: notifyWithdraw,
        bets: notifyBets,
        promo: notifyPromo,
        liveMatch: notifyLiveMatch,
        preMatch: notifyPreMatch,
      };
      if (key === "deposit") setNotifyDeposit(value);
      if (key === "withdraw") setNotifyWithdraw(value);
      if (key === "bets") setNotifyBets(value);
      if (key === "promo") setNotifyPromo(value);
      if (key === "liveMatch") setNotifyLiveMatch(value);
      if (key === "preMatch") setNotifyPreMatch(value);

      try {
        await updateTelegramNotifications(token, { [key]: value });
      } catch (error) {
        console.error(error);
        setNotifyDeposit(prev.deposit);
        setNotifyWithdraw(prev.withdraw);
        setNotifyBets(prev.bets);
        setNotifyPromo(prev.promo);
        setNotifyLiveMatch(prev.liveMatch);
        setNotifyPreMatch(prev.preMatch);
        toast.error("Не удалось сохранить настройку");
      }
    },
    [notifyBets, notifyDeposit, notifyLiveMatch, notifyPreMatch, notifyPromo, notifyWithdraw],
  );

  const toggle2fa = useCallback(async (value: boolean) => {
    const token = getSessionClient();
    if (!token) return;
    const prev = twoFaEnabled;
    setTwoFaEnabled(value);
    try {
      await updateTelegram2fa(token, value);
      toast.success(value ? "2FA через Telegram включена" : "2FA отключена");
    } catch (error) {
      console.error(error);
      setTwoFaEnabled(prev);
      toast.error("Не удалось сохранить 2FA");
    }
  }, [twoFaEnabled]);

  const renderPrefToggle = (
    label: string,
    checked: boolean,
    onChange: (value: boolean) => void,
  ) => {
    if (toggleClassName && toggleSliderClassName && prefRowClassName) {
      return (
        <label className={prefRowClassName}>
          <span>{label}</span>
          <span className={toggleClassName}>
            <input
              type="checkbox"
              checked={checked}
              disabled={prefsLoading}
              onChange={(e) => void onChange(e.target.checked)}
            />
            <span className={toggleSliderClassName} />
          </span>
        </label>
      );
    }

    return (
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={prefsLoading}
          onChange={(e) => void onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  };

  const linkBtnClass = linked ? unlinkButtonClassName ?? buttonClassName : buttonClassName;

  return (
    <div className={className}>
      <div className={headClassName}>
        {labelClassName ? <div className={labelClassName}>Telegram</div> : null}
        {descClassName ? (
          <div className={descClassName}>
            {linked
              ? `Привязан${username ? `: @${username}` : ""}. Сброс пароля и уведомления — через бота.`
              : awaitingLink
                ? "Ожидаем подтверждение в боте…"
                : "Привяжите бота @imbabetalert_bot для сброса пароля и уведомлений"}
          </div>
        ) : (
          <p>
            {linked
              ? `Привязан${username ? `: @${username}` : ""}`
              : awaitingLink
                ? "Ожидаем подтверждение в боте…"
                : "Привяжите бота @imbabetalert_bot"}
          </p>
        )}
      </div>

      {linked ? (
        <div className={prefsClassName}>
          {renderPrefToggle("Пополнения", notifyDeposit, (v) => void savePref("deposit", v))}
          {renderPrefToggle("Выводы", notifyWithdraw, (v) => void savePref("withdraw", v))}
          {renderPrefToggle("Расчёт ставок", notifyBets, (v) => void savePref("bets", v))}
          {renderPrefToggle("Live: голы и старт матча", notifyLiveMatch, (v) => void savePref("liveMatch", v))}
          {renderPrefToggle("Напоминание за час до матча", notifyPreMatch, (v) => void savePref("preMatch", v))}
          {renderPrefToggle("Акции и бонусы", notifyPromo, (v) => void savePref("promo", v))}
          {renderPrefToggle("2FA при входе с нового устройства", twoFaEnabled, (v) => void toggle2fa(v))}
        </div>
      ) : null}

      <div className={actionsClassName}>
        <button
          className={linkBtnClass}
          type="button"
          disabled={loading}
          onClick={linked ? handleUnlink : handleLink}
        >
          {loading ? "..." : linked ? "Отвязать Telegram" : awaitingLink ? "Ожидание бота…" : "Привязать Telegram"}
        </button>
      </div>
    </div>
  );
}
