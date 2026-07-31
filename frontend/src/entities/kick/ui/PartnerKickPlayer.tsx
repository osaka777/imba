"use client";

import { buildKickEmbedUrl } from "~/entities/wc-odds/lib/kickEmbedUrl";

import type { KickPartnerWidget } from "~/entities/kick/api/client";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./PartnerKickPlayer.module.css";

type PartnerKickPlayerProps = {
  partner: KickPartnerWidget;
  compact?: boolean;
};

export function PartnerKickPlayer({ partner, compact = false }: PartnerKickPlayerProps) {
  const { t } = useLocale();

  if (!partner.channelSlug) return null;

  const embedUrl = buildKickEmbedUrl(partner.channelSlug);
  const channelLabel = `@${partner.channelSlug}`;

  return (
    <div className={styles.partnerCard}>
      <div className={styles.header}>
        <p className={styles.title}>
          {compact
            ? t("cyber.kickPartnerAir")
            : t("cyber.kickPartnerStream", { channel: channelLabel })}
        </p>
        <span className={styles.liveBadge}>LIVE</span>
      </div>
      <div className={styles.frameWrap}>
        <iframe
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          className={styles.frame}
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title={`Kick ${channelLabel}`}
        />
      </div>
      <div className={styles.footer}>
        <span>{partner.streamTitle || channelLabel}</span>
        <a className={styles.cta} href={partner.betUrl} rel="noreferrer" target="_blank">
          imba.bet
        </a>
      </div>
    </div>
  );
}
