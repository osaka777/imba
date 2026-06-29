"use client";

import { usePathname } from "next/navigation";

import { Header } from "~/widgets/Header";

import styles from "./CybersportLayout.module.css";
import gameLayoutStyles from "../line/layout.module.css";

export function CybersportLayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGamePage = pathname?.startsWith("/cybersport/game/");

  if (isGamePage) {
    return <div className={gameLayoutStyles.gameContainer}>{children}</div>;
  }

  return (
    <>
      <Header className={styles.header} />
      <div className={styles.shell} data-cybersport-content="true">
        <div className={styles.page}>{children}</div>
      </div>
    </>
  );
}
