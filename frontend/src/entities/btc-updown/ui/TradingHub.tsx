"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";
import { useLocale } from "~/shared/model/useLocale";

import { fetchBtcState } from "../api/client";
import {
  roundsForSymbol,
  TRADING_MARKETS,
  type TradingMarket,
} from "../lib/markets";
import { AnimatedPct } from "./AnimatedPct";
import { AnimatedPrice } from "./AnimatedPrice";
import { TradingPromoBanners } from "./TradingPromoBanners";
import { TradingPublicPnl } from "./TradingPublicPnl";
import { TradingSideRail } from "./TradingSideRail";

import styles from "./TradingHub.module.css";

const SPARK_W = 160;
const SPARK_H = 40;
const PAD_L = 2;
const PAD_R = 9;
const PAD_Y = 5;
/** Visible history window — ECG paper length. */
const LOOKBACK_MS = 16_000;
/** Keep ink past the left edge so the path exits smoothly (not a pop). */
const EXIT_KEEP_MS = 3_200;
/** How often tip freezes into ink (ms). */
const COMMIT_MS = 300;
const TIP_FOLLOW = 5.2;
/** Y: snap open when tip hits edge; barely shrink. */
const SCALE_EXPAND = 4.2;
const SCALE_SHRINK = 0.11;
const EDGE_FRAC = 0.14;

type InkPt = { t: number; p: number };

function emaSmooth(src: number[], alpha = 0.2): number[] {
  if (!src.length) return [];
  const out: number[] = [src[0]!];
  for (let i = 1; i < src.length; i++) {
    out.push(out[i - 1]! * (1 - alpha) + src[i]! * alpha);
  }
  return out;
}

/** Seed frozen ink from API ticks — prices never rewritten after this. */
function seedInk(ticks: number[], now: number): InkPt[] {
  if (!ticks.length) return [];
  const src = ticks.length > 200 ? ticks.slice(-200) : ticks;
  const n = Math.min(48, Math.max(12, src.length));
  const step = (src.length - 1) / (n - 1);
  const picked: number[] = [];
  for (let i = 0; i < n; i++) {
    picked.push(src[Math.round(i * step)]!);
  }
  const smoothed = emaSmooth(emaSmooth(picked, 0.26), 0.2);
  return smoothed.map((p, i) => ({
    t: now - LOOKBACK_MS + (i / (smoothed.length - 1)) * LOOKBACK_MS,
    p,
  }));
}

