"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import "./btc-updown-global.css";
import styles from "./btc-updown-layout.module.css";

export default function TradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHub =
    pathname === "/trading" ||
    pathname === "/trading/" ||
    pathname === "/casino/btc-updown" ||
    pathname === "/casino/btc-updown/";

  useEffect(() => {
    document.documentElement.dataset.btcPage = isHub ? "hub" : "game";
    return () => {
      delete document.documentElement.dataset.btcPage;
    };
  }, [isHub]);

  return <div className={styles.root}>{children}</div>;
}
