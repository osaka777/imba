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
import { useTelegramLinkEvent } from "~/entities/user/lib/useTelegramLinkEvent";
import { getSessionClient } from "~/entities/user/lib";
import { TelegramSvgrepoIcon } from "~/shared/assets/icons";
import { cn } from "~/shared/lib";

import tgStyles from "./TelegramLinkBlock.module.css";

function openTelegramDeepLink(deepLink: string) {
  const popup = window.open(deepLink, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(deepLink);
  }
}

const BENEFITS = [
  { icon: "🔐", label: "Сброс пароля" },
  { icon: "🔔", label: "Расчёт ставок" },
  { icon: "⚽", label: "Голы и старт матча" },
  { icon: "🛡", label: "2FA при входе" },
] as const;

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
  highlight?: boolean;
};

export function TelegramLinkBlock({
  linked: linkedProp = false,
  username: usernameProp = "",
  className,
  buttonClassName,
  unlinkButtonClassName,
  prefsClassName,
  prefRowClassName,
  toggleClassName,
  toggleSliderClassName,
  actionsClassName,
  onLinkedChange,
  highlight = false,
}: TelegramLinkBlockProps) {
  const [linked, setLinked] = useState(linkedProp);
  const [username, setUsername] = useState(usernameProp || "");
  const [loading, setLoading] = useState(false);
  const [awaitingLink, setAwaitingLink] = useState(false);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
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
      setUnlinkConfirm(false);
      setUsername(nextUsername || "");
      onLinkedChange?.(true, nextUsername || null);
      toast.success("Telegram привязан");
    },
    [onLinkedChange],
  );

  useTelegramLinkEvent(
    useCallback(
      (detail) => {
        if (linked) return;
        applyLinked(detail.username);
      },
      [applyLinked, linked],
    ),
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
      setPendingDeepLink(deepLink);
      setAwaitingLink(true);
      openTelegramDeepLink(deepLink);
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
      setUnlinkConfirm(false);
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
  const statusBadge = linked
    ? { label: "Привязан", className: tgStyles.badgeLinked }
    : awaitingLink
      ? { label: "Ожидание", className: tgStyles.badgePending }
      : { label: "Не привязан", className: tgStyles.badgeIdle };

  return (
    <div className={cn(tgStyles.root, className)} data-telegram-highlight={highlight || undefined}>
      <div className={tgStyles.hero}>
        <div className={tgStyles.iconWrap}>
          <TelegramSvgrepoIcon />
        </div>
        <div className={tgStyles.heroText}>
          <div className={tgStyles.titleRow}>
            <h3 className={tgStyles.title}>Telegram</h3>
            <span className={cn(tgStyles.badge, statusBadge.className)}>
              <span className={tgStyles.badgeDot} aria-hidden />
              {statusBadge.label}
            </span>
          </div>
          <p className={tgStyles.desc}>
            {linked ? (
              <>
                Аккаунт связан
                {username ? (
                  <>
                    {" "}
                    с <span className={tgStyles.username}>@{username}</span>
                  </>
                ) : null}
                . Уведомления и безопасность — через бота.
              </>
            ) : awaitingLink ? (
              "Откройте бота и нажмите Start — статус обновится автоматически."
            ) : (
              "Привяжите @imbabetalert_bot: сброс пароля, уведомления о ставках и матчах."
            )}
          </p>
        </div>
      </div>

      {!linked && !awaitingLink ? (
        <div className={tgStyles.benefits}>
          {BENEFITS.map((item) => (
            <div className={tgStyles.benefit} key={item.label}>
              <span className={tgStyles.benefitIcon} aria-hidden>{item.icon}</span>
              <span className={tgStyles.benefitLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {awaitingLink && !linked && pendingDeepLink ? (
        <div className={tgStyles.desktopQr}>
          <img
            alt="QR для привязки Telegram"
            className={tgStyles.desktopQrImg}
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(pendingDeepLink)}`}
          />
          <p className={tgStyles.desktopQrHint}>
            На компьютере: отсканируйте QR камерой телефона
          </p>
        </div>
      ) : null}

      {awaitingLink && !linked ? (
        <div className={tgStyles.steps}>
          <div className={tgStyles.step}>
            <span className={tgStyles.stepNum}>1</span>
            <span>Откройте Telegram — вкладка с ботом уже должна быть открыта</span>
          </div>
          <div className={tgStyles.step}>
            <span className={tgStyles.stepNum}>2</span>
            <span>Нажмите <strong>Start</strong> или «Запустить» в чате с ботом</span>
          </div>
          <div className={tgStyles.step}>
            <span className={tgStyles.stepNum}>3</span>
            <span>Вернитесь сюда — привязка подтвердится за пару секунд</span>
          </div>
        </div>
      ) : null}

      {linked ? (
        <div className={prefsClassName}>
          <p className={tgStyles.prefsTitle}>Уведомления</p>
          {renderPrefToggle("Пополнения", notifyDeposit, (v) => void savePref("deposit", v))}
          {renderPrefToggle("Выводы", notifyWithdraw, (v) => void savePref("withdraw", v))}
          {renderPrefToggle("Расчёт ставок", notifyBets, (v) => void savePref("bets", v))}
          {renderPrefToggle("Live: голы и старт", notifyLiveMatch, (v) => void savePref("liveMatch", v))}
          {renderPrefToggle("За час до матча", notifyPreMatch, (v) => void savePref("preMatch", v))}
          {renderPrefToggle("Акции и бонусы", notifyPromo, (v) => void savePref("promo", v))}
          {renderPrefToggle("2FA с нового устройства", twoFaEnabled, (v) => void toggle2fa(v))}
        </div>
      ) : null}

      <div className={cn(tgStyles.actions, actionsClassName)}>
        {unlinkConfirm ? (
          <div className={tgStyles.unlinkConfirm}>
            <p className={tgStyles.unlinkConfirmText}>
              Отвязать Telegram? Сброс пароля и уведомления через бота перестанут работать.
            </p>
            <div className={tgStyles.unlinkActions}>
              <button
                className={linkBtnClass}
                disabled={loading}
                onClick={() => void handleUnlink()}
                type="button"
              >
                {loading ? "..." : "Да, отвязать"}
              </button>
              <button
                className={buttonClassName}
                disabled={loading}
                onClick={() => setUnlinkConfirm(false)}
                type="button"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            className={linkBtnClass}
            type="button"
            disabled={loading || (awaitingLink && !linked)}
            onClick={
              linked
                ? () => setUnlinkConfirm(true)
                : awaitingLink
                  ? undefined
                  : () => void handleLink()
            }
          >
            {loading
              ? "..."
              : linked
                ? "Отвязать Telegram"
                : awaitingLink
                  ? "Ждём подтверждение в боте…"
                  : "Привязать Telegram"}
          </button>
        )}
        {awaitingLink && !linked ? (
          <button
            className={buttonClassName}
            type="button"
            disabled={loading}
            onClick={() => void handleLink()}
          >
            Открыть бота снова
          </button>
        ) : null}
      </div>
    </div>
  );
}
