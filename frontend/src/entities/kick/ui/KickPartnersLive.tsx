"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { KickLivePartner } from "~/entities/kick/api/client";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./KickPartnersLive.module.css";

export function KickPartnersLive() {
  const { t } = useLocale();
  const [partners, setPartners] = useState<KickLivePartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/kick/partners/live", { cache: "no-store" });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as KickLivePartner[];
        if (!cancelled) setPartners(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPartners([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <section className={styles.section} aria-busy="true" aria-label={t("cyber.kickPartnersAria")}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            <span className={styles.livePill}>LIVE</span>
            {t("cyber.kickPartnersTitle")}
          </h2>
        </div>
        <p className={styles.muted}>{t("cyber.kickLoading")}</p>
      </section>
    );
  }

  if (partners.length === 0) return null;

  return (
    <section className={styles.section} aria-label={t("cyber.kickPartnersAria")}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.livePill}>LIVE</span>
          {t("cyber.kickPartnersTitle")}
        </h2>
      </div>

      <div className={styles.track}>
        {partners.map((partner) => (
          <article className={styles.card} key={partner.partnerTag}>
            <div className={styles.cardHead}>
              <span className={styles.channel}>@{partner.channelSlug}</span>
              <span className={styles.viewers}>
                {partner.viewerCount != null
                  ? t("cyber.kickViewers", { n: partner.viewerCount })
                  : "LIVE"}
              </span>
            </div>
            <p className={styles.streamTitle}>
              {partner.streamTitle || t("cyber.kickDefaultTitle")}
            </p>
            {partner.hasBranding ? (
              <span className={styles.branding}>imba branding active</span>
            ) : null}
            <div className={styles.actions}>
              <a className={styles.secondary} href={partner.kickUrl} rel="noreferrer" target="_blank">
                {t("cyber.kickWatch")}
              </a>
              <Link className={styles.primary} href={partner.betUrl}>
                {t("cyber.kickBet")}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
