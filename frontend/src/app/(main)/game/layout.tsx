"use client";

import styles from "../line/layout.module.css";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.gameContainer}>{children}</div>;
}
