"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLocale } from "~/shared/model/useLocale";
import styles from "./landing.module.css";

export function PartnerLandingShell({
  ctaUrl,
  children,
}: {
  ctaUrl: string;
  children: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          IMBA<span className={styles.logoAccent}>.BET</span>
        </Link>
        <a href={ctaUrl} className={styles.headerCta}>
          {t("partner.register")}
        </a>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        {t("partner.responsible")}{" "}
        <a href={ctaUrl}>{t("partner.registerImba")}</a>
      </footer>
    </div>
  );
}
