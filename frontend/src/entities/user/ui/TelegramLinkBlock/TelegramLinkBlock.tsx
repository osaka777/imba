"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLocale } from "~/shared/model/useLocale";

import tgStyles from "./TelegramLinkBlock.module.css";

function openTelegramDeepLink(deepLink: string) {
  const popup = window.open(deepLink, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(deepLink);
  }
}

function BenefitWithdrawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M4 10h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 15h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BenefitLockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 10V8a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="1.25" fill="currentColor" />
    </svg>
  );
}

function BenefitBetsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4.75h7.5A3.75 3.75 0 0 1 18.25 8.5v10a.75.75 0 0 1-1.2.6l-1.8-1.35H7A2.25 2.25 0 0 1 4.75 15.5v-8.5A2.25 2.25 0 0 1 7 4.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M8.5 9.5h6M8.5 13h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function BenefitGoalsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 3.75v3.5M12 16.75v3.5M3.75 12h3.5M16.75 12h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 8.25 14.6 10l-.9 3.1H10.3L9.4 10 12 8.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const { t } = useLocale();
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

  const benefits = useMemo(
    () => [
      { Icon: BenefitWithdrawIcon, label: t("profile.tgBenefitWithdraw") },
      { Icon: BenefitLockIcon, label: t("profile.tgBenefitReset") },
      { Icon: BenefitBetsIcon, label: t("profile.tgBenefitBets") },
      { Icon: BenefitGoalsIcon, label: t("profile.tgBenefitGoals") },
    ],
    [t],
  );

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
      toast.success(t("profile.tgLinked"));
    },
    [onLinkedChange, t],
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
      toast.error(t("profile.tgAuthRequired"));
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
      toast.error(t("profile.tgLinkFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      toast.success(t("profile.tgUnlinked"));
    } catch (error) {
      console.error(error);
      toast.error(t("profile.tgUnlinkFailed"));
    } finally {
      setLoading(false);
    }
  }, [onLinkedChange, t]);

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
        toast.error(t("profile.tgPrefSaveFailed"));
      }
    },
    [notifyBets, notifyDeposit, notifyLiveMatch, notifyPreMatch, notifyPromo, notifyWithdraw, t],
  );

  const toggle2fa = useCallback(async (value: boolean) => {
    const token = getSessionClient();
    if (!token) return;
    const prev = twoFaEnabled;
    setTwoFaEnabled(value);
    try {
      await updateTelegram2fa(token, value);
      toast.success(value ? t("profile.tg2faOn") : t("profile.tg2faOff"));
    } catch (error) {
      console.error(error);
      setTwoFaEnabled(prev);
      toast.error(t("profile.tg2faSaveFailed"));
    }
  }, [t, twoFaEnabled]);

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
    ? { label: t("profile.tgStatusLinked"), className: tgStyles.badgeLinked }
    : awaitingLink
      ? { label: t("profile.tgStatusPending"), className: tgStyles.badgePending }
      : { label: t("profile.tgStatusIdle"), className: tgStyles.badgeIdle };

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
                {t("profile.tgLinkedDesc")}
                {username ? (
                  <>
                    {" "}
                    {t("profile.tgLinkedWith")}{" "}
                    <span className={tgStyles.username}>@{username}</span>
                  </>
                ) : null}
                {t("profile.tgLinkedAfter")}
              </>
            ) : awaitingLink ? (
              t("profile.tgAwaitingDesc")
            ) : (
              t("profile.tgUnlinkedDesc")
            )}
          </p>
        </div>
      </div>

      {!linked && !awaitingLink ? (
        <div className={tgStyles.benefits}>
          {benefits.map((item) => (
            <div className={tgStyles.benefit} key={item.label}>
              <span className={tgStyles.benefitIcon} aria-hidden>
                <item.Icon />
              </span>
              <span className={tgStyles.benefitLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {awaitingLink && !linked ? (
        <div className={tgStyles.desktopConnectRow}>
          {pendingDeepLink ? (
            <div className={tgStyles.desktopQr}>
              <img
                alt={t("profile.tgQrAlt")}
                className={tgStyles.desktopQrImg}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(pendingDeepLink)}`}
              />
              <p className={tgStyles.desktopQrHint}>
                {t("profile.tgQrHint")}
              </p>
            </div>
          ) : null}
          <div className={tgStyles.steps}>
            <div className={tgStyles.step}>
              <span className={tgStyles.stepNum}>1</span>
              <span>{t("profile.tgStep1")}</span>
            </div>
            <div className={tgStyles.step}>
              <span className={tgStyles.stepNum}>2</span>
              <span>{t("profile.tgStep2")}</span>
            </div>
            <div className={tgStyles.step}>
              <span className={tgStyles.stepNum}>3</span>
              <span>{t("profile.tgStep3")}</span>
            </div>
          </div>
        </div>
      ) : null}

      {linked ? (
        <div className={prefsClassName}>
          <p className={tgStyles.prefsTitle}>{t("profile.tgNotifyTitle")}</p>
          {renderPrefToggle(t("profile.tgNotifyDeposit"), notifyDeposit, (v) => void savePref("deposit", v))}
          {renderPrefToggle(t("profile.tgNotifyWithdraw"), notifyWithdraw, (v) => void savePref("withdraw", v))}
          {renderPrefToggle(t("profile.tgNotifyBets"), notifyBets, (v) => void savePref("bets", v))}
          {renderPrefToggle(t("profile.tgNotifyLive"), notifyLiveMatch, (v) => void savePref("liveMatch", v))}
          {renderPrefToggle(t("profile.tgNotifyPreMatch"), notifyPreMatch, (v) => void savePref("preMatch", v))}
          {renderPrefToggle(t("profile.tgNotifyPromo"), notifyPromo, (v) => void savePref("promo", v))}
          {renderPrefToggle(t("profile.tgNotify2fa"), twoFaEnabled, (v) => void toggle2fa(v))}
        </div>
      ) : null}

      <div className={cn(tgStyles.actions, actionsClassName)}>
        {unlinkConfirm ? (
          <div className={tgStyles.unlinkConfirm}>
            <p className={tgStyles.unlinkConfirmText}>
              {t("profile.tgUnlinkConfirm")}
            </p>
            <div className={tgStyles.unlinkActions}>
              <button
                className={linkBtnClass}
                disabled={loading}
                onClick={() => void handleUnlink()}
                type="button"
              >
                {loading ? "..." : t("profile.tgUnlinkYes")}
              </button>
              <button
                className={buttonClassName}
                disabled={loading}
                onClick={() => setUnlinkConfirm(false)}
                type="button"
              >
                {t("profile.cancel")}
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
                ? t("profile.tgUnlinkBtn")
                : awaitingLink
                  ? t("profile.tgAwaitingBtn")
                  : t("profile.tgLinkBtn")}
          </button>
        )}
        {awaitingLink && !linked ? (
          <button
            className={buttonClassName}
            type="button"
            disabled={loading}
            onClick={() => void handleLink()}
          >
            {t("profile.tgReopenBot")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
