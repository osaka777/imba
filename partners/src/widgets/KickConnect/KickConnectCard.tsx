"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  disconnectKickAction,
  getKickSessionsAction,
  getKickStatusAction,
  resubscribeKickWebhooksAction,
  startKickConnectAction,
} from "@/entities/kick/actions";
import type { KickSession, KickStatus } from "@/entities/kick/api";
import { buildKickReferralLink } from "@/shared/lib/buildKickReferralLink";
import { buildKickShortUrl } from "@/shared/lib/kickShortUrl";
import { KickShortLinkQr } from "@/widgets/KickShortLinkQr/KickShortLinkQr";
import { markKickLinkChecklistDone } from "@/widgets/KickOnboardingChecklist/KickOnboardingChecklist";

import styles from "./KickConnectCard.module.css";

const KICK_ERROR_LABELS: Record<string, string> = {
  channel_taken: "этот Kick-канал уже привязан к другому партнёрскому аккаунту",
  exchange_failed: "ошибка обмена токена",
  invalid_state: "неверная сессия OAuth",
  missing_code: "нет кода авторизации",
  no_access_token: "Kick не вернул access token",
};

function formatKickError(reason?: string | null) {
  if (!reason) return null;
  return KICK_ERROR_LABELS[reason] ?? reason;
}

type Props = {
  referralLink: string;
  partnerUid: string;
  initialNotice?: "connected" | "error" | null;
  errorReason?: string | null;
  initialStatus: KickStatus | null;
  initialSessions: KickSession[];
};

