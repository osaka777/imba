"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { usePartnerKickAttribution } from "~/entities/kick/lib/usePartnerKickAttribution";

import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";

import styles from "./PartnerKickMobileBanner.module.css";

export function PartnerKickMobileBanner() {
  const { partner } = usePartnerKickAttribution(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(MQ_DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const visible = Boolean(
    mounted && !isDesktop && !dismissed && partner?.isLive && partner.channelSlug,
  );

  if (!visible || !partner) return null;

  const channelLabel = `@${partner.channelSlug}`;

  return createPortal(
    <div className={styles.bar}>
      <div className={styles.meta}>
        <span className={styles.live}>LIVE</span>
        <span className={styles.channel}>{channelLabel}</span>
        <span className={styles.title}>{partner.streamTitle || "Прямой эфир"}</span>
      </div>
      <div className={styles.actions}>
        <a className={styles.cta} href={partner.betUrl}>
          Ставить
        </a>
        <button
          type="button"
          className={styles.close}
          aria-label="Скрыть"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
