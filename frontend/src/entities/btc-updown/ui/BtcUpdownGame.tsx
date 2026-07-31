"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { useAuth } from "~/app/providers/AuthProvider";
import { ArrowUpIcon, QuestionIcon } from "~/shared/assets";
import { toIntlLocale } from "~/shared/i18n/format";
import type { AppLocale } from "~/shared/i18n/locale";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import {
  fetchBtcBetHistory,
  fetchBtcDailyStats,
  fetchBtcQuote,
  fetchBtcState,
  placeBtcBet,
  type BtcBetHistoryDto,
  type BtcQuoteDto,
  type BtcStateDto,
} from "../api/client";
import { playBetClickSound, playBetLoseSound, playBetWinSound, unlockBetClickSound } from "../lib/bet-sfx";
import { themeForSymbol } from "../lib/assetTheme";
import { formatAssetPrice, roundsForSymbol, TRADING_MARKETS } from "../lib/markets";
import { AnimatedPct } from "./AnimatedPct";
import { AnimatedPrice } from "./AnimatedPrice";
import { BtcChart, type ChartPosition } from "./BtcChart";
import { BtcProChart } from "./BtcProChart";
import {
  FlipDigits,
  ScrubMoney,
  formatMoneyAmount,
  holdStakeStepForCurrency,
  maxStakeForCurrency,
  presetsForCurrency,
  stakeStepForCurrency,
} from "./FlipDigits";
import styles from "./BtcUpdownGame.module.css";

type PnlRange = "1d" | "1w" | "1m" | "1y" | "ytd" | "all";

function pnlRangeSince(range: PnlRange, now: number): number | null {
  if (range === "all") return null;
  if (range === "ytd") return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  const ms =
    range === "1d"
      ? 86_400_000
      : range === "1w"
        ? 7 * 86_400_000
        : range === "1m"
          ? 30 * 86_400_000
          : 365 * 86_400_000;
  return now - ms;
}

type PnlPoint = { t: number; v: number };

function buildPnlSeries(
  bets: BtcBetHistoryDto[],
  sinceMs: number | null,
  now: number,
): { points: PnlPoint[]; total: number } {
  const settled = bets
    .filter((b) => b.status === "WIN" || b.status === "LOSE")
    .filter((b) => {
      if (sinceMs == null) return true;
      const t = Date.parse(b.settledAt ?? b.createdAt);
      return Number.isFinite(t) && t >= sinceMs;
    })
    .sort(
      (a, b) =>
        Date.parse(a.settledAt ?? a.createdAt) -
        Date.parse(b.settledAt ?? b.createdAt),
    );

  const firstT = settled.length
    ? Date.parse(settled[0]!.settledAt ?? settled[0]!.createdAt)
    : now;
  const startT = sinceMs != null ? Math.min(sinceMs, firstT) : firstT;

  let total = 0;
  const points: PnlPoint[] = [{ t: startT, v: 0 }];
  for (const b of settled) {
    total +=
      b.status === "WIN" ? b.potentialPayout - b.stake : -b.stake;
    points.push({
      t: Date.parse(b.settledAt ?? b.createdAt),
      v: total,
    });
  }
  if (points.length === 1) points.push({ t: now, v: 0 });
  return { points, total };
}

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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapTradingError(
  err: unknown,
  t: ReturnType<typeof useLocale>["t"],
  fallbackKey: "trading.orderRejected" | "trading.quoteError" = "trading.orderRejected",
) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg === "TRADING_AUTH_REQUIRED") return t("trading.errLoginBet");
  if (msg === "TRADING_MARKET_LOAD_FAILED") return t("trading.errLoadMarket");
  if (msg === "TRADING_QUOTE_FAILED") return t("trading.errQuote");
  return msg || t(fallbackKey);
}

