"use client";

import { Suspense } from "react";
import Link from "next/link";

import "~/shared/ui/styles/index.css";
import styles from "~/app/NotFound.module.css";
import { useLocale } from "~/shared/model/useLocale";

export const dynamic = "force-dynamic";

function NotFoundArt() {
  return (
    <div aria-hidden className={styles.art}>
      <svg fill="none" viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="140" cy="158" fill="rgb(8 85 196 / 0.22)" rx="78" ry="10" />
        <path
          d="M48 118c22-34 58-54 92-54s70 20 92 54"
          stroke="rgb(16 141 231 / 0.35)"
          strokeDasharray="4 6"
          strokeWidth="2"
        />
        <circle
          cx="140"
          cy="86"
          fill="rgb(30 40 63)"
          r="46"
          stroke="rgb(16 141 231 / 0.55)"
          strokeWidth="3"
        />
        <path
          d="M140 40v92M94 86h92"
          stroke="rgb(135 162 218 / 0.35)"
          strokeWidth="2"
        />
        <path
          d="M108 52c18 10 46 10 64 0M108 120c18-10 46-10 64 0"
          stroke="rgb(135 162 218 / 0.4)"
          strokeWidth="2"
        />
        <circle
          cx="140"
          cy="86"
          fill="none"
          r="14"
          stroke="rgb(177 209 255 / 0.55)"
          strokeWidth="2"
        />
        <g transform="translate(178 42)">
          <circle
            cx="28"
            cy="28"
            fill="rgb(16 141 231 / 0.18)"
            r="26"
            stroke="rgb(16 141 231 / 0.7)"
            strokeWidth="4"
          />
          <circle cx="28" cy="28" fill="none" r="12" stroke="#fff" strokeWidth="3" />
          <path
            d="M46 46l18 18"
            stroke="#fff"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </g>
        <g fill="rgb(177 209 255 / 0.85)">
          <circle cx="62" cy="54" r="3" />
          <circle cx="214" cy="70" r="2.5" />
          <circle cx="78" cy="96" r="2" />
        </g>
      </svg>
    </div>
  );
}

function NotFoundBody() {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <div aria-hidden className={styles.glow} />
      <NotFoundArt />
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>{t("common.notFoundTitle")}</h1>
      <p className={styles.desc}>{t("common.notFoundText")}</p>
      <Link className={styles.cta} href="/">
        {t("common.notFoundHome")}
      </Link>
      <nav aria-label={t("common.quickLinks")} className={styles.links}>
        <Link className={styles.link} href="/live">
          {t("common.liveNav")}
        </Link>
        <Link className={styles.link} href="/line">
          {t("common.prematchNav")}
        </Link>
        <Link className={styles.link} href="/cybersport">
          {t("common.cybersport")}
        </Link>
      </nav>
    </div>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<div />}>
      <NotFoundBody />
    </Suspense>
  );
}
