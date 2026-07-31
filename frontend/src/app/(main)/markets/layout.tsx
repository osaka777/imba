"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import "../trading/btc-updown-global.css";
import tradingStyles from "../trading/btc-updown-layout.module.css";
import styles from "./markets-layout.module.css";

export default function MarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHub = pathname === "/markets" || pathname === "/markets/";
  const isDetail = !isHub && pathname?.startsWith("/markets/");

  useEffect(() => {
    /* Hide sports coupon on hub + detail — markets has its own ticket. */
    document.documentElement.dataset.btcPage = "game";
    return () => {
      delete document.documentElement.dataset.btcPage;
    };
  }, []);

  return (
    <div className={tradingStyles.root}>
      <div
        className={
          isDetail ? styles.detailRoot : isHub ? styles.hubRoot : styles.root
        }
      >
        {children}
      </div>
    </div>
  );
}
