"use client";

import Link from "next/link";

import { useLocale } from "~/shared/model/useLocale";

import styles from "../guides.module.css";

export default function WithdrawGuidePage() {
  const { t } = useLocale();

  return (
    <article className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/guides">{t("guides.backGuides")}</Link>
      </nav>
      <h1 className={styles.title}>{t("guides.vyvodTitle")}</h1>
      <p className={styles.lead}>{t("guides.vyvodLead")}</p>

      <section className={styles.section}>
        <h2>{t("guides.vyvodHowTitle")}</h2>
        <ol>
          <li>{t("guides.vyvodHow1")}</li>
          <li>{t("guides.vyvodHow2")}</li>
          <li>{t("guides.vyvodHow3")}</li>
          <li>{t("guides.vyvodHow4")}</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>{t("guides.vyvodBeforeTitle")}</h2>
        <ul>
          <li>{t("guides.vyvodBefore1")}</li>
          <li>{t("guides.vyvodBefore2")}</li>
          <li>{t("guides.vyvodBefore3")}</li>
        </ul>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} href="/profile/financeHistory">
          {t("guides.financeHistory")}
        </Link>
        <Link className={`${styles.link} ${styles.linkSecondary}`} href="/">
          {t("guides.home")}
        </Link>
      </div>
    </article>
  );
}