/** Soft Catmull-Rom — only for frozen ink (tip is a separate wet segment). */
function toCurve(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return "";
  let d = `M${xs[0]!.toFixed(2)} ${ys[0]!.toFixed(2)}`;
  const ten = 7.5;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[Math.max(0, i - 1)]!;
    const y0 = ys[Math.max(0, i - 1)]!;
    const x1 = xs[i]!;
    const y1 = ys[i]!;
    const x2 = xs[i + 1]!;
    const y2 = ys[i + 1]!;
    const x3 = xs[Math.min(n - 1, i + 2)]!;
    const y3 = ys[Math.min(n - 1, i + 2)]!;
    d += ` C${(x1 + (x2 - x0) / ten).toFixed(2)} ${(y1 + (y2 - y0) / ten).toFixed(2)} ${(x2 - (x3 - x1) / ten).toFixed(2)} ${(y2 - (y3 - y1) / ten).toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

function TrendSpark({
  livePrice,
  seedTicks,
  onDelta,
}: {
  livePrice: number | null;
  seedTicks: number[];
  onDelta: (d: number, up: boolean) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const inkRef = useRef<InkPt[]>([]);
  const tipRef = useRef(0);
  const targetRef = useRef(0);
  const scaleRef = useRef({ lo: 0, hi: 1, ready: false });
  const lastCommitRef = useRef(0);
  const seededRef = useRef(false);
  const onDeltaRef = useRef(onDelta);
  onDeltaRef.current = onDelta;

  const lineRef = useRef<SVGPathElement | null>(null);
  const fillRef = useRef<SVGPathElement | null>(null);
  const tipElRef = useRef<HTMLSpanElement | null>(null);
  const gradStop0 = useRef<SVGStopElement | null>(null);
  const gradStop1 = useRef<SVGStopElement | null>(null);
  const gradStop2 = useRef<SVGStopElement | null>(null);
  const colorRef = useRef("#0acf97");
  const [ready, setReady] = useState(false);

  const fitScale = (pts: number[], tip: number) => {
    let min = tip;
    let max = tip;
    for (const p of pts) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    const span = Math.max(max - min, Math.abs(tip) * 0.00004, 0.15);
    const pad = span * 0.18;
    return { lo: min - pad, hi: max + pad };
  };

  useEffect(() => {
    if (seededRef.current || seedTicks.length < 4) return;
    const now = Date.now();
    const ink = seedInk(seedTicks, now);
    inkRef.current = ink;
    tipRef.current = ink[ink.length - 1]!.p;
    targetRef.current = tipRef.current;
    lastCommitRef.current = now;
    scaleRef.current = {
      ...fitScale(
        ink.map((p) => p.p),
        tipRef.current,
      ),
      ready: true,
    };
    seededRef.current = true;
    setReady(true);
  }, [seedTicks]);

  useEffect(() => {
    if (livePrice == null || !Number.isFinite(livePrice)) return;
    targetRef.current = livePrice;
    if (!seededRef.current) {
      const now = Date.now();
      inkRef.current = [
        { t: now - LOOKBACK_MS, p: livePrice },
        { t: now, p: livePrice },
      ];
      tipRef.current = livePrice;
      lastCommitRef.current = now;
      const bump = Math.max(livePrice * 0.00005, 0.35);
      scaleRef.current = {
        lo: livePrice - bump,
        hi: livePrice + bump,
        ready: true,
      };
      seededRef.current = true;
      setReady(true);
    }
  }, [livePrice]);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let last = performance.now();
    let lastDeltaEmit = 0;

    const loop = (frameNow: number) => {
      const dt = Math.min(0.048, (frameNow - last) / 1000);
      last = frameNow;
      const now = Date.now();

      if (scaleRef.current.ready && inkRef.current.length >= 1) {
        tipRef.current +=
          (targetRef.current - tipRef.current) *
          (1 - Math.exp(-dt * TIP_FOLLOW));

        /* Commit tip into frozen ink — never rewrite past points. */
        if (now - lastCommitRef.current >= COMMIT_MS) {
          const ink = inkRef.current;
          const lastPt = ink[ink.length - 1]!;
          if (
            Math.abs(tipRef.current - lastPt.p) > 1e-9 ||
            now - lastPt.t >= COMMIT_MS
          ) {
            ink.push({ t: now, p: tipRef.current });
          }
          lastCommitRef.current = now;
        }

        const viewStart = now - LOOKBACK_MS;
        /* Drop only after the segment has fully scrolled past the fade zone. */
        const ink = inkRef.current;
        let drop = 0;
        while (
          drop < ink.length - 2 &&
          ink[drop]!.t < viewStart - EXIT_KEEP_MS
        ) {
          drop++;
        }
        if (drop > 0) inkRef.current = ink.slice(drop);

        /* Include off-left points so the curve keeps sliding out of frame. */
        const frozen = inkRef.current;
        const tipP = tipRef.current;

        /* Sticky Y: expand fast at edges, almost no shrink (shape stays put). */
        const s = scaleRef.current;
        let inkMin = tipP;
        let inkMax = tipP;
        for (const pt of frozen) {
          if (pt.p < inkMin) inkMin = pt.p;
          if (pt.p > inkMax) inkMax = pt.p;
        }
        const span = Math.max(s.hi - s.lo, 1e-9);
        const edge = span * EDGE_FRAC;
        let wantLo = s.lo;
        let wantHi = s.hi;
        if (tipP < s.lo + edge || inkMin < s.lo + edge) {
          wantLo = Math.min(s.lo, inkMin, tipP) - span * 0.08;
        }
        if (tipP > s.hi - edge || inkMax > s.hi - edge) {
          wantHi = Math.max(s.hi, inkMax, tipP) + span * 0.08;
        }
        const fitPad = Math.max((inkMax - inkMin) * 0.2, Math.abs(tipP) * 1e-7, 0.08);
        const softLo = inkMin - fitPad;
        const softHi = inkMax + fitPad;
        const expand =
          wantLo < s.lo - 1e-12 || wantHi > s.hi + 1e-12;
        const rate = expand ? SCALE_EXPAND : SCALE_SHRINK;
        const k = 1 - Math.exp(-dt * rate);
        if (expand) {
          s.lo += (wantLo - s.lo) * k;
          s.hi += (wantHi - s.hi) * k;
        } else {
          s.lo += (softLo - s.lo) * k;
          s.hi += (softHi - s.hi) * k;
        }
        if (s.hi - s.lo < 1e-9) s.hi = s.lo + 1e-6;

        const third = Math.max(3, Math.floor(frozen.length / 3));
        let headSum = 0;
        let tailSum = 0;
        if (frozen.length >= 2) {
          for (let i = 0; i < Math.min(third, frozen.length); i++) {
            headSum += frozen[i]!.p;
          }
          const t0 = Math.max(0, frozen.length - third);
          for (let i = t0; i < frozen.length; i++) tailSum += frozen[i]!.p;
          tailSum += tipP;
          const headN = Math.min(third, frozen.length);
          const tailN = frozen.length - t0 + 1;
          const head = headSum / headN;
          const tail = tailSum / tailN;
          const deltaPct = head !== 0 ? ((tail - head) / head) * 100 : 0;
          const up = tail >= head;
          const stroke = up ? "#0acf97" : "#ef473a";

          if (now - lastDeltaEmit > 220) {
            lastDeltaEmit = now;
            onDeltaRef.current(deltaPct, up);
          }

          if (stroke !== colorRef.current) {
            colorRef.current = stroke;
            gradStop0.current?.setAttribute("stop-color", stroke);
            gradStop1.current?.setAttribute("stop-color", stroke);
            gradStop2.current?.setAttribute("stop-color", stroke);
            tipElRef.current?.style.setProperty("--tip", stroke);
            lineRef.current?.setAttribute("stroke", stroke);
          }
        }

        const ySpan = s.hi - s.lo;
        const xSpan = SPARK_W - PAD_L - PAD_R;
        const yPlot = SPARK_H - PAD_Y * 2;
        const xAt = (t: number) =>
          PAD_L + ((t - viewStart) / LOOKBACK_MS) * xSpan;
        const yAt = (p: number) =>
          PAD_Y + (1 - (p - s.lo) / ySpan) * yPlot;

        /* Frozen ink path — tip is NOT a neighbor (won't reshape history). */
        const xs: number[] = [];
        const ys: number[] = [];
        for (const pt of frozen) {
          xs.push(xAt(pt.t));
          ys.push(yAt(pt.p));
        }
        let line =
          xs.length >= 2
            ? toCurve(xs, ys)
            : xs.length === 1
              ? `M${xs[0]!.toFixed(2)} ${ys[0]!.toFixed(2)}`
              : "";

        const tipX = xAt(now);
        const tipY = yAt(tipP);
        if (xs.length >= 1) {
          const lx = xs[xs.length - 1]!;
          const ly = ys[ys.length - 1]!;
          const mx = (lx + tipX) / 2;
          line += ` C${mx.toFixed(2)} ${ly.toFixed(2)} ${mx.toFixed(2)} ${tipY.toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)}`;
        } else {
          line = `M${tipX.toFixed(2)} ${tipY.toFixed(2)}`;
        }

        const fill = `${line} L${tipX.toFixed(2)} ${(SPARK_H - 1).toFixed(2)} L${(xs[0] ?? tipX).toFixed(2)} ${(SPARK_H - 1).toFixed(2)} Z`;

        lineRef.current?.setAttribute("d", line);
        fillRef.current?.setAttribute("d", fill);
        if (tipElRef.current) {
          tipElRef.current.style.left = `${(tipX / SPARK_W) * 100}%`;
          tipElRef.current.style.top = `${(tipY / SPARK_H) * 100}%`;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  if (!ready) return <div className={styles.sparkEmpty} aria-hidden />;

  return (
    <div className={styles.sparkFrame} aria-hidden>
      <svg
        className={styles.spark}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              ref={gradStop0}
              offset="0%"
              stopColor={colorRef.current}
              stopOpacity="0.26"
            />
            <stop
              ref={gradStop1}
              offset="55%"
              stopColor={colorRef.current}
              stopOpacity="0.07"
            />
            <stop
              ref={gradStop2}
              offset="100%"
              stopColor={colorRef.current}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path ref={fillRef} d="" fill={`url(#fill-${uid})`} />
        <path
          ref={lineRef}
          d=""
          fill="none"
          stroke={colorRef.current}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        ref={tipElRef}
        className={styles.sparkTip}
        style={{ "--tip": colorRef.current } as CSSProperties}
      >
        <span className={styles.sparkTipPulse} />
        <span className={styles.sparkTipCore} />
      </span>
    </div>
  );
}

