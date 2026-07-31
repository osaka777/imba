"use client";

import Link from "next/link";

import { useLocale } from "~/shared/model/useLocale";

import styles from "../guides.module.css";

export default function KaspiGuidePage() {
  const { t } = useLocale();

  return (
    <article className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/guides">{t("guides.backGuides")}</Link>
      </nav>
      <h1 className={styles.title}>{t("guides.kaspiTitle")}</h1>
      <p className={styles.lead}>{t("guides.kaspiLead")}</p>

      <section className={styles.section}>
        <h2>{t("guides.kaspiHowTitle")}</h2>
        <ol>
          <li>{t("guides.kaspiHow1")}</li>
          <li>{t("guides.kaspiHow2")}</li>
          <li>{t("guides.kaspiHow3")}</li>
          <li>{t("guides.kaspiHow4")}</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>{t("guides.kaspiFailTitle")}</h2>
        <ul>
          <li>{t("guides.kaspiFail1")}</li>
          <li>{t("guides.kaspiFail2")}</li>
          <li>{t("guides.kaspiFail3")}</li>
        </ul>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} href="/profile">
          {t("guides.goProfile")}
        </Link>
        <Link className={`${styles.link} ${styles.linkSecondary}`} href="/">
          {t("guides.home")}
        </Link>
      </div>
    </article>
  );
}
