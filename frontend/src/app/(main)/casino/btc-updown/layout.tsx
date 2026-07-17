"use client";

import { useEffect } from "react";

import "./btc-updown-global.css";
import styles from "./btc-updown-layout.module.css";

export default function BtcUpdownLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.btcPage = "1";
    return () => {
      delete document.documentElement.dataset.btcPage;
    };
  }, []);

  return <div className={styles.root}>{children}</div>;
}
