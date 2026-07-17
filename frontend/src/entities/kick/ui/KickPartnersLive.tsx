"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { KickLivePartner } from "~/entities/kick/api/client";

import styles from "./KickPartnersLive.module.css";

export function KickPartnersLive() {
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
      <section className={styles.section} aria-busy="true" aria-label="Партнёры в эфире">
        <div className={styles.head}>
          <h2 className={styles.title}>
            <span className={styles.livePill}>LIVE</span>
            Партнёры imba в эфире
          </h2>
        </div>
        <p className={styles.muted}>Загружаем партнёрские трансляции...</p>
      </section>
    );
  }

  if (partners.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Партнёры в эфире">
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.livePill}>LIVE</span>
          Партнёры imba в эфире
        </h2>
      </div>

      <div className={styles.track}>
        {partners.map((partner) => (
          <article className={styles.card} key={partner.partnerTag}>
            <div className={styles.cardHead}>
              <span className={styles.channel}>@{partner.channelSlug}</span>
              <span className={styles.viewers}>
                {partner.viewerCount != null ? `${partner.viewerCount} зрит.` : "LIVE"}
              </span>
            </div>
            <p className={styles.streamTitle}>{partner.streamTitle || "Прямой эфир на Kick"}</p>
            {partner.hasBranding ? (
              <span className={styles.branding}>imba branding active</span>
            ) : null}
            <div className={styles.actions}>
              <a className={styles.secondary} href={partner.kickUrl} rel="noreferrer" target="_blank">
                Смотреть Kick
              </a>
              <Link className={styles.primary} href={partner.betUrl}>
                Ставить на imba
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
