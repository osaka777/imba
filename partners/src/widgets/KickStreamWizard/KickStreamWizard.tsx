"use client";

import { useMemo, useState } from "react";

import type { KickSession, KickStatus } from "@/entities/kick/api";
import { buildKickReferralLink, buildKickShortUrl } from "@/shared/lib/buildKickReferralLink";
import { KickShortLinkQr } from "@/widgets/KickShortLinkQr/KickShortLinkQr";
import type { KickAnalytics } from "@/widgets/KickStreamAnalytics/KickStreamAnalytics";

import styles from "./KickStreamWizard.module.css";

type Props = {
  status: KickStatus | null;
  sessions: KickSession[];
  analytics: KickAnalytics | null;
  referralLink?: string;
  showWelcome?: boolean;
  onConnect?: () => void;
};

const STEPS = [
  { id: "connect", title: "Подключить Kick" },
  { id: "link", title: "Ссылка для чата" },
  { id: "obs", title: "OBS-оверлей" },
] as const;

export function KickStreamWizard({
  status,
  sessions,
  analytics,
  referralLink,
  showWelcome = false,
  onConnect,
}: Props) {
  const [copied, setCopied] = useState(false);
  const connected = Boolean(status?.connected);
  const hasStream = sessions.length > 0;

  const kickLink = useMemo(() => {
    if (!referralLink) return "";
    return buildKickReferralLink(
      referralLink,
      status?.channelSlug,
      status?.isLive ? status.activeSessionId : null,
    );
  }, [referralLink, status?.channelSlug, status?.isLive, status?.activeSessionId]);

  const shortLink = useMemo(
    () => buildKickShortUrl(status?.channelSlug),
    [status?.channelSlug],
  );

  const copyLink = async () => {
    const value = shortLink ?? kickLink;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const activeStep = useMemo(() => {
    if (!connected) return 0;
    if (!hasStream) return 1;
    return 2;
  }, [connected, hasStream]);

  const roiLine = useMemo(() => {
    if (!analytics) return null;
    const peak = analytics.sessions30d.totalPeakViewers;
    const liveRegs = analytics.duringLive.registrations;
    if (peak <= 0 && liveRegs <= 0) return null;
    const parts: string[] = [];
    if (liveRegs > 0) parts.push(`${liveRegs} рег. во время эфиров`);
    if (peak > 0) parts.push(`пик зрителей ${peak}`);
    return parts.join(" · ");
  }, [analytics]);

  if (connected && hasStream && !showWelcome) return null;

  return (
    <section className={styles.card}>
      {showWelcome ? (
        <p className={styles.welcome}>
          Добро пожаловать! Пройди 3 шага — и можно стримить с imba.
        </p>
      ) : null}

      <div className={styles.steps}>
        {STEPS.map((step, index) => {
          const done = index < activeStep;
          const current = index === activeStep;
          return (
            <div
              className={`${styles.step} ${done ? styles.stepDone : ""} ${current ? styles.stepCurrent : ""}`}
              key={step.id}
            >
              <span className={styles.stepNum}>{index + 1}</span>
              <span className={styles.stepTitle}>{step.title}</span>
            </div>
          );
        })}
      </div>

      {!connected ? (
        <div className={styles.action}>
          <p className={styles.hint}>Нажми «Подключить Kick» в блоке ниже — OAuth займёт ~1 минуту.</p>
          {onConnect ? (
            <button className={styles.btn} type="button" onClick={onConnect}>
              Подключить Kick
            </button>
          ) : null}
        </div>
      ) : null}

      {connected && !hasStream ? (
        <div>
          <p className={styles.hint}>
            Скопируй короткую ссылку
            {shortLink ? ` (${shortLink})` : ""}
            {" "}
            в описание канала или закрепи в чате.
          </p>
          {shortLink || kickLink ? (
            <div className={styles.linkBlock}>
              <div className={styles.linkRow}>
                <input className={styles.input} readOnly value={shortLink ?? kickLink} />
                <button className={styles.copyBtn} type="button" onClick={() => void copyLink()}>
                  {copied ? "Скопировано" : "Копировать"}
                </button>
              </div>
              {shortLink ? <KickShortLinkQr url={shortLink} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {connected && hasStream ? (
        <p className={styles.hint}>
          Добавь OBS Browser Source с URL оверлея из блока «Стрим».
        </p>
      ) : null}

      {roiLine ? <p className={styles.roi}>{roiLine}</p> : null}
    </section>
  );
}
