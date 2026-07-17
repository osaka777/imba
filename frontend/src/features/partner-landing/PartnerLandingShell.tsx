import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

export function PartnerLandingShell({
  ctaUrl,
  children,
}: {
  ctaUrl: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          IMBA<span className={styles.logoAccent}>.BET</span>
        </Link>
        <a href={ctaUrl} className={styles.headerCta}>
          Регистрация
        </a>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        18+ · Играйте ответственно ·{" "}
        <a href={ctaUrl}>Зарегистрироваться на imba.bet</a>
      </footer>
    </div>
  );
}
