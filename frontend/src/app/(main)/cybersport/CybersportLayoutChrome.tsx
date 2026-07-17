"use client";

import { usePathname } from "next/navigation";

import styles from "./CybersportLayout.module.css";
import gameLayoutStyles from "../line/layout.module.css";

export function CybersportLayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGamePage = pathname?.startsWith("/cybersport/game/");

  if (isGamePage) {
    return (
      <div
        className={gameLayoutStyles.gameContainer}
        data-cybersport-game="true"
        data-cybersport-odds="true"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={styles.shell}
      data-cybersport-content="true"
      data-cybersport-odds="true"
      data-cybersport-shell="true"
    >
      <div className={styles.page}>{children}</div>
    </div>
  );
}