function TrendPct({
  delta,
  up,
  roundPct,
}: {
  delta: number | null;
  up: boolean;
  roundPct: number | null;
}) {
  const raw =
    delta != null && Number.isFinite(delta) ? delta : roundPct;
  if (raw == null || !Number.isFinite(raw)) {
    return <span className={styles.pctMuted}>—</span>;
  }

  const isUp = delta != null ? up : raw >= 0;
  const signed = isUp ? Math.abs(raw) : -Math.abs(raw);

  return (
    <AnimatedPct
      value={signed}
      showArrow
      className={isUp ? styles.pctUp : styles.pctDown}
      arrowClassName={`${styles.pctArrow} ${
        isUp ? styles.pctArrowInUp : styles.pctArrowInDown
      }`}
    />
  );
}

function roundChipLabel(ms: number, t: (key: string) => string): string {
  if (ms <= 60_000) return t("trading.round1m");
  if (ms <= 300_000) return t("trading.round5m");
  return t("trading.round15m");
}

function MarketCard({ market }: { market: TradingMarket }) {
  const { t } = useLocale();
  const router = useRouter();
  const stateQuery = useQuery({
    queryKey: ["btc-updown-hub", market.symbol],
    queryFn: () => fetchBtcState(market.symbol, 300_000),
    refetchInterval: 1_500,
    staleTime: 800,
  });

  const state = stateQuery.data;
  const price = state?.price ?? null;
  const changePct = state?.changePct ?? null;
  const rounds = roundsForSymbol(market.symbol);
  const defaultRound = rounds.includes(300_000)
    ? 300_000
    : (rounds[0] ?? 300_000);
  const seedTicks = useMemo(
    () => (state?.ticks ?? []).map((tick) => tick.p),
    [state?.ticks],
  );

  const [trend, setTrend] = useState<{ delta: number; up: boolean } | null>(
    null,
  );

  const hrefBase = `/trading/${market.slug}?round=${defaultRound}`;

  return (
    <div
      className={styles.row}
      style={
        {
          "--card-accent": market.theme.accent,
          "--card-rgb": market.theme.accentRgb,
        } as CSSProperties
      }
    >
      <Link href={hrefBase} className={styles.rowMain}>
        <div className={styles.asset}>
          <Image
            src={market.theme.logo}
            alt=""
            width={44}
            height={44}
            className={styles.logo}
          />
          <div className={styles.assetText}>
            <div className={styles.assetTitle}>
              <span className={styles.short}>{market.short}</span>
              <span className={styles.name}>{market.name}</span>
            </div>
            <div className={styles.chips}>
              {rounds.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  className={styles.chip}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/trading/${market.slug}?round=${ms}`);
                  }}
                >
                  {roundChipLabel(ms, t)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.quote}>
          <AnimatedPrice value={price} className={styles.price} />
          <TrendPct
            delta={trend?.delta ?? null}
            up={trend?.up ?? true}
            roundPct={changePct}
          />
        </div>

        <div className={styles.sparkCol}>
          <TrendSpark
            livePrice={price}
            seedTicks={seedTicks}
            onDelta={(delta, up) => setTrend({ delta, up })}
          />
        </div>
      </Link>
    </div>
  );
}

export function TradingHub() {
  const { t } = useLocale();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className={styles.hub}>
      <TradingPromoBanners />

      <div className={styles.list}>
        <div className={styles.listHead} aria-hidden>
          <div className={styles.listHeadMain}>
            <span>{t("trading.hubColAsset")}</span>
            <span>{t("trading.hubColPrice")}</span>
            <span>{t("trading.hubColChart")}</span>
          </div>
        </div>
        {TRADING_MARKETS.map((market) => (
          <MarketCard key={market.slug} market={market} />
        ))}
      </div>

      {!isDesktop ? (
        <>
          <TradingSideRail variant="stack" />
          <TradingPublicPnl compact />
        </>
      ) : null}
    </div>
  );
}
