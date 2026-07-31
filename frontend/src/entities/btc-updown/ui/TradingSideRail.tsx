"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { useLocale } from "~/shared/model/useLocale";

import { fetchBtcState } from "../api/client";
import {
  roundsForSymbol,
  TRADING_MARKETS,
  type TradingMarket,
} from "../lib/markets";

import styles from "./TradingSideRail.module.css";

function roundTabLabel(ms: number, t: (key: string) => string): string {
  if (ms <= 60_000) return t("trading.round1min");
  if (ms <= 300_000) return t("trading.round5min");
  return t("trading.round15min");
}

function leadFromChange(changePct: number | null | undefined): {
  side: "UP" | "DOWN";
  pct: number;
} {
  if (changePct == null || !Number.isFinite(changePct)) {
    return { side: "UP", pct: 50 };
  }
  const side = changePct >= 0 ? "UP" : "DOWN";
  const mag = Math.min(49, Math.abs(changePct) * 18);
  return { side, pct: Math.round(50 + mag) };
}

const SIDE_TABS = [300_000, 900_000, 60_000] as const;

function SideMarketRow({
  market,
  roundMs,
}: {
  market: TradingMarket;
  roundMs: number;
}) {
  const { t } = useLocale();
  const stateQuery = useQuery({
    queryKey: ["btc-updown-hub-side", market.symbol, roundMs],
    queryFn: () => fetchBtcState(market.symbol, roundMs),
    refetchInterval: 2_000,
    staleTime: 1_000,
  });

  const lead = leadFromChange(stateQuery.data?.changePct);
  const price = stateQuery.data?.price ?? null;
  const roundLabel = roundTabLabel(roundMs, t);
  const odds = Number(stateQuery.data?.config?.odds ?? 1.8).toFixed(2);

  return (
    <Link
      href={`/trading/${market.slug}?round=${roundMs}`}
      className={styles.row}
      style={
        {
          "--card-rgb": market.theme.accentRgb,
        } as CSSProperties
      }
    >
      <Image
        src={market.theme.logo}
        alt=""
        width={36}
        height={36}
        className={styles.logo}
      />
      <div className={styles.body}>
        <p className={styles.title}>
          {t("trading.sideShortTitle", {
            short: market.short,
            round: roundLabel,
          })}
        </p>
        <p className={styles.price}>
          {price != null && Number.isFinite(price)
            ? `$${price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: price < 1 ? 6 : 2,
              })}`
            : "—"}
        </p>
      </div>
      <div className={styles.meta}>
        <span className={styles.pctRow}>
          <i className={styles.live} aria-hidden />
          <span className={styles.pct}>{lead.pct}%</span>
        </span>
        <span className={styles.dir}>
          {lead.side === "UP"
            ? t("trading.seriesResultUp")
            : t("trading.seriesResultDown")}{" "}
          · {odds}
        </span>
      </div>
    </Link>
  );
}

type Props = {
  className?: string;
  /** Fill Main coupon column height on desktop. */
  variant?: "coupon" | "stack";
};

export function TradingSideRail({ className, variant = "coupon" }: Props) {
  const { t } = useLocale();
  const [tabMs, setTabMs] = useState<number>(300_000);

  const markets = useMemo(
    () =>
      TRADING_MARKETS.filter((m) =>
        roundsForSymbol(m.symbol).includes(tabMs),
      ),
    [tabMs],
  );

  return (
    <aside
      className={`${styles.rail} ${
        variant === "stack" ? styles.railStack : styles.railCoupon
      }${className ? ` ${className}` : ""}`}
      aria-label={t("trading.sideAria")}
    >
      <div className={styles.head}>
        <i className={styles.headLive} aria-hidden />
        <strong>{t("trading.sideRailTitle")}</strong>
      </div>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={t("trading.timeframeAria")}
      >
        {SIDE_TABS.map((ms) => (
          <button
            key={ms}
            type="button"
            role="tab"
            aria-selected={tabMs === ms}
            className={`${styles.tab} ${tabMs === ms ? styles.tabOn : ""}`}
            onClick={() => setTabMs(ms)}
          >
            {roundTabLabel(ms, t)}
          </button>
        ))}
      </div>
      <div className={styles.list} role="list">
        {markets.length ? (
          markets.map((market) => (
            <SideMarketRow key={market.slug} market={market} roundMs={tabMs} />
          ))
        ) : (
          <div className={styles.empty}>{t("trading.sideEmpty")}</div>
        )}
      </div>
    </aside>
  );
}
