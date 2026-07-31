"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { FlipDigits } from "~/entities/btc-updown/ui/FlipDigits";
import { useLocale } from "~/shared/model/useLocale";

import { fetchRaceState } from "../api/client";
import { RACE_PAIRS, type RacePairMeta } from "../lib/pairs";

import styles from "./RaceHub.module.css";

function formatTimerParts(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return {
    mm: m.toString().padStart(2, "0"),
    ss: r.toString().padStart(2, "0"),
  };
}

function formatTimerAria(ms: number) {
  const { mm, ss } = formatTimerParts(ms);
  return `${mm}:${ss}`;
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function RaceCard({ pair, index }: { pair: RacePairMeta; index: number }) {
  const { t } = useLocale();
  const stateQuery = useQuery({
    queryKey: ["race-hub", pair.key],
    queryFn: () => fetchRaceState(pair.key, 300_000),
    refetchInterval: 1_500,
    staleTime: 800,
  });
  const state = stateQuery.data;
  const pctA = state?.changePctA ?? 0;
  const pctB = state?.changePctB ?? 0;
  const hasLive = state?.changePctA != null && state?.changePctB != null;
  const total = Math.max(1e-6, Math.abs(pctA) + Math.abs(pctB));
  const barA = 50 + ((pctA - pctB) / total) * 40;
  const clampedBar = Math.min(92, Math.max(8, barA));
  const msToEnd = state?.msToEnd ?? 0;
  const open = state?.bettingOpen ?? true;
  const timer = formatTimerParts(msToEnd);
  const lead =
    !hasLive || Math.abs(pctA - pctB) < 1e-6
      ? null
      : pctA > pctB
        ? "A"
        : "B";
  const leadLabel =
    lead === "A"
      ? t("trading.raceLeads", { side: pair.shortA })
      : lead === "B"
        ? t("trading.raceLeads", { side: pair.shortB })
        : t("trading.raceDraw");

  return (
    <Link
      href={`/trading/race/${pair.slug}`}
      className={`${styles.card}${lead === "A" ? ` ${styles.leadA}` : ""}${lead === "B" ? ` ${styles.leadB}` : ""}`}
      style={
        {
          "--a": pair.colorA,
          "--b": pair.colorB,
          "--a-rgb": pair.colorRgbA,
          "--b-rgb": pair.colorRgbB,
          "--i": index,
        } as CSSProperties
      }
    >
      <div className={styles.cardTop}>
        <div className={styles.pairId}>
          <span className={styles.logos}>
            <span className={styles.logoA}>
              <Image
                src={pair.logoA}
                alt=""
                width={40}
                height={40}
                className={styles.logoImg}
              />
            </span>
            <span className={styles.logoB}>
              <Image
                src={pair.logoB}
                alt=""
                width={40}
                height={40}
                className={styles.logoImg}
              />
            </span>
          </span>
          <div className={styles.pairText}>
            <h2 className={styles.name}>
              <span style={{ color: pair.colorA }}>{pair.shortA}</span>
              <span className={styles.vs}>vs</span>
              <span style={{ color: pair.colorB }}>{pair.shortB}</span>
            </h2>
            <p className={styles.tagline}>{pair.tagline}</p>
          </div>
        </div>

        <div className={styles.meta}>
          <span className={open ? styles.live : styles.lock}>
            {open ? "Live" : "Lock"}
          </span>
          <span
            className={styles.timer}
            aria-label={msToEnd > 0 ? formatTimerAria(msToEnd) : undefined}
          >
            {msToEnd > 0 ? (
              <>
                <FlipDigits value={timer.mm} preferDir="down" />
                <span className={styles.timerSep}>:</span>
                <FlipDigits value={timer.ss} preferDir="down" />
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      <div className={styles.scoreboard}>
        <div className={`${styles.side} ${styles.sideA}${lead === "A" ? ` ${styles.sideLead}` : ""}`}>
          <span className={styles.sideSym}>{pair.shortA}</span>
          <span
            className={`${styles.pct}${pctA > 0 ? ` ${styles.pctUp}` : ""}${pctA < 0 ? ` ${styles.pctDown}` : ""}`}
          >
            {formatPct(state?.changePctA)}
          </span>
        </div>

        <div className={styles.mid}>
          <div className={styles.bar} aria-hidden>
            <div className={styles.barA} style={{ width: `${clampedBar}%` }} />
            <div
              className={styles.barB}
              style={{ width: `${100 - clampedBar}%` }}
            />
            <span
              className={styles.barNeedle}
              style={{ left: `${clampedBar}%` }}
            />
          </div>
          <span className={styles.leadLabel}>{leadLabel}</span>
        </div>

        <div className={`${styles.side} ${styles.sideB}${lead === "B" ? ` ${styles.sideLead}` : ""}`}>
          <span className={styles.sideSym}>{pair.shortB}</span>
          <span
            className={`${styles.pct}${pctB > 0 ? ` ${styles.pctUp}` : ""}${pctB < 0 ? ` ${styles.pctDown}` : ""}`}
          >
            {formatPct(state?.changePctB)}
          </span>
        </div>
      </div>

      <div className={styles.cardFoot}>
        <span className={styles.roundHint}>
          {t("trading.raceRoundHint", { odds: state?.odds?.toFixed(2) ?? "1.80" })}
        </span>
        <span className={styles.cta}>
          {t("trading.racePlay")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export function RaceHub() {
  const { t } = useLocale();

  return (
    <div className={styles.hub}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <Link href="/trading" className={styles.back}>
            {t("trading.raceBackTrading")}
          </Link>
          <div>
            <p className={styles.eyebrow}>Imba Games</p>
            <h1 className={styles.title}>{t("trading.raceHubTitle")}</h1>
          </div>
        </div>
        <p className={styles.rule}>{t("trading.raceHubLead")}</p>
      </header>

      <div className={styles.grid}>
        {RACE_PAIRS.map((pair, index) => (
          <RaceCard key={pair.key} pair={pair} index={index} />
        ))}
      </div>
    </div>
  );
}
