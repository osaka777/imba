"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { displayNameMax6, traderProfileHref } from "~/entities/user/lib/nickname";
import { UserAvatar } from "~/entities/user/ui/UserAvatar/UserAvatar";
import { toIntlLocale } from "~/shared/i18n/format";
import type { AppLocale } from "~/shared/i18n/locale";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import { fetchBtcPublicPnl } from "../api/client";
import { FlipMoney, ScrubMoney } from "./FlipDigits";

import styles from "./TradingPublicPnl.module.css";

type PnlRange = "1d" | "1w" | "1m" | "all";
type PnlPoint = { t: number; v: number };

function samplePnl(points: PnlPoint[], fi: number): PnlPoint {
  const i0 = Math.max(0, Math.min(points.length - 1, Math.floor(fi)));
  const i1 = Math.min(points.length - 1, i0 + 1);
  const f = Math.max(0, Math.min(1, fi - i0));
  const a = points[i0]!;
  const b = points[i1]!;
  return {
    t: a.t + (b.t - a.t) * f,
    v: a.v + (b.v - a.v) * f,
  };
}

function formatPnlStamp(t: number, locale: AppLocale) {
  return new Date(t).toLocaleString(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HubPnlChart({
  points,
  height,
  scrubIndex,
  onScrub,
}: {
  points: PnlPoint[];
  height: number;
  scrubIndex: number | null;
  onScrub: (index: number | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const w = 280;
  const h = height;
  const pad = 4;

  const vals = points.length ? points.map((p) => p.v) : [0];
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 0);
  const span = Math.max(1e-9, max - min);
  const coords =
    points.length < 2
      ? ([
          [pad, h / 2],
          [w - pad, h / 2],
        ] as const)
      : points.map((p, i) => {
          const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
          const y = pad + (1 - (p.v - min) / span) * (h - pad * 2);
          return [x, y] as const;
        });

  const d = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1]!;
  const fill = `${d} L${last[0].toFixed(1)} ${h} L${coords[0]![0].toFixed(1)} ${h} Z`;
  const endPositive = (points[points.length - 1]?.v ?? 0) >= 0;

  const scrub = (() => {
    if (scrubIndex == null || coords.length === 0) return null;
    const i0 = Math.max(0, Math.min(coords.length - 1, Math.floor(scrubIndex)));
    const i1 = Math.min(coords.length - 1, i0 + 1);
    const f = Math.max(0, Math.min(1, scrubIndex - i0));
    const a = coords[i0]!;
    const b = coords[i1]!;
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    return {
      x,
      left: (x / w) * 100,
      top: (y / h) * 100,
    };
  })();

  function indexFromClientX(clientX: number) {
    const el = wrapRef.current;
    if (!el || points.length < 2) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
    );
    return x * (points.length - 1);
  }

  const fillGrad = `hubPnlFill-${uid}`;
  const clipId = `hubPnlClip-${uid}`;
  const stroke = endPositive ? "#3b82f6" : "#ef473a";
  const fillColor = endPositive ? "#0acf97" : "#ef473a";

  return (
    <div
      ref={wrapRef}
      className={`${styles.chartWrap} ${scrub ? styles.chartScrubbing : ""}`}
      style={{ height: h }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onScrub(indexFromClientX(e.clientX));
      }}
      onPointerMove={(e) => {
        if (
          e.pointerType === "mouse" ||
          e.currentTarget.hasPointerCapture(e.pointerId)
        ) {
          onScrub(indexFromClientX(e.clientX));
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") onScrub(null);
      }}
      onPointerLeave={() => onScrub(null)}
      onPointerCancel={() => onScrub(null)}
    >
      <svg
        className={styles.chart}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ height: h }}
        aria-hidden
      >
        <defs>
          <linearGradient id={fillGrad} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
          </linearGradient>
          {scrub ? (
            <clipPath id={clipId}>
              <rect x="0" y="0" width={scrub.x} height={h} />
            </clipPath>
          ) : null}
        </defs>
        <g opacity={scrub ? 0.22 : 1}>
          <path d={fill} fill={`url(#${fillGrad})`} />
          <path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        {scrub ? (
          <g clipPath={`url(#${clipId})`}>
            <path d={fill} fill={`url(#${fillGrad})`} />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>
      {scrub ? (
        <>
          <i
            className={styles.scrubLine}
            style={{ left: `${scrub.left}%` }}
            aria-hidden
          />
          <i
            className={styles.scrubDot}
            style={{
              left: `${scrub.left}%`,
              top: `${scrub.top}%`,
              background: stroke,
            }}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
}

type Props = {
  /** Narrow coupon / mobile stack under Markets rail. */
  compact?: boolean;
};

export function TradingPublicPnl({ compact = false }: Props) {
  const { t, locale } = useLocale();
  const { currency } = useCurrency();
  const cur = (currency || "KZT").toUpperCase();
  const [range, setRange] = useState<PnlRange>("1d");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const limit = compact ? 10 : 10;
  const chartH = compact ? 48 : 72;

  const ranges = useMemo(
    () =>
      (
        [
          ["1d", "trading.pnlRange1d", "trading.pnlSub1d"],
          ["1w", "trading.pnlRange1w", "trading.pnlSub1w"],
          ["1m", "trading.pnlRange1m", "trading.pnlSub1m"],
          ["all", "trading.pnlRangeAll", "trading.pnlSubAll"],
        ] as const
      ).map(([id, labelKey, subKey]) => ({
        id: id as PnlRange,
        label: t(labelKey),
        sub: t(subKey),
      })),
    [t],
  );

  const query = useQuery({
    queryKey: ["btc-public-pnl", range, cur, limit],
    queryFn: () => fetchBtcPublicPnl(range, cur, limit),
    refetchInterval: 15_000,
    staleTime: 8_000,
  });

  const data = query.data;
  const summary = data?.summary;
  const players = data?.players ?? [];
  const points = data?.series ?? [];
  const volume = summary?.stakeTotal ?? 0;
  const scrubbed =
    scrubIndex != null && points.length > 1
      ? samplePnl(points, scrubIndex)
      : null;
  /** Follow chart while scrubbing; idle keeps turnover (volume). */
  const display = scrubbed?.v ?? volume;
  const scrubbing = scrubbed != null;
  const positive = scrubbing ? display >= 0 : true;
  const meta = ranges.find((r) => r.id === range) ?? ranges[0]!;
  const sub = scrubbing ? formatPnlStamp(scrubbed.t, locale) : meta.sub;
  const isUsd = cur === "USD" || cur === "USDT";

  return (
    <section
      className={`${styles.card} ${compact ? styles.cardCompact : ""}`}
      aria-label={t("trading.publicPnlVolume")}
    >
      <div className={styles.head}>
        <span className={styles.title}>{t("trading.publicPnlVolume")}</span>
        <div
          className={styles.ranges}
          role="group"
          aria-label={t("trading.pnlRangeAria")}
        >
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              className={range === r.id ? styles.rangeOn : styles.rangeBtn}
              onClick={() => {
                setRange(r.id);
                setScrubIndex(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.valueRow}>
        <div className={styles.valueBlock}>
          <strong
            className={`${styles.value}${scrubbing ? ` ${styles.valueScrubbing}` : ""}`}
          >
            {scrubbing ? (
              <>
                <span
                  className={positive ? styles.valueSignUp : styles.valueSignDown}
                  aria-hidden
                >
                  {positive ? "+" : "−"}
                </span>
                <ScrubMoney
                  value={Math.abs(display)}
                  currency={cur}
                  fractionDigits={isUsd ? 2 : 0}
                  active
                />
              </>
            ) : (
              <FlipMoney
                value={volume}
                currency={cur}
                fractionDigits={isUsd ? 2 : 0}
              />
            )}
          </strong>
          <span className={styles.sub}>{sub}</span>
        </div>
        {summary && !compact ? (
          <div className={styles.meta}>
            <span>{t("trading.publicPnlPlayers", { n: summary.players })}</span>
            <span>{t("trading.publicPnlBets", { n: summary.bets })}</span>
            {summary.winRate != null ? (
              <span>
                {t("trading.publicPnlWinRate", { n: summary.winRate })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <HubPnlChart
        points={points}
        height={chartH}
        scrubIndex={scrubIndex}
        onScrub={setScrubIndex}
      />

      <div className={`${styles.listHead} ${compact ? styles.listHeadCompact : ""}`}>
        <span>{t("trading.publicPnlPlayer")}</span>
        {!compact ? <span>{t("trading.publicPnlVolume")}</span> : null}
        <span>{t("trading.pnlTitle")}</span>
      </div>

      {query.isLoading ? (
        <div className={styles.empty}>{t("trading.publicPnlLoading")}</div>
      ) : players.length === 0 ? (
        <div className={styles.empty}>{t("trading.publicPnlEmpty")}</div>
      ) : (
        <ul className={styles.list}>
          {players.map((p, i) => {
            const up = p.pnl >= 0;
            const href = traderProfileHref({
              userId: p.userId,
              nickname: p.nickname,
              name: p.name,
            });
            return (
              <li key={`${p.userId}-${i}`}>
                <Link
                  href={href}
                  className={`${styles.row} ${compact ? styles.rowCompact : ""}`}
                >
                  <div className={styles.player}>
                    <span className={styles.rank}>{i + 1}</span>
                    <UserAvatar
                      name={displayNameMax6(p.name)}
                      preset={p.avatarPreset}
                      src={p.avatarUrl}
                      userId={p.userId}
                      size={compact ? 28 : 32}
                    />
                    <div className={styles.playerText}>
                      <strong>{displayNameMax6(p.name)}</strong>
                      {!compact ? (
                        <span>
                          {p.winRate != null
                            ? t("trading.publicPnlPlayerMeta", {
                                bets: p.bets,
                                wr: p.winRate,
                              })
                            : t("trading.publicPnlPlayerBetsOnly", {
                                bets: p.bets,
                              })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!compact ? (
                    <span className={styles.vol}>
                      <FlipMoney
                        value={p.stakeTotal}
                        currency={cur}
                        fractionDigits={isUsd ? 2 : 0}
                      />
                    </span>
                  ) : null}
                  <span className={up ? styles.pnlUp : styles.pnlDown}>
                    <span className={styles.sign} aria-hidden>
                      {up ? "+" : "−"}
                    </span>
                    <FlipMoney
                      value={Math.abs(p.pnl)}
                      currency={cur}
                      fractionDigits={isUsd ? 2 : 0}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