function formatActionError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function KickConnectCard({
  referralLink,
  partnerUid,
  initialNotice,
  errorReason,
  initialStatus,
  initialSessions,
}: Props) {
  const [status, setStatus] = useState<KickStatus | null>(initialStatus);
  const [sessions, setSessions] = useState<KickSession[]>(initialSessions);
  const [copied, setCopied] = useState(false);
  const [shortCopied, setShortCopied] = useState(false);
  const [widgetCopied, setWidgetCopied] = useState(false);
  const [alertsCopied, setAlertsCopied] = useState(false);
  const [linkStatus, setLinkStatus] = useState<"unknown" | "ok" | "fail">("unknown");
  const [isPending, startTransition] = useTransition();

  const widgetUrl = useMemo(
    () => `https://partners.imba.bet/widget/${partnerUid}`,
    [partnerUid],
  );

  const alertsWidgetUrl = useMemo(
    () => `https://partners.imba.bet/widget/${partnerUid}/alerts`,
    [partnerUid],
  );

  const kickLink = useMemo(
    () =>
      buildKickReferralLink(
        referralLink,
        status?.channelSlug,
        status?.isLive ? status.activeSessionId : null,
      ),
    [referralLink, status?.channelSlug, status?.isLive, status?.activeSessionId],
  );

  const shortLink = useMemo(
    () => buildKickShortUrl(status?.channelSlug),
    [status?.channelSlug],
  );

  const chatLink = shortLink ?? kickLink;

  useEffect(() => {
    if (!status?.channelSlug || !status?.connected) {
      setLinkStatus("unknown");
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/kick/click/${encodeURIComponent(status.channelSlug!)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { found?: boolean };
        if (!cancelled) setLinkStatus(json.found ? "ok" : "fail");
      } catch {
        if (!cancelled) setLinkStatus("fail");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [status?.channelSlug, status?.connected]);

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const [nextStatus, nextSessions] = await Promise.all([
          getKickStatusAction(),
          getKickSessionsAction(),
        ]);
        setStatus(nextStatus);
        setSessions(nextSessions);
      } catch {
        /* keep previous state */
      }
    });
  }, []);

  const connectKick = () => {
    startTransition(async () => {
      try {
        const { authorizeUrl } = await startKickConnectAction();
        window.location.href = authorizeUrl;
      } catch (error) {
        alert(formatActionError(error, "Не удалось подключить Kick"));
      }
    });
  };

  const disconnectKick = () => {
    if (!window.confirm("Отключить Kick-канал от imba.bet?")) return;
    startTransition(async () => {
      try {
        await disconnectKickAction();
        setStatus(await getKickStatusAction());
        setSessions([]);
      } catch {
        alert("Не удалось отключить Kick");
      }
    });
  };

  const resubscribeWebhooks = () => {
    startTransition(async () => {
      try {
        await resubscribeKickWebhooksAction();
        alert("Подписки webhook обновлены (эфир + чат-бот)");
      } catch {
        alert("Не удалось обновить подписки Kick");
      }
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(chatLink);
      markKickLinkChecklistDone();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const copyShortLink = async () => {
    if (!shortLink) return;
    try {
      await navigator.clipboard.writeText(shortLink);
      markKickLinkChecklistDone();
      setShortCopied(true);
      setTimeout(() => setShortCopied(false), 2000);
    } catch {
      setShortCopied(false);
    }
  };

  const copyWidgetUrl = async () => {
    try {
      await navigator.clipboard.writeText(widgetUrl);
      setWidgetCopied(true);
      setTimeout(() => setWidgetCopied(false), 2000);
    } catch {
      setWidgetCopied(false);
    }
  };

  const copyAlertsUrl = async () => {
    try {
      await navigator.clipboard.writeText(alertsWidgetUrl);
      setAlertsCopied(true);
      setTimeout(() => setAlertsCopied(false), 2000);
    } catch {
      setAlertsCopied(false);
    }
  };

  const kickNotConfigured = status?.configured === false;
  const connectDisabled = isPending || kickNotConfigured;
  const tokenNeedsReconnect = Boolean(status?.connected && status.tokenRefreshFailedAt);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Kick для стримеров</h2>
        {status?.connected ? (
          <span
            className={`${styles.badge} ${
              status.isLive ? styles.badgeLive : styles.badgeOffline
            }`}
          >
            {status.isLive ? "В эфире" : "Подключён"}
          </span>
        ) : (
          <span className={`${styles.badge} ${styles.badgePending}`}>Не подключён</span>
        )}
      </div>

      {initialNotice === "connected" ? (
        <div className={`${styles.alert} ${styles.alertSuccess}`}>
          Kick подключён. На баланс начислен welcome-бонус $10 — к выводу откроется после
          первой приведённой регистрации (мин. вывод $50).
        </div>
      ) : null}

      {initialNotice === "error" ? (
        <div className={`${styles.alert} ${styles.alertError}`}>
          Не удалось завершить подключение Kick
          {formatKickError(errorReason)
            ? `: ${formatKickError(errorReason)}`
            : errorReason
              ? `: ${errorReason}`
              : "."}
        </div>
      ) : null}

      {kickNotConfigured ? (
        <div className={`${styles.alert} ${styles.alertError}`}>
          Kick Dev не настроен на сервере. Обратитесь в поддержку imba.bet.
        </div>
      ) : null}

      {tokenNeedsReconnect ? (
        <div className={`${styles.alert} ${styles.alertError}`}>
          Сессия Kick истекла — чат-бот и webhook могут не работать. Нажмите
          {" "}
          <strong>Переподключить Kick</strong>
          {" "}
          или «Обновить webhook» после повторного OAuth.
        </div>
      ) : null}

      <p className={styles.desc}>
        Подключите свой Kick-канал, чтобы imba.bet видел ваши эфиры, считал трафик с
        {" "}
        <code>sub1=kick</code>
        {" "}
        и готовил ссылки для чата и оверлея.
        {" "}
        <Link className={styles.analyticsLink} href="/profile/dashboard?sub=sub1">
          Смотреть аналитику трафика с Kick →
        </Link>
      </p>

      {status?.connected ? (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Канал</span>
            <span className={styles.statValue}>@{status.channelSlug}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Зрители</span>
            <span className={styles.statValue}>
              {status.isLive ? status.viewerCount ?? "—" : "офлайн"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Подключён</span>
            <span className={styles.statValue}>
              {status.connectedAt
                ? new Date(status.connectedAt).toLocaleDateString("ru-RU")
                : "—"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Бренд-часы (30д)</span>
            <span className={styles.statValue}>{status.compliantHours30d} ч</span>
          </div>
        </div>
      ) : null}

      {status?.connected && status.streamTitle ? (
        <p className={styles.streamTitle}>
          Сейчас в эфире:
          {" "}
          <strong>{status.streamTitle}</strong>
          {status.hasBranding ? " · imba branding ✓" : ""}
        </p>
      ) : null}

      <div className={styles.actions}>
        {!status?.connected ? (
          <button
            type="button"
            className={styles.primary}
            disabled={connectDisabled}
            onClick={connectKick}
          >
            {isPending ? "Подключение…" : "Подключить Kick"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.secondary}
              disabled={isPending}
              onClick={refresh}
            >
              Обновить статус
            </button>
            {tokenNeedsReconnect ? (
              <button
                type="button"
                className={styles.primary}
                disabled={connectDisabled}
                onClick={connectKick}
              >
                Переподключить Kick
              </button>
            ) : null}
            <button
              type="button"
              className={styles.danger}
              disabled={isPending}
              onClick={disconnectKick}
            >
              Отключить
            </button>
          </>
        )}
      </div>

      <div className={styles.linkBlock}>
        <div className={styles.linkLabelRow}>
          <label className={styles.linkLabel}>Короткая ссылка для Kick-чата (рекомендуем)</label>
          {linkStatus === "ok" ? (
            <span className={styles.linkStatusOk}>Ссылка работает</span>
          ) : null}
          {linkStatus === "fail" ? (
            <span className={styles.linkStatusFail}>Проверьте подключение Kick</span>
          ) : null}
        </div>
        <div className={styles.shortLinkGrid}>
          <div className={styles.shortLinkMain}>
            <div className={styles.linkRow}>
              <input className={styles.input} readOnly value={shortLink ?? "Подключите Kick-канал"} />
              <button
                type="button"
                className={styles.secondary}
                disabled={!shortLink}
                onClick={() => void copyShortLink()}
              >
                {shortCopied ? "Скопировано" : "Копировать"}
              </button>
            </div>
            <p className={styles.hint}>
              Короткий URL повышает CTR в чате. Зрители пишут
              {" "}
              <code>!imba</code>
              {" "}
              — бот ответит этой же ссылкой.
            </p>
          </div>
          {shortLink ? <KickShortLinkQr url={shortLink} /> : null}
        </div>
      </div>

      <div className={styles.linkBlock}>
        <label className={styles.linkLabel}>Полная ссылка с sub1/sub2/sub3</label>
        <div className={styles.linkRow}>
          <input className={styles.input} readOnly value={kickLink} />
          <button type="button" className={styles.secondary} onClick={() => void copyLink()}>
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <p className={styles.hint}>
          В заголовке эфира укажите
          {" "}
          <strong>imba.bet</strong>
          {" "}
          или добавьте тег
          {" "}
          <strong>imba_partner</strong>
          , чтобы мы могли засчитывать брендированные часы.
        </p>
      </div>

      <div className={styles.linkBlock}>
        <label className={styles.linkLabel}>OBS-оверлей (Browser Source)</label>
        <div className={styles.linkRow}>
          <input className={styles.input} readOnly value={widgetUrl} />
          <button type="button" className={styles.secondary} onClick={() => void copyWidgetUrl()}>
            {widgetCopied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <p className={styles.hint}>
          В OBS: Источники → Browser → вставьте URL, размер ~920×90, фон прозрачный.
          Промокод и ссылка обновляются автоматически.
        </p>
      </div>

      <div className={styles.linkBlock}>
        <label className={styles.linkLabel}>OBS-алерты REG / FTD</label>
        <div className={styles.linkRow}>
          <input className={styles.input} readOnly value={alertsWidgetUrl} />
          <button type="button" className={styles.secondary} onClick={() => void copyAlertsUrl()}>
            {alertsCopied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <p className={styles.hint}>
          Отдельный Browser Source ~420×200, прозрачный фон. При регистрации или FTD с эфира
          появится анимированный алерт — мотивирует чат и показывает, что ссылка работает.
        </p>
      </div>

      {status?.connected ? (
        <div className={styles.linkBlock}>
          <label className={styles.linkLabel}>Чат-бот в Kick</label>
          <p className={styles.hint}>
            Зрители пишут в чат:
            {" "}
            <code>!imba</code>
            {" "}
            — ссылка на imba.bet;
            {" "}
            <code>!promo</code>
            {" "}
            или
            {" "}
            <code>!промо</code>
            {" "}
            — только промокод;
            {" "}
            <code>!матч</code>
            /
            <code>!match</code>
            {" "}
            — live CS. Ответ не чаще раза в 45 секунд на зрителя.
          </p>
          <p className={styles.hint}>
            При старте эфира бот один раз пишет приветствие со ссылкой и промокодом.
          </p>
          <p className={styles.hint}>
            Если бот молчит —{" "}
            <button
              type="button"
              className={styles.inlineAction}
              disabled={isPending}
              onClick={resubscribeWebhooks}
            >
              обновите webhook
            </button>
            . Обычно это происходит автоматически раз в сутки.
          </p>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <div className={styles.sessionsBlock}>
          <h3 className={styles.sessionsTitle}>Последние эфиры</h3>
          <div className={styles.sessionsTableWrap}>
            <table className={styles.sessionsTable}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Длительность</th>
                  <th>Пик зрителей</th>
                  <th>Брендинг</th>
                  <th>Заголовок</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{new Date(session.startedAt).toLocaleString("ru-RU")}</td>
                    <td>{session.durationMinutes != null ? `${session.durationMinutes} мин` : "в эфире"}</td>
                    <td>{session.peakViewers > 0 ? session.peakViewers : "—"}</td>
                    <td>{session.hadBranding ? "да" : "нет"}</td>
                    <td>{session.lastStreamTitle || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
