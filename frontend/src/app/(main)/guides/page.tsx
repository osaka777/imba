"use client";

import Link from "next/link";

import { useLocale } from "~/shared/model/useLocale";

import styles from "./guides.module.css";

const GUIDE_CARDS = [
  { href: "/guides/kaspi", titleKey: "guides.cardKaspi" as const },
  { href: "/guides/vyvod", titleKey: "guides.cardWithdraw" as const },
  { href: "/guides/bonusy", titleKey: "guides.cardBonus" as const },
];

export default function GuidesIndexPage() {
  const { t } = useLocale();

  return (
    <article className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/">{t("guides.backHome")}</Link>
      </nav>
      <h1 className={styles.title}>{t("guides.indexTitle")}</h1>
      <p className={styles.lead}>{t("guides.indexLead")}</p>
      <ul>
        {GUIDE_CARDS.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href}>{t(guide.titleKey)}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
