"use client";

import { usePathname } from "next/navigation";

import { Header } from "~/widgets/Header";

import styles from "../line/layout.module.css";

export default function WcLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGamePage = pathname?.startsWith("/wc/game/") === true;

  return (
    <>
      {!isGamePage && <Header className={styles.header} />}
      <div className={styles.container}>{children}</div>
    </>
  );
}