function PnlSparkline({
  points,
  scrubIndex,
  onScrub,
}: {
  points: PnlPoint[];
  scrubIndex: number | null;
  onScrub: (index: number | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const w = 280;
  const h = 56;
  const pad = 2;
  const vals = points.length ? points.map((p) => p.v) : [0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1e-9, max - min);
  const coords =
    points.length < 2
      ? [
          [pad, h / 2] as const,
          [w - pad, h / 2] as const,
        ]
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

  const lineGrad = `pnlLineGrad-${uid}`;
  const fillGrad = `pnlFillGrad-${uid}`;
  const clipId = `pnlClip-${uid}`;

  return (
    <div
      ref={wrapRef}
      className={`${styles.pnlChartWrap} ${scrub ? styles.pnlChartScrubbing : ""}`}
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
        className={styles.pnlChart}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={lineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="55%" stopColor="#4f7fd6" />
            <stop offset="100%" stopColor="#6b5fd4" />
          </linearGradient>
          <linearGradient id={fillGrad} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(79, 127, 214, 0.28)" />
            <stop offset="100%" stopColor="rgba(30, 40, 63, 0.05)" />
          </linearGradient>
          {scrub ? (
            <clipPath id={clipId}>
              <rect x="0" y="0" width={scrub.x} height={h} />
            </clipPath>
          ) : null}
        </defs>
        <g opacity={scrub ? 0.2 : 1}>
          <path d={fill} fill={`url(#${fillGrad})`} />
          <path
            d={d}
            fill="none"
            stroke={`url(#${lineGrad})`}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        {scrub ? (
          <g clipPath={`url(#${clipId})`}>
            <path d={fill} fill={`url(#${fillGrad})`} />
            <path
              d={d}
              fill="none"
              stroke={`url(#${lineGrad})`}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>
      {scrub ? (
        <>
          <i
            className={styles.pnlScrubLine}
            style={{ left: `${scrub.left}%` }}
            aria-hidden
          />
          <i
            className={styles.pnlScrubDot}
            style={{
              left: `${scrub.left}%`,
              top: `${scrub.top}%`,
            }}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
}

function PnlCard({
  bets,
  currency,
}: {
  bets: BtcBetHistoryDto[];
  currency: string;
}) {
  const { t, locale } = useLocale();
  const [range, setRange] = useState<PnlRange>("1d");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const ranges = useMemo(
    () =>
      (
        [
          ["1d", "trading.pnlRange1d", "trading.pnlSub1d"],
          ["1w", "trading.pnlRange1w", "trading.pnlSub1w"],
          ["1m", "trading.pnlRange1m", "trading.pnlSub1m"],
          ["1y", "trading.pnlRange1y", "trading.pnlSub1y"],
          ["ytd", "trading.pnlRangeYtd", "trading.pnlSubYtd"],
          ["all", "trading.pnlRangeAll", "trading.pnlSubAll"],
        ] as const
      ).map(([id, labelKey, subKey]) => ({
        id: id as PnlRange,
        label: t(labelKey),
        sub: t(subKey),
      })),
    [t],
  );
  const meta = ranges.find((r) => r.id === range) ?? ranges[0]!;
  const { points, total } = useMemo(() => {
    const now = Date.now();
    return buildPnlSeries(bets, pnlRangeSince(range, now), now);
  }, [bets, range]);
  const scrubbed =
    scrubIndex != null ? samplePnl(points, scrubIndex) : null;
  const display = scrubbed?.v ?? total;
  const positive = display >= 0;
  const isUsd =
    currency.toUpperCase() === "USD" || currency.toUpperCase() === "USDT";
  const sub =
    scrubbed != null ? formatPnlStamp(scrubbed.t, locale) : meta.sub;

  return (
    <div className={styles.pnlCard}>
      <div className={styles.pnlHead}>
        <span className={styles.pnlTitle}>
          <i
            className={`${styles.pnlArrow} ${positive ? "" : styles.pnlArrowDown}`}
            aria-hidden
          />
          {t("trading.pnlTitle")}
        </span>
        <div className={styles.pnlRanges} role="group" aria-label={t("trading.pnlRangeAria")}>
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              className={
                range === r.id ? styles.pnlRangeOn : styles.pnlRangeBtn
              }
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

      <div className={styles.pnlValueRow}>
        <div className={styles.pnlValueBlock}>
          <strong
            className={`${styles.pnlValue} ${
              scrubIndex != null ? styles.pnlValueScrubbing : ""
            }`}
          >
            <ScrubMoney
              value={Math.abs(display)}
              currency={currency}
              fractionDigits={isUsd ? 2 : 0}
              active={scrubIndex != null}
            />
          </strong>
          <span className={styles.pnlSub}>{sub}</span>
        </div>
      </div>

      <PnlSparkline
        points={points}
        scrubIndex={scrubIndex}
        onScrub={setScrubIndex}
      />
    </div>
  );
}

const SYMBOLS = TRADING_MARKETS.map((m) => ({
  id: m.symbol,
  label: m.short,
  slug: m.slug,
}));
type ChartMode = "calm" | "detail" | "price";

/** Fixed portal menu — survives page overflow:clip ancestors. */
function SeriesDropdown({
  open,
  anchorRef,
  align = "left",
  className,
  width = 180,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  align?: "left" | "right";
  className: string;
  width?: number;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      const spaceAbove = r.top - 12;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const placeUp = spaceAbove >= 160 || spaceAbove >= spaceBelow;
      const maxHeight = Math.max(120, Math.min(280, placeUp ? spaceAbove : spaceBelow));
      let left = align === "right" ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const top = placeUp
        ? Math.max(8, r.top - gap - maxHeight)
        : r.bottom + gap;
      setBox({ top, left, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, align, width]);

  if (!open || !box || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={className}
      data-series-menu="1"
      role="listbox"
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        width,
        maxHeight: box.maxHeight,
        zIndex: 10050,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function assetBase(symbol: string) {
  return symbol.replace("USDT", "");
}

function roundShortKey(ms: number) {
  if (ms === 60_000) return "trading.round1mShort" as const;
  if (ms === 900_000) return "trading.round15mShort" as const;
  return "trading.round5mShort" as const;
}

function roundOptKey(ms: number) {
  if (ms === 60_000) return "trading.round1m" as const;
  if (ms === 900_000) return "trading.round15m" as const;
  return "trading.round5m" as const;
}

function formatZoneStamp(
  ms: number,
  timeZone: string,
  locale: AppLocale,
): { date: string; time: string } {
  const d = new Date(ms);
  const intl = toIntlLocale(locale);
  const date = new Intl.DateTimeFormat(intl, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat(intl, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

function formatTimerParts(ms: number) {
  // Ceil so the last second still shows "1" until it actually expires.
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return {
    mm: m.toString().padStart(2, "0"),
    ss: r.toString().padStart(2, "0"),
    totalSec: s,
  };
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatPrice(n: number | null | undefined) {
  return formatAssetPrice(n);
}

/** Implied UP/DOWN share from live vs strike — moves with BTC like a paper market. */
function impliedSideProbs(live: number | null, open: number | null) {
  if (live == null || open == null || !(open > 0)) {
    return { up: 0.5, down: 0.5 };
  }
  const rel = (live - open) / open;
  const up = Math.min(0.78, Math.max(0.22, 0.5 + Math.tanh(rel * 900) * 0.28));
  return { up, down: 1 - up };
}

/** Display payout if you bought this side now; at 50/50 equals house odds. */
function liveSidePayout(
  stake: number,
  odds: number,
  sideP: number,
  isUsd: boolean,
) {
  const scaled = stake * odds * (0.5 / Math.max(0.22, sideP));
  const capped = Math.min(
    stake * odds * 1.35,
    Math.max(stake * odds * 0.75, scaled),
  );
  return isUsd ? Math.round(capped * 100) / 100 : Math.floor(capped);
}

export function BtcUpdownGame({
  initialSymbol = "BTCUSDT",
  initialRoundMs,
  initialSide,
}: {
  initialSymbol?: string;
  initialRoundMs?: number;
  initialSide?: "UP" | "DOWN";
}) {
  const { isAuth } = useAuth();
  const { currency } = useCurrency();
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const cur = currency || "KZT";
  const presets = presetsForCurrency(cur);
  const stakeStep = stakeStepForCurrency(cur);
  const holdStakeStep = holdStakeStepForCurrency(cur);

  const [stake, setStake] = useState(() => presetsForCurrency("KZT")[1] ?? 5000);
  const [stakeEditing, setStakeEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [nowSkew, setNowSkew] = useState(0);
  const [selected, setSelected] = useState<"UP" | "DOWN" | null>(
    initialSide ?? null,
  );
  const [tick, setTick] = useState(0);
  const [quote, setQuote] = useState<BtcQuoteDto | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("calm");
  const [chartView, setChartView] = useState<"live" | "pro">("live");
  const [symbol, setSymbol] = useState(initialSymbol);
  const [roundMs, setRoundMs] = useState(() => {
    const allowed = roundsForSymbol(initialSymbol);
    if (
      initialRoundMs != null &&
      (allowed as readonly number[]).includes(initialRoundMs)
    ) {
      return initialRoundMs;
    }
    return allowed.includes(300_000) ? 300_000 : (allowed[0] ?? 300_000);
  });
  const [dismissedResultId, setDismissedResultId] = useState<number | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesWrapRef = useRef<HTMLDivElement>(null);
  /** Instant FIX markers before myBets refetch lands. */
  const [optimisticPositions, setOptimisticPositions] = useState<
    ChartPosition[]
  >([]);

  const roundOptions = useMemo(
    () =>
      roundsForSymbol(symbol).map((ms) => ({
        ms,
        label: t(roundOptKey(ms)),
      })),
    [symbol, t],
  );
  const stateQuery = useQuery({
    queryKey: ["btc-updown-state", symbol, roundMs],
    queryFn: () => fetchBtcState(symbol, roundMs),
    refetchInterval: 160,
    staleTime: 80,
  });

  const state = stateQuery.data as BtcStateDto | undefined;
  const maxStake =
    state?.config?.maxStakeByCurrency?.[cur.toUpperCase()] ??
    maxStakeForCurrency(cur);
  const minStake = state?.config?.minStake ?? stakeStep;

  const nudgeStake = useCallback(
    (dir: 1 | -1, step: number) => {
      setStake((s) => Math.min(maxStake, Math.max(minStake, s + dir * step)));
    },
    [maxStake, minStake],
  );

  const holdTimers = useRef<{ delay: number | null; tick: number | null }>({
    delay: null,
    tick: null,
  });

  const clearStakeHold = useCallback(() => {
    const h = holdTimers.current;
    if (h.delay != null) window.clearTimeout(h.delay);
    if (h.tick != null) window.clearInterval(h.tick);
    h.delay = null;
    h.tick = null;
  }, []);

  useEffect(() => () => clearStakeHold(), [clearStakeHold]);

  const onStakeHoldStart = useCallback(
    (dir: 1 | -1) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
      clearStakeHold();
      nudgeStake(dir, stakeStep);
      holdTimers.current.delay = window.setTimeout(() => {
        holdTimers.current.tick = window.setInterval(() => {
          nudgeStake(dir, holdStakeStep);
        }, 55);
      }, 360);
    },
    [clearStakeHold, nudgeStake, stakeStep, holdStakeStep],
  );

  const [mergedTicks, setMergedTicks] = useState<{ t: number; p: number }[]>(
    [],
  );
  const [chartScrub, setChartScrub] = useState<{
    t: number;
    p: number;
  } | null>(null);
  const [seriesPastOpen, setSeriesPastOpen] = useState(false);
  const [seriesMoreOpen, setSeriesMoreOpen] = useState(false);
  /** live | past round id | upcoming start ms as `up:${ms}` */
  const [seriesSelectedId, setSeriesSelectedId] = useState<
    number | "live" | `up:${number}`
  >("live");
  const seriesRailRef = useRef<HTMLDivElement>(null);
  const seriesPastBtnRef = useRef<HTMLButtonElement>(null);
  const seriesMoreBtnRef = useRef<HTMLButtonElement>(null);
  const [timerTipOpen, setTimerTipOpen] = useState(false);

  useEffect(() => {
    if (!seriesPastOpen && !seriesMoreOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-series-menu]")) return;
      const root = seriesRailRef.current;
      if (root && target && !root.contains(target)) {
        setSeriesPastOpen(false);
        setSeriesMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [seriesPastOpen, seriesMoreOpen]);

  // Drop previous market path immediately — never blend BTC ticks into ETH/SOL.
  useEffect(() => {
    setMergedTicks([]);
    setChartScrub(null);
    setSeriesPastOpen(false);
    setSeriesMoreOpen(false);
    setSeriesSelectedId("live");
  }, [symbol, roundMs]);

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  // ETH/SOL have no 1m — clamp if user switches from BTC while on 1m.
  useEffect(() => {
    const allowed = roundsForSymbol(symbol);
    if (!(allowed as readonly number[]).includes(roundMs)) {
      setRoundMs(allowed[0] ?? 300_000);
    }
  }, [symbol, roundMs]);

  // Keep stake on a valid preset when wallet currency changes.
  useEffect(() => {
    const next = presetsForCurrency(cur);
    setStake((s) => (next.includes(s) ? s : (next[1] ?? next[0]!)));
  }, [cur]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const sync = () => setIsCompactLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (initialSide === "UP" || initialSide === "DOWN") {
      setSelected(initialSide);
    }
  }, [initialSide, initialSymbol, initialRoundMs]);

  const marketSlug =
    TRADING_MARKETS.find((m) => m.symbol === symbol)?.slug ?? "btc";

  const replaceMarketUrl = (next: {
    symbol?: string;
    roundMs?: number;
    side?: "UP" | "DOWN" | null;
  }) => {
    const nextSymbol = next.symbol ?? symbol;
    const slug =
      TRADING_MARKETS.find((m) => m.symbol === nextSymbol)?.slug ?? marketSlug;
    const nextRound = next.roundMs ?? roundMs;
    const nextSide = next.side !== undefined ? next.side : selected;
    const qs = new URLSearchParams();
    qs.set("round", String(nextRound));
    if (nextSide === "UP" || nextSide === "DOWN") qs.set("side", nextSide);
    router.replace(`/trading/${slug}?${qs.toString()}`);
  };

  useEffect(() => {
    const incoming = state?.ticks;
    const live = state?.price;
    const now = Date.now();
    const refPrice =
      live ??
      (incoming?.length ? incoming[incoming.length - 1]!.p : null);
    setMergedTicks((prev) => {
      const map = new Map<number, number>();
      for (const t of prev) {
        if (t.t < now - 180_000) continue;
        // Guard against stale cross-asset samples during query swap.
        if (
          refPrice != null &&
          Number.isFinite(refPrice) &&
          refPrice > 0 &&
          Math.abs(t.p - refPrice) / refPrice > 0.2
        ) {
          continue;
        }
        map.set(t.t, t.p);
      }
      if (incoming?.length) {
        for (const t of incoming) map.set(t.t, t.p);
      }
      // Do NOT inject live at Date.now() every poll — that stacked a new
      // tip every ~160ms and made the path thrash. Chart pins the live tip.
      return [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, p]) => ({ t, p }));
    });
  }, [state?.ticks, state?.price, state?.serverNow, symbol, roundMs]);

  const historyQuery = useQuery({
    queryKey: ["btc-updown-history"],
    queryFn: () => fetchBtcBetHistory(50),
    enabled: isAuth,
    staleTime: state?.myBets?.some((b) => b.status === "PENDING") ? 1_000 : 10_000,
    refetchInterval: state?.myBets?.some((b) => b.status === "PENDING")
      ? 2_000
      : 10_000,
  });
  const statsQuery = useQuery({
    queryKey: ["btc-updown-daily", cur],
    queryFn: () => fetchBtcDailyStats(cur),
    enabled: isAuth,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const refreshUserBalance = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["user"] });
    void queryClient.refetchQueries({ queryKey: ["user"] });
  }, [queryClient]);

  useEffect(() => {
    if (!state?.serverNow) return;
    setNowSkew(Date.parse(state.serverNow) - Date.now());
  }, [state?.serverNow]);

  useEffect(() => {
    if (!state?.round?.id || !isAuth) return;
    void queryClient.invalidateQueries({ queryKey: ["btc-updown-history"] });
    void queryClient.invalidateQueries({ queryKey: ["btc-updown-daily"] });
    // Round flipped → previous round settled; pull credited balance immediately.
    refreshUserBalance();
  }, [state?.round?.id, isAuth, queryClient, refreshUserBalance]);

  useEffect(() => {
    setDismissedResultId(null);
    setOptimisticPositions([]);
  }, [symbol, roundMs]);

  useEffect(() => {
    setOptimisticPositions([]);
  }, [state?.round?.id]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const msToEnd = useMemo(() => {
    if (!state?.round?.endsAt) return 0;
    return Math.max(
      0,
      Date.parse(state.round.endsAt) - (Date.now() + nowSkew),
    );
  }, [state?.round?.endsAt, nowSkew, tick]);

  const msToLock = useMemo(() => {
    if (!state) return 0;
    const lockAt =
      Date.parse(state.round.endsAt) - (state.config?.lockMs ?? 15_000);
    return Math.max(0, lockAt - (Date.now() + nowSkew));
  }, [state, nowSkew, tick]);

  const bettingOpen = Boolean(
    state?.bettingOpen && msToLock > 0 && !state?.config?.bettingPaused,
  );
  const urgent =
    msToEnd > 0 &&
    msToEnd < Math.min(45_000, Math.max(12_000, roundMs / 5));

  const odds = state?.config?.odds ?? 1.8;
  const isUsd = cur.toUpperCase() === "USD" || cur.toUpperCase() === "USDT";
  const potential = isUsd
    ? Math.round(stake * odds * 100) / 100
    : Math.floor(stake * odds);
  const profit = Math.max(0, Math.round((potential - stake) * 100) / 100);
  const asset = assetBase(symbol);
  const theme = themeForSymbol(symbol);
  const sideProb = impliedSideProbs(
    state?.price ?? null,
    state?.openPrice ?? null,
  );
  const upLivePay = liveSidePayout(stake, odds, sideProb.up, isUsd);
  const downLivePay = liveSidePayout(stake, odds, sideProb.down, isUsd);
  const upHot = sideProb.up >= sideProb.down;
  const pickSide = selected ?? (upHot ? "UP" : "DOWN");
  const pickProb = pickSide === "UP" ? sideProb.up : sideProb.down;

  const placeMut = useMutation({
    mutationFn: (payload: { side: "UP" | "DOWN"; expectedPrice?: number }) =>
      placeBtcBet(
        payload.side,
        stake,
        cur,
        symbol,
        roundMs,
        payload.expectedPrice,
      ),
    onSuccess: (bet) => {
      setError(null);
      setSelected(bet.side);
      setQuote(null);
      const entry =
        bet.entryPrice != null && Number.isFinite(bet.entryPrice)
          ? bet.entryPrice
          : state?.price ?? state?.openPrice ?? null;
      if (entry != null) {
        const live = state?.price ?? entry;
        setOptimisticPositions((prev) => {
          if (prev.some((p) => p.id === bet.id)) return prev;
          return [
            ...prev,
            {
              id: bet.id,
              side: bet.side,
              stake: bet.stake,
              entryPrice: entry,
              placedAtMs: Date.now(),
              winning: bet.side === "UP" ? live >= entry : live < entry,
              currency: bet.currencyCode,
            },
          ];
        });
      }
      setFlash(
        t("trading.accepted", {
          asset,
          entry: formatPrice(bet.entryPrice ?? entry ?? 0),
          stake: formatMoneyAmount(bet.stake, bet.currencyCode),
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: ["btc-updown-state", symbol, roundMs],
      });
      void queryClient.invalidateQueries({ queryKey: ["btc-updown-history"] });
      void queryClient.invalidateQueries({ queryKey: ["btc-updown-daily"] });
      refreshUserBalance();
      window.setTimeout(() => setFlash(null), 4200);
    },
    onError: (err: Error) => {
      setError(mapTradingError(err, t, "trading.orderRejected"));
    },
  });

  const loadQuote = async () => {
    setQuoteLoading(true);
    try {
      const next = await fetchBtcQuote(symbol, roundMs);
      setQuote(next);
      return next;
    } catch (err) {
      setError(mapTradingError(err, t, "trading.quoteError"));
      return null;
    } finally {
      setQuoteLoading(false);
    }
  };

  const placeBet = async (side: "UP" | "DOWN") => {
    // Sync in the click gesture — after await browsers mute Audio.
    unlockBetClickSound();
    playBetClickSound();
    setSelected(side);
    replaceMarketUrl({ side });
    setSeriesSelectedId("live");
    setSeriesPastOpen(false);
    setSeriesMoreOpen(false);
    if (!isAuth) {
      setError(t("trading.loginToTrade"));
      return;
    }
    if (!bettingOpen) {
      setError(t("trading.marketClosedWait"));
      return;
    }
    if (placeMut.isPending || quoteLoading) return;
    setError(null);
    const fresh = quote ?? (await loadQuote());
    if (!fresh) return;
    if (Date.parse(fresh.validUntil) < Date.now()) {
      const refreshed = await loadQuote();
      if (!refreshed) return;
      placeMut.mutate({
        side,
        expectedPrice: refreshed.price,
      });
      return;
    }
    placeMut.mutate({
      side,
      expectedPrice: fresh.price,
    });
  };

  const openPrice = state?.openPrice ?? null;
  const livePrice = state?.price ?? null;

  const viewingUpcomingMs =
    typeof seriesSelectedId === "string" && seriesSelectedId.startsWith("up:")
      ? Number(seriesSelectedId.slice(3))
      : null;
  const viewingUpcoming =
    viewingUpcomingMs != null && Number.isFinite(viewingUpcomingMs);

  const selectedSeriesRound = useMemo(() => {
    if (seriesSelectedId === "live" || viewingUpcoming) return null;
    if (typeof seriesSelectedId !== "number") return null;
    return (
      (state?.recentRounds ?? []).find((r) => r.id === seriesSelectedId) ?? null
    );
  }, [seriesSelectedId, state?.recentRounds, viewingUpcoming]);

  useEffect(() => {
    if (seriesSelectedId === "live" || viewingUpcoming) return;
    if (!selectedSeriesRound) setSeriesSelectedId("live");
  }, [seriesSelectedId, selectedSeriesRound, viewingUpcoming]);

  // When the previewed upcoming slot becomes the live round, snap back to live.
  useEffect(() => {
    if (!viewingUpcoming || viewingUpcomingMs == null) return;
    const liveStart = state?.round?.startsAt
      ? Date.parse(state.round.startsAt)
      : NaN;
    if (Number.isFinite(liveStart) && liveStart >= viewingUpcomingMs) {
      setSeriesSelectedId("live");
    }
  }, [viewingUpcoming, viewingUpcomingMs, state?.round?.startsAt]);

  const viewingPast = selectedSeriesRound != null;
  const heroOpenPrice = viewingPast
    ? selectedSeriesRound.openPrice
    : openPrice;
  const heroLivePrice = viewingPast
    ? selectedSeriesRound.closePrice
    : (chartScrub?.p ?? livePrice);

  const pendingBets = useMemo(() => {
    if (!state?.myBets?.length) return [];
    return state.myBets
      .filter((b) => b.status === "PENDING")
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [state?.myBets]);

  const prevPendingIdsRef = useRef<number[]>([]);
  useEffect(() => {
    const ids = pendingBets.map((b) => b.id);
    const prev = prevPendingIdsRef.current;
    const cleared = prev.some((id) => !ids.includes(id));
    prevPendingIdsRef.current = ids;
    if (!cleared || !isAuth) return;
    void queryClient.invalidateQueries({ queryKey: ["btc-updown-history"] });
    void queryClient.invalidateQueries({ queryKey: ["btc-updown-daily"] });
    refreshUserBalance();
  }, [pendingBets, isAuth, queryClient, refreshUserBalance]);

  const chartPositions = useMemo(() => {
    const fromServer = pendingBets
      .map((b) => {
        const entry =
          b.entryPrice != null && Number.isFinite(b.entryPrice)
            ? b.entryPrice
            : openPrice;
        if (entry == null) return null;
        const winning =
          livePrice == null
            ? null
            : b.side === "UP"
              ? livePrice >= entry
              : livePrice < entry;
        return {
          id: b.id,
          side: b.side,
          stake: b.stake,
          entryPrice: entry,
          placedAtMs: Date.parse(b.createdAt),
          winning,
          currency: b.currencyCode,
        } satisfies ChartPosition;
      })
      .filter((x): x is ChartPosition => x != null);

    const byId = new Map<number, ChartPosition>();
    for (const p of optimisticPositions) byId.set(p.id, p);
    for (const p of fromServer) byId.set(p.id, p);

    return [...byId.values()]
      .map((p) => {
        if (livePrice == null) return p;
        return {
          ...p,
          winning:
            p.side === "UP"
              ? livePrice >= p.entryPrice
              : livePrice < p.entryPrice,
        };
      })
      .sort((a, b) => a.placedAtMs - b.placedAtMs);
  }, [pendingBets, openPrice, livePrice, optimisticPositions]);

  /* Drop optimistic markers once the bet leaves PENDING (win/lose → evaporate). */
  useEffect(() => {
    const pendingIds = new Set(pendingBets.map((b) => b.id));
    setOptimisticPositions((prev) => {
      const next = prev.filter(
        (p) => pendingIds.has(p.id) || Date.now() - p.placedAtMs < 2500,
      );
      return next.length === prev.length ? prev : next;
    });
  }, [pendingBets]);

  const latestResult = useMemo(() => {
    const result = historyQuery.data?.find(
      (bet) =>
        (bet.status === "WIN" || bet.status === "LOSE") &&
        bet.round.symbol === symbol &&
        (bet.round.roundMs ?? 300_000) === roundMs &&
        bet.settledAt != null &&
        Date.now() - Date.parse(bet.settledAt) < 45_000,
    );
    return result && result.id !== dismissedResultId ? result : null;
  }, [historyQuery.data, symbol, roundMs, dismissedResultId, tick]);


  const playedResultSoundRef = useRef(new Set<number>());
  const creditedResultIdsRef = useRef(new Set<number>());
  useEffect(() => {
    if (!latestResult) return;
    if (playedResultSoundRef.current.has(latestResult.id)) return;
    playedResultSoundRef.current.add(latestResult.id);
    if (latestResult.status === "WIN") playBetWinSound();
    else if (latestResult.status === "LOSE") playBetLoseSound();
  }, [latestResult]);

  useEffect(() => {
    if (!latestResult || latestResult.status !== "WIN") return;
    if (creditedResultIdsRef.current.has(latestResult.id)) return;
    creditedResultIdsRef.current.add(latestResult.id);
    refreshUserBalance();
  }, [latestResult, refreshUserBalance]);

  useEffect(() => {
    if (!latestResult) return;
    const id = window.setTimeout(() => {
      setDismissedResultId(latestResult.id);
    }, 2100);
    return () => window.clearTimeout(id);
  }, [latestResult]);

  useEffect(() => {
    if (!rulesOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rulesWrapRef.current?.contains(e.target as Node)) {
        setRulesOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRulesOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [rulesOpen]);

  const progress =
    state?.round?.startsAt && state?.round?.endsAt
      ? Math.min(
          1,
          Math.max(
            0,
            (Date.now() + nowSkew - Date.parse(state.round.startsAt)) /
              (Date.parse(state.round.endsAt) -
                Date.parse(state.round.startsAt)),
          ),
        )
      : 0;

  const startsAtMs = useMemo(
    () => (state ? Date.parse(state.round.startsAt) : 0),
    [state?.round?.startsAt],
  );
  const endsAtMs = useMemo(
    () => (state ? Date.parse(state.round.endsAt) : 0),
    [state?.round?.endsAt],
  );
  const lockAtMs = useMemo(() => {
    if (!state) return 0;
    return (
      Date.parse(state.round.endsAt) - (state.config?.lockMs ?? 15_000)
    );
  }, [state?.round?.endsAt, state?.config?.lockMs]);

  const lockWindowMs = Math.max(
    1,
    roundMs - (state?.config?.lockMs ?? 15_000),
  );
  const railPct = bettingOpen
    ? Math.min(1, Math.max(0, msToLock / lockWindowMs))
    : Math.min(1, Math.max(0, msToEnd / Math.max(1, roundMs)));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected("UP");
        replaceMarketUrl({ side: "UP" });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected("DOWN");
        replaceMarketUrl({ side: "DOWN" });
      } else if (event.key === "Enter" && selected) {
        event.preventDefault();
        void placeBet(selected);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, bettingOpen, isAuth, quote, quoteLoading, placeMut.isPending]);


  // Polymarket-style: always count down to round expiry (not lock).
  const timerMs = msToEnd;
  const timer = formatTimerParts(timerMs);
  const minsLeft = Math.max(0, Math.floor(timerMs / 60_000));
  const settleAtMs = endsAtMs || Date.now() + Math.max(0, timerMs);
  const settleEt = useMemo(
    () => formatZoneStamp(settleAtMs, "America/New_York", locale),
    [settleAtMs, locale],
  );
  const settleUtc = useMemo(
    () => formatZoneStamp(settleAtMs, "UTC", locale),
    [settleAtMs, locale],
  );
  const titleRound = t(roundShortKey(roundMs));
  const pageTitle = asset;
  const roundWindowLabel = useMemo(() => {
    if (!startsAtMs || !endsAtMs) return null;
    const intlLocale = toIntlLocale(locale);
    const fmt = new Intl.DateTimeFormat(intlLocale, {
      timeZone: "America/New_York",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
    const startParts = fmt.formatToParts(new Date(startsAtMs));
    const endParts = fmt.formatToParts(new Date(endsAtMs));
    const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const month = get(startParts, "month");
    const day = get(startParts, "day");
    const pad2 = (s: string) => s.padStart(2, "0");
    const startH = pad2(get(startParts, "hour"));
    const startM = pad2(get(startParts, "minute"));
    const endH = pad2(get(endParts, "hour"));
    const endM = pad2(get(endParts, "minute"));
    return `${month} ${day}, ${startH}:${startM}–${endH}:${endM} ET`;
  }, [startsAtMs, endsAtMs, locale]);
  const changeAbs =
    heroOpenPrice != null && heroLivePrice != null
      ? heroLivePrice - heroOpenPrice
      : null;
  const displayLive = heroLivePrice;
  const changePctLive =
    heroOpenPrice != null &&
    displayLive != null &&
    heroOpenPrice !== 0 &&
    Number.isFinite(heroOpenPrice) &&
    Number.isFinite(displayLive)
      ? ((displayLive - heroOpenPrice) / heroOpenPrice) * 100
      : !viewingPast && chartScrub == null
        ? (state?.changePct ?? null)
        : null;

  const chartScrubStamp =
    !viewingPast && chartScrub != null
      ? new Date(chartScrub.t).toLocaleTimeString(toIntlLocale(locale), {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : null;

  const renderTicketControls = () => (
    <>
      {!isAuth ? (
        <div className={styles.statusCard}>
          <p>{t("trading.authCard")}</p>
          <a href="/login" className={styles.statusLink}>
            {t("trading.login")}
          </a>
        </div>
      ) : null}

      {isAuth && state?.config?.bettingPaused ? (
        <div className={styles.statusCard}>
          <p>{t("trading.riskPause")}</p>
        </div>
      ) : null}

      {isAuth && !bettingOpen && !state?.config?.bettingPaused ? (
        <div className={styles.statusCard}>
          <p>
            {t("trading.marketClosedUntil", { time: formatMs(msToEnd) })}
            {pendingBets.length
              ? t("trading.positionLocked")
              : t("trading.betsNextRound")}
            .
          </p>
        </div>
      ) : null}

      {chartPositions.length > 0 ? (
        <div className={styles.posList}>
          <div className={styles.sectionLabel}>{t("trading.openPosition")}</div>
          {chartPositions.map((pos) => {
            const leading = pos.winning;
            const unrealized =
              leading == null
                ? null
                : leading
                  ? pos.stake * odds - pos.stake
                  : -pos.stake;
            const posCur = (pos.currency ?? cur).toUpperCase();
            const frac = posCur === "USD" || posCur === "USDT" ? 2 : 0;
            return (
              <div
                key={pos.id}
                className={`${styles.posCard} ${
                  leading === true
                    ? styles.posLead
                    : leading === false
                      ? styles.posTrail
                      : ""
                }`}
              >
                <div className={styles.posRow}>
                  <span className={styles.posSide}>
                    <ArrowUpIcon
                      width="12"
                      height="15"
                      className={
                        pos.side === "DOWN"
                          ? `${styles.btnDirIcon} ${styles.btnDirDown}`
                          : styles.btnDirIcon
                      }
                      aria-hidden
                    />
                    {formatMoneyAmount(pos.stake, pos.currency ?? cur)}
                  </span>
                  <span className={styles.posMeta}>
                    entry ${formatPrice(pos.entryPrice)}
                  </span>
                </div>
                <div className={styles.posRow}>
                  <span>
                    {leading == null
                      ? t("trading.waitingPrice")
                      : leading
                        ? t("trading.leadingNow")
                        : t("trading.trailingNow")}
                  </span>
                  <b
                    className={
                      unrealized == null
                        ? undefined
                        : unrealized >= 0
                          ? styles.up
                          : styles.down
                    }
                  >
                    {unrealized == null
                      ? "—"
                      : `${unrealized >= 0 ? "+" : ""}${formatMoneyAmount(
                          unrealized,
                          pos.currency ?? cur,
                          frac,
                        )}`}
                  </b>
                </div>
                <div className={styles.posRow}>
                  <span>
                    {msToLock > 0
                      ? t("trading.untilLock")
                      : t("trading.untilSettle")}
                  </span>
                  <b>
                    {formatMs(msToLock > 0 ? msToLock : msToEnd)}
                  </b>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <>
          <div className={styles.tradeRow}>
            <button
              type="button"
              className={upHot ? styles.btnUp : styles.btnUpMuted}
              disabled={!bettingOpen || placeMut.isPending}
              aria-label={t("trading.betUp")}
              onClick={() => void placeBet("UP")}
            >
              <ArrowUpIcon
                width="14"
                height="18"
                className={styles.btnDirIcon}
                aria-hidden
              />
              <span className={styles.btnPay}>
                {formatMoneyAmount(upLivePay, cur, isUsd ? 2 : 0)}
              </span>
            </button>
            <button
              type="button"
              className={!upHot ? styles.btnDown : styles.btnDownMuted}
              disabled={!bettingOpen || placeMut.isPending}
              aria-label={t("trading.betDown")}
              onClick={() => void placeBet("DOWN")}
            >
              <ArrowUpIcon
                width="14"
                height="18"
                className={`${styles.btnDirIcon} ${styles.btnDirDown}`}
                aria-hidden
              />
              <span className={styles.btnPay}>
                {formatMoneyAmount(downLivePay, cur, isUsd ? 2 : 0)}
              </span>
            </button>
          </div>

          <div className={styles.quick}>
            <h3>{t("trading.quickBuy")}</h3>
            <div className={styles.quickGrid}>
              {presets.map((v) => {
                const pay = liveSidePayout(v, odds, pickProb, isUsd);
                return (
                  <button
                    key={v}
                    type="button"
                    className={stake === v ? styles.quickOn : styles.quickCard}
                    onClick={() => setStake(v)}
                  >
                    <b className={styles.quickStake}>
                      {formatMoneyAmount(v, cur)}
                    </b>
                    <span className={styles.quickWinAmt}>
                      {formatMoneyAmount(pay, cur, isUsd ? 2 : 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.sizeRow}>
            <button
              type="button"
              aria-label="−"
              className={styles.sizeBtn}
              onPointerDown={onStakeHoldStart(-1)}
              onPointerUp={clearStakeHold}
              onPointerCancel={clearStakeHold}
              onLostPointerCapture={clearStakeHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              −
            </button>
            {stakeEditing ? (
              <input
                className={styles.sizeInput}
                type="number"
                min={minStake}
                max={maxStake}
                step={stakeStep}
                value={stake}
                autoFocus
                onChange={(e) => setStake(Number(e.target.value) || 0)}
                onBlur={() => {
                  setStake((s) =>
                    Math.min(maxStake, Math.max(minStake, s || minStake)),
                  );
                  setStakeEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={styles.sizeValue}
                onClick={() => setStakeEditing(true)}
                aria-label={formatMoneyAmount(stake, cur)}
              >
                {formatMoneyAmount(stake, cur)}
              </button>
            )}
            <button
              type="button"
              aria-label="+"
              className={styles.sizeBtn}
              onPointerDown={onStakeHoldStart(1)}
              onPointerUp={clearStakeHold}
              onPointerCancel={clearStakeHold}
              onLostPointerCapture={clearStakeHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              +
            </button>
          </div>

          <div className={styles.details}>
            <div>
              <span>{t("trading.multiplier")}</span>
              <b>×{odds.toFixed(2)}</b>
            </div>
            <div>
              <span>{t("trading.payout")}</span>
              <b>
                {formatMoneyAmount(
                  pickSide === "UP" ? upLivePay : downLivePay,
                  cur,
                  isUsd ? 2 : 0,
                )}
              </b>
            </div>
            <div>
              <span>{t("trading.netProfit")}</span>
              <b className={styles.detailsProfit}>
                +
                {formatMoneyAmount(
                  Math.max(
                    0,
                    (pickSide === "UP" ? upLivePay : downLivePay) - stake,
                  ),
                  cur,
                  isUsd ? 2 : 0,
                )}
              </b>
            </div>
          </div>
        </>

      {error ? <p className={styles.err}>{error}</p> : null}
      {flash ? <p className={styles.ok}>{flash}</p> : null}
    </>
  );

  const pnlBlock = isAuth ? (
    <PnlCard bets={historyQuery.data ?? []} currency={cur} />
  ) : null;


  const recentSettled = useMemo(() => {
    const list = state?.recentRounds ?? [];
    // API returns newest-first; rail wants oldest → newest.
    return [...list].reverse();
  }, [state?.recentRounds]);

  const seriesPastResults = useMemo(
    () =>
      recentSettled
        .filter((r) => r.result === "UP" || r.result === "DOWN")
        .slice(-4),
    [recentSettled],
  );

  const seriesTimeSlots = useMemo(() => {
    const past = recentSettled.slice(-3);
    const current = state?.round ?? null;
    const anchorMs =
      current?.endsAt != null
        ? Date.parse(current.endsAt)
        : endsAtMs != null
          ? endsAtMs
          : null;
    const upcoming: number[] = [];
    if (anchorMs != null && Number.isFinite(anchorMs) && roundMs > 0) {
      let t = anchorMs;
      // ~1h of future slots on 5m; scales with round length.
      const count = Math.max(8, Math.min(24, Math.ceil(3_600_000 / roundMs)));
      for (let i = 0; i < count; i++) {
        upcoming.push(t);
        t += roundMs;
      }
    }
    return {
      past,
      current,
      railUpcoming: upcoming.slice(0, 1),
      moreUpcoming: upcoming.slice(1),
    };
  }, [recentSettled, state?.round, endsAtMs, roundMs]);

  function formatRoundClock(
    isoOrMs: string | number,
    timeZone?: string,
  ) {
    const d = new Date(isoOrMs);
    if (!Number.isFinite(d.getTime())) return "—";
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      ...(timeZone ? { timeZone } : null),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  function formatSeriesDay(ms: number, timeZone = "America/New_York") {
    const d = new Date(ms);
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (dayKey.format(d) === dayKey.format(new Date())) {
      return t("trading.seriesToday");
    }
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      timeZone,
      day: "numeric",
      month: "short",
    }).format(d);
  }

  function selectSeriesRound(id: number | "live" | `up:${number}`) {
    setSeriesSelectedId(id);
    setSeriesPastOpen(false);
    setSeriesMoreOpen(false);
    setChartScrub(null);
  }

  const pastOnRail = new Set(seriesTimeSlots.past.map((r) => r.id));
  const pastSelectedOffRail =
    viewingPast &&
    selectedSeriesRound != null &&
    !pastOnRail.has(selectedSeriesRound.id);
  const upcomingOnRail = new Set(seriesTimeSlots.railUpcoming);
  const upcomingSelectedInMore =
    viewingUpcoming &&
    viewingUpcomingMs != null &&
    !upcomingOnRail.has(viewingUpcomingMs);

  const recentRounds = (
    <div className={styles.series} role="navigation" aria-label={t("trading.seriesAria")}>
      {viewingPast && selectedSeriesRound ? (
        <div className={styles.seriesViewing}>
          <div className={styles.seriesViewingMain}>
            <span>
              {t("trading.seriesViewing", {
                time: formatRoundClock(selectedSeriesRound.startsAt),
              })}
            </span>
            <span className={styles.seriesViewingResult}>
              <i
                className={
                  selectedSeriesRound.result === "UP"
                    ? styles.seriesResultUp
                    : styles.seriesResultDown
                }
                aria-hidden
              />
              {selectedSeriesRound.result === "UP"
                ? t("trading.seriesResultUp")
                : t("trading.seriesResultDown")}
            </span>
            {selectedSeriesRound.openPrice != null &&
            selectedSeriesRound.closePrice != null ? (
              <span className={styles.seriesViewingPrices}>
                ${formatAssetPrice(selectedSeriesRound.openPrice)} → $
                {formatAssetPrice(selectedSeriesRound.closePrice)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.seriesBackLive}
            onClick={() => selectSeriesRound("live")}
          >
            {t("trading.seriesBackLive")}
          </button>
        </div>
      ) : null}

      {viewingUpcoming && viewingUpcomingMs != null ? (
        <div className={styles.seriesViewing}>
          <div className={styles.seriesViewingMain}>
            <span>
              {t("trading.seriesUpcomingAt", {
                time: formatRoundClock(viewingUpcomingMs),
              })}
            </span>
            <span className={styles.seriesViewingPrices}>
              {formatSeriesDay(viewingUpcomingMs)}
            </span>
          </div>
          <button
            type="button"
            className={styles.seriesBackLive}
            onClick={() => selectSeriesRound("live")}
          >
            {t("trading.seriesBackLive")}
          </button>
        </div>
      ) : null}

      <div className={styles.seriesRail} ref={seriesRailRef}>
        <div
          className={`${styles.seriesPastWrap} ${
            seriesPastOpen ? styles.seriesPastWrapOpen : ""
          }`}
        >
          <button
            ref={seriesPastBtnRef}
            type="button"
            className={`${styles.seriesPill} ${styles.seriesPast} ${
              seriesPastOpen ? styles.seriesPillOpen : ""
            } ${pastSelectedOffRail ? styles.seriesPillMark : ""}`}
            aria-expanded={seriesPastOpen}
            aria-haspopup="listbox"
            onClick={(e) => {
              e.stopPropagation();
              setSeriesPastOpen((v) => !v);
              setSeriesMoreOpen(false);
            }}
          >
            <span className={styles.seriesPastLabel}>
              {t("trading.seriesPast")}
              <i
                className={`${styles.seriesChevron} ${
                  seriesPastOpen ? styles.seriesChevronOpen : ""
                }`}
                aria-hidden
              />
            </span>
            {seriesPastResults.length ? (
              <>
                <i className={styles.seriesPastSep} aria-hidden />
                <span className={styles.seriesPastResults} aria-hidden>
                  {seriesPastResults.map((r) => (
                    <i
                      key={r.id}
                      className={
                        r.result === "UP"
                          ? styles.seriesResultUp
                          : styles.seriesResultDown
                      }
                      title={r.result ?? ""}
                    />
                  ))}
                </span>
              </>
            ) : null}
          </button>
          <SeriesDropdown
            open={seriesPastOpen}
            anchorRef={seriesPastBtnRef}
            align="left"
            className={styles.seriesPastMenu}
            width={248}
          >
            {recentSettled.length ? (
              [...recentSettled].reverse().map((r) => {
                const startsMs = Date.parse(r.startsAt);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`${styles.seriesPastRow} ${
                      seriesSelectedId === r.id ? styles.seriesPastRowOn : ""
                    }`}
                    role="option"
                    aria-selected={seriesSelectedId === r.id}
                    onClick={() => selectSeriesRound(r.id)}
                  >
                    <i
                      className={
                        r.result === "UP"
                          ? styles.seriesResultUp
                          : styles.seriesResultDown
                      }
                      aria-label={r.result ?? ""}
                    />
                    <span className={styles.seriesPastMeta}>
                      <span className={styles.seriesPastTime}>
                        {formatRoundClock(r.startsAt, "America/New_York")}
                        <span className={styles.seriesPastZone}> ET</span>
                      </span>
                      <span className={styles.seriesPastDot} aria-hidden>
                        ·
                      </span>
                      <span className={styles.seriesPastDay}>
                        {Number.isFinite(startsMs)
                          ? formatSeriesDay(startsMs)
                          : "—"}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className={styles.seriesPastEmpty}>
                {t("trading.seriesNoPast")}
              </div>
            )}
          </SeriesDropdown>
        </div>

        <div className={styles.seriesRailScroll}>
          {seriesTimeSlots.past.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.seriesPill} ${
                seriesSelectedId === r.id ? styles.seriesPillOn : ""
              }`}
              title={r.result ?? ""}
              aria-pressed={seriesSelectedId === r.id}
              onClick={() => selectSeriesRound(r.id)}
            >
              {formatRoundClock(r.startsAt)}
            </button>
          ))}

          {seriesTimeSlots.current ? (
            <button
              type="button"
              className={`${styles.seriesPill} ${styles.seriesPillLive} ${
                seriesSelectedId === "live" ? styles.seriesPillOn : ""
              }`}
              aria-current={seriesSelectedId === "live" ? "true" : undefined}
              aria-label={t("trading.seriesLive")}
              onClick={() => selectSeriesRound("live")}
            >
              <i className={styles.seriesLiveDot} aria-hidden />
              {formatRoundClock(seriesTimeSlots.current.startsAt)}
            </button>
          ) : null}

          {seriesTimeSlots.railUpcoming.map((ms) => (
            <button
              key={ms}
              type="button"
              className={`${styles.seriesPill} ${
                viewingUpcomingMs === ms ? styles.seriesPillOn : ""
              }`}
              title={t("trading.seriesUpcoming")}
              aria-pressed={viewingUpcomingMs === ms}
              onClick={() => selectSeriesRound(`up:${ms}`)}
            >
              {formatRoundClock(ms)}
            </button>
          ))}
        </div>

        <div
          className={`${styles.seriesMoreWrap} ${
            seriesMoreOpen ? styles.seriesMoreWrapOpen : ""
          }`}
        >
          <button
            ref={seriesMoreBtnRef}
            type="button"
            className={`${styles.seriesPill} ${styles.seriesMore} ${
              seriesMoreOpen ? styles.seriesPillOpen : ""
            } ${upcomingSelectedInMore ? styles.seriesPillMark : ""}`}
            aria-expanded={seriesMoreOpen}
            aria-haspopup="listbox"
            disabled={seriesTimeSlots.moreUpcoming.length === 0}
            onClick={(e) => {
              e.stopPropagation();
              setSeriesMoreOpen((v) => !v);
              setSeriesPastOpen(false);
            }}
          >
            {t("trading.seriesMore")}
            <i
              className={`${styles.seriesChevron} ${
                seriesMoreOpen ? styles.seriesChevronOpen : ""
              }`}
              aria-hidden
            />
          </button>
          <SeriesDropdown
            open={seriesMoreOpen && seriesTimeSlots.moreUpcoming.length > 0}
            anchorRef={seriesMoreBtnRef}
            align="right"
            className={styles.seriesMoreMenu}
          >
            {seriesTimeSlots.moreUpcoming.map((ms) => (
              <button
                key={ms}
                type="button"
                className={`${styles.seriesPastRow} ${
                  viewingUpcomingMs === ms ? styles.seriesPastRowOn : ""
                }`}
                role="option"
                aria-selected={viewingUpcomingMs === ms}
                onClick={() => selectSeriesRound(`up:${ms}`)}
              >
                <span>
                  {formatRoundClock(ms)} · {formatSeriesDay(ms)}
                </span>
              </button>
            ))}
          </SeriesDropdown>
        </div>
      </div>
    </div>
  );


  const ticketPanel = (
    <aside className={styles.ticket}>
      <div className={styles.ticketHead}>
        <Image
          src={theme.logo}
          alt=""
          width={44}
          height={44}
          className={styles.ticketHeadLogo}
        />
        <div className={styles.ticketHeadText}>
          <strong>
            {asset} · {titleRound}
          </strong>
          <span>×{odds.toFixed(2)}</span>
        </div>
      </div>
      <div className={styles.ticketBody}>{renderTicketControls()}</div>
    </aside>
  );

  return (
    <div
      className={styles.page}
      style={
        {
          "--asset-accent": theme.accent,
          "--asset-accent-rgb": theme.accentRgb,
        } as CSSProperties
      }
    >
      <div className={styles.layout}>
        <div className={styles.board}>
      <header className={styles.topHead}>
        <div className={styles.titleRow}>
          <Image
            src={theme.logo}
            alt=""
            width={56}
            height={56}
            className={styles.titleIcon}
          />
          <div className={styles.titleText}>
            <div className={styles.titleLine}>
              <h1 className={styles.pageTitle}>{pageTitle}</h1>
              <div
                ref={rulesWrapRef}
                className={`${styles.rulesWrap} ${rulesOpen ? styles.rulesOpen : ""}`}
              >
                <button
                  type="button"
                  className={styles.rulesBtn}
                  aria-label={t("trading.rulesAria")}
                  aria-expanded={rulesOpen}
                  onClick={() => setRulesOpen((v) => !v)}
                >
                  <QuestionIcon
                    width="16"
                    height="16"
                    className={styles.rulesIcon}
                  />
                </button>
                <div className={styles.rulesTip} role="tooltip">
                  <p>{t("trading.rulesBody")}</p>
                  <p>{t("trading.rulesUp")}</p>
                  <p>{t("trading.rulesDown")}</p>
                  <p>{t("trading.rulesSource")}</p>
                </div>
              </div>
            </div>
            {roundWindowLabel ? (
              <p className={styles.titleDate}>{roundWindowLabel}</p>
            ) : null}
          </div>
          <Link href="/trading" className={styles.marketsBack}>
            {t("trading.backMarkets")}
          </Link>
        </div>

        <div className={styles.switchBar}>
          <div className={`${styles.filterGroup} ${styles.filterGroupAsset}`}>
            <span className={styles.filterLabel}>{t("trading.asset")}</span>
            <div className={styles.seg} role="group" aria-label={t("trading.asset")}>
              {SYMBOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    symbol === item.id ? styles.segOn : styles.segBtn
                  }
                  onClick={() => {
                    setSymbol(item.id);
                    replaceMarketUrl({ symbol: item.id, side: selected });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t("trading.timeframe")}</span>
            <div className={styles.seg} role="group" aria-label={t("trading.timeframeAria")}>
              {roundOptions.map((item) => (
                <button
                  key={item.ms}
                  type="button"
                  className={
                    roundMs === item.ms ? styles.segOn : styles.segBtn
                  }
                  onClick={() => {
                    setRoundMs(item.ms);
                    replaceMarketUrl({ roundMs: item.ms });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {isAuth && statsQuery.data ? (
            <div className={`${styles.dayStats} ${styles.dayStatsInSwitch}`}>
              <span className={styles.dayStatsLabel}>{t("trading.today")}</span>{" "}
              <b
                className={
                  statsQuery.data.pnl >= 0 ? styles.up : styles.down
                }
              >
                {statsQuery.data.pnl >= 0 ? "+" : ""}
                {formatMoneyAmount(statsQuery.data.pnl, cur)}
              </b>
              {statsQuery.data.winRate != null ? (
                <span className={styles.dayStatsExtra}>
                  · {statsQuery.data.bets} · {statsQuery.data.winRate}%
                </span>
              ) : statsQuery.data.bets > 0 ? (
                <span className={styles.dayStatsExtra}>
                  · {statsQuery.data.bets}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

        <div className={styles.chartCol}>
          <section className={styles.chartPanel}>
            <div className={styles.chartHero}>
              <div className={styles.heroMeta}>
                {isAuth && statsQuery.data ? (
                  <div className={`${styles.dayStats} ${styles.dayStatsInHero}`}>
                    <span className={styles.dayStatsLabel}>{t("trading.today")}</span>
                    <b
                      className={
                        statsQuery.data.pnl >= 0 ? styles.up : styles.down
                      }
                    >
                      {statsQuery.data.pnl >= 0 ? "+" : ""}
                      {formatMoneyAmount(statsQuery.data.pnl, cur)}
                    </b>
                  </div>
                ) : (
                  <span className={styles.heroMetaSpacer} aria-hidden />
                )}
                <div
                  className={styles.heroTimerWrap}
                  data-tip-open={timerTipOpen ? "1" : undefined}
                  onPointerEnter={() => setTimerTipOpen(true)}
                  onPointerLeave={() => setTimerTipOpen(false)}
                >
                  <div
                    className={`${styles.heroTimer} ${
                      urgent ? styles.heroTimerUrgent : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={t("trading.timerAria", {
                      mm: timer.mm,
                      ss: timer.ss,
                    })}
                    aria-expanded={timerTipOpen}
                    onClick={() => setTimerTipOpen((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setTimerTipOpen((v) => !v);
                      }
                    }}
                  >
                    <div className={styles.heroTimerUnit}>
                      <strong className={styles.heroTimerValue}>
                        <FlipDigits value={timer.mm} preferDir="down" />
                      </strong>
                      <span className={styles.heroTimerLabel}>{t("trading.min")}</span>
                    </div>
                    <div className={styles.heroTimerUnit}>
                      <strong className={styles.heroTimerValue}>
                        <FlipDigits value={timer.ss} preferDir="down" />
                      </strong>
                      <span className={styles.heroTimerLabel}>{t("trading.sec")}</span>
                    </div>
                  </div>
                  <div className={styles.heroTimerTip} role="tooltip">
                    <div className={styles.heroTimerTipHead}>
                      <span className={styles.heroTimerTipActive}>
                        <i className={styles.heroTimerTipDot} aria-hidden />
                        {t("trading.timerActive")}
                      </span>
                      <span className={styles.heroTimerTipLeft}>
                        {t("trading.timerMinLeft", { n: minsLeft })}
                      </span>
                    </div>
                    <span className={styles.heroTimerTipSub}>
                      {t("trading.timerOutcomeTime")}
                    </span>
                    <div className={styles.heroTimerTipRows}>
                      <div className={styles.heroTimerTipRow}>
                        <span className={styles.heroTimerTipZone}>ET</span>
                        <span className={styles.heroTimerTipDate}>{settleEt.date}</span>
                        <span className={styles.heroTimerTipClock}>{settleEt.time}</span>
                      </div>
                      <div className={styles.heroTimerTipRow}>
                        <span className={styles.heroTimerTipZone}>UTC</span>
                        <span className={styles.heroTimerTipDate}>{settleUtc.date}</span>
                        <span className={styles.heroTimerTipClock}>{settleUtc.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.heroPrices}>
                <div className={styles.heroBlock}>
                  <span>{t("trading.targetPrice")}</span>
                  <strong>
                    <AnimatedPrice value={heroOpenPrice} />
                  </strong>
                </div>
                <div className={`${styles.heroBlock} ${styles.heroLive}`}>
                  <div className={styles.heroLiveTop}>
                    <span>
                      {viewingPast
                        ? selectedSeriesRound?.result === "UP"
                          ? t("trading.seriesResultUp")
                          : t("trading.seriesResultDown")
                        : viewingUpcoming
                          ? t("trading.seriesUpcoming")
                          : chartScrub
                            ? chartScrubStamp
                            : t("trading.currentPrice")}
                    </span>
                    {changePctLive != null ? (
                      <AnimatedPct
                        value={changePctLive}
                        showArrow
                        className={
                          changePctLive >= 0
                            ? styles.heroDeltaUp
                            : styles.heroDeltaDown
                        }
                      />
                    ) : changeAbs != null ? (
                      <em
                        className={
                          changeAbs >= 0
                            ? styles.heroDeltaUp
                            : styles.heroDeltaDown
                        }
                      >
                        {changeAbs >= 0 ? "▲" : "▼"} $
                        {formatAssetPrice(Math.abs(changeAbs))}
                      </em>
                    ) : null}
                  </div>
                  <strong>
                    <AnimatedPrice value={displayLive} />
                  </strong>
                </div>
              </div>
            </div>

            <div className={styles.chartStage}>
              <div className={styles.chartViewBar} role="tablist">
                <div className={styles.seg} role="group">
                  <button
                    aria-selected={chartView === "live"}
                    className={
                      chartView === "live" ? styles.segOn : styles.segBtn
                    }
                    onClick={() => setChartView("live")}
                    type="button"
                  >
                    {t("trading.chartViewLive")}
                  </button>
                  <button
                    aria-selected={chartView === "pro"}
                    className={
                      chartView === "pro" ? styles.segOn : styles.segBtn
                    }
                    onClick={() => setChartView("pro")}
                    type="button"
                  >
                    {t("trading.chartViewPro")}
                  </button>
                </div>
              </div>
              {chartView === "pro" ? (
                <div className={styles.chartCanvas}>
                <BtcProChart
                  accentHex={theme.accent}
                  labels={{
                    live: t("trading.chartViewLive"),
                    pro: t("trading.chartViewPro"),
                    cursor: t("trading.chartToolCursor"),
                    hline: t("trading.chartToolHline"),
                    trend: t("trading.chartToolTrend"),
                    arrowUp: t("trading.chartToolArrowUp"),
                    arrowDown: t("trading.chartToolArrowDown"),
                    eraser: t("trading.chartToolEraser"),
                    clear: t("trading.chartToolClear"),
                    save: t("trading.chartToolSave"),
                    candles: t("trading.chartCandles"),
                    line: t("trading.chartLine"),
                    strike: t("trading.chartStrike"),
                  }}
                  livePrice={livePrice}
                  openPrice={openPrice}
                  roundMs={roundMs}
                  ticks={mergedTicks.length ? mergedTicks : (state?.ticks ?? [])}
                />
                </div>
              ) : (
              <div className={styles.chartCanvas}>
              <BtcChart
                key={`${symbol}-${roundMs}`}
                marketKey={`${symbol}:${roundMs}`}
                ticks={mergedTicks.length ? mergedTicks : (state?.ticks ?? [])}
                openPrice={openPrice}
                livePrice={livePrice}
                changePct={state?.changePct ?? null}
                startsAtMs={startsAtMs || Date.now()}
                endsAtMs={endsAtMs || Date.now() + roundMs}
                lockAtMs={lockAtMs || Date.now()}
                msToLock={msToLock}
                msToEnd={msToEnd}
                bettingOpen={bettingOpen}
                urgent={urgent}
                progress={progress}
                positions={chartPositions}
                mode={chartMode}
                accentHex={theme.accent}
                accentRgb={theme.accentRgb}
                logoSrc={theme.logo}
                waitingLabel={t("trading.chartWaiting")}
                startLabel={t("trading.chartStart")}
                onScrub={setChartScrub}
              />
              </div>
              )}
              {latestResult ? (
                <div
                  className={`${styles.chartSettle} ${
                    latestResult.status === "WIN"
                      ? styles.chartSettleWin
                      : styles.chartSettleLose
                  }`}
                  role="status"
                >
                  {latestResult.status === "WIN" ? "+" : "−"}
                  {Math.abs(
                    latestResult.status === "WIN"
                      ? latestResult.potentialPayout - latestResult.stake
                      : latestResult.stake,
                  ).toLocaleString(
                    latestResult.currencyCode.toUpperCase() === "USD" ||
                      latestResult.currencyCode.toUpperCase() === "USDT"
                      ? "en-US"
                      : "ru-RU",
                    {
                      maximumFractionDigits:
                        latestResult.currencyCode.toUpperCase() === "USD" ||
                        latestResult.currencyCode.toUpperCase() === "USDT"
                          ? 2
                          : 0,
                      minimumFractionDigits:
                        latestResult.currencyCode.toUpperCase() === "USD" ||
                        latestResult.currencyCode.toUpperCase() === "USDT"
                          ? 2
                          : 0,
                    },
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {isCompactLayout ? (
          <div className={styles.ticketInBoard}>
            <div className={styles.ticketBody}>{renderTicketControls()}</div>
            {pnlBlock}
          </div>
        ) : null}

        {recentRounds}
        </div>

        {!isCompactLayout ? (
          <div className={styles.side}>
            {ticketPanel}
            {pnlBlock}
          </div>
        ) : null}
      </div>
    </div>
  );
}
