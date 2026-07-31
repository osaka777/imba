"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { BtcTick } from "../api/client";
import { formatAssetPrice, priceFractionDigits } from "../lib/markets";
import styles from "./BtcChart.module.css";

export type ChartPosition = {
  id: number;
  side: "UP" | "DOWN";
  stake: number;
  entryPrice: number;
  placedAtMs: number;
  winning: boolean | null;
  currency?: string;
};

export type BtcChartMode = "calm" | "detail" | "price";

type Props = {
  ticks: BtcTick[];
  openPrice: number | null;
  livePrice: number | null;
  changePct: number | null;
  startsAtMs: number;
  endsAtMs: number;
  lockAtMs: number;
  msToLock: number;
  msToEnd: number;
  bettingOpen: boolean;
  urgent?: boolean;
  progress?: number;
  roundStartLabel?: string;
  roundEndLabel?: string;
  /** Active bets — each locks its own entry line (FuelTech style). */
  positions?: ChartPosition[];
  mode?: BtcChartMode;
  /** BTCUSDT:300000 — hard-reset smooth/Y when market switches. */
  marketKey?: string;
  /** Brand snake / LIVE accent (BTC orange, ETH blue, SOL purple). */
  accentHex?: string;
  accentRgb?: string;
  waitingLabel?: string;
  startLabel?: string;
  /** Asset logo for Polymarket-style scrub tip. */
  logoSrc?: string;
  /** PnL-style hover scrub — emits sample under cursor, null on leave. */
  onScrub?: (sample: { t: number; p: number } | null) => void;
};

type Pt = { x: number; y: number };

/** Massive Cryptocurrency Widgets dark chart palette. */
const MCW = {
  bg: "transparent",
  axis: "#2a3550",
  axisMuted: "rgba(42,53,80,0.55)",
  hist: "rgba(108,130,145,0.55)",
  upRgb: "10,207,151",
  downRgb: "239,71,58",
  upHex: "#0acf97",
  downHex: "#ef473a",
  /** Chart.js-like lineTension */
  tension: 0.12,
} as const;

/**
 * Soft Catmull-Rom — light Y clamp (10% slack) so climbs/drops curve
 * instead of snake-style stairs, without wild overshoot.
 */
function buildSmoothPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1]!.x, pts[1]!.y);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;
    const yLo = Math.min(p1.y, p2.y);
    const yHi = Math.max(p1.y, p2.y);
    const slack = Math.max(4, (yHi - yLo) * 0.12 + 2);
    cp1y = Math.min(yHi + slack, Math.max(yLo - slack, cp1y));
    cp2y = Math.min(yHi + slack, Math.max(yLo - slack, cp2y));
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

function strokeSmooth(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  buildSmoothPath(ctx, pts);
  ctx.stroke();
}

/** Dense eased samples — kills stair-steps between sparse prints. */
function densifyLinear(ticks: BtcTick[], maxGapMs = 90): BtcTick[] {
  if (ticks.length < 2) return ticks;
  const out: BtcTick[] = [ticks[0]!];
  for (let i = 1; i < ticks.length; i++) {
    const a = ticks[i - 1]!;
    const b = ticks[i]!;
    const gap = Math.max(1, b.t - a.t);
    if (gap > 40 || a.p !== b.p) {
      const n = Math.min(24, Math.max(2, Math.ceil(gap / maxGapMs)));
      for (let k = 1; k <= n; k++) {
        const u = k / (n + 1);
        const s = u * u * (3 - 2 * u);
        out.push({ t: a.t + gap * u, p: a.p + (b.p - a.p) * s });
      }
    }
    out.push(b);
  }
  return out;
}

/** Display-only EMA — softer rises/falls, settlement still uses live feed. */
function emaTicks(ticks: BtcTick[], tauMs = 560): BtcTick[] {
  if (ticks.length < 2) return ticks;
  const out: BtcTick[] = [{ t: ticks[0]!.t, p: ticks[0]!.p }];
  let ema = ticks[0]!.p;
  for (let i = 1; i < ticks.length; i++) {
    const prev = ticks[i - 1]!;
    const t = ticks[i]!;
    const dt = Math.max(1, t.t - prev.t);
    const alpha = 1 - Math.exp(-dt / tauMs);
    ema = ema + (t.p - ema) * alpha;
    out.push({ t: t.t, p: ema });
  }
  return out;
}

/** Second pass to kill residual ridges without inventing new wiggles. */
function refineTicks(ticks: BtcTick[]): BtcTick[] {
  if (ticks.length < 3) return ticks;
  const out = ticks.map((t) => ({ ...t }));
  for (let i = 1; i < out.length - 1; i++) {
    out[i]!.p = out[i - 1]!.p * 0.25 + out[i]!.p * 0.5 + out[i + 1]!.p * 0.25;
  }
  return out;
}

function downsample(ticks: BtcTick[], maxPts: number): BtcTick[] {
  if (ticks.length <= maxPts) return ticks;
  const out: BtcTick[] = [];
  const step = (ticks.length - 1) / (maxPts - 1);
  for (let i = 0; i < maxPts; i++) {
    out.push(ticks[Math.round(i * step)]!);
  }
  return out;
}

function formatScrubStamp(t: number) {
  return new Date(t).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatScrubPrice(n: number) {
  return `$${formatAssetPrice(n)}`;
}

/** Linear sample along the drawn path for hover scrub. */
function interpolateTick(ticks: BtcTick[], t: number): BtcTick | null {
  if (!ticks.length) return null;
  if (t <= ticks[0]!.t) return ticks[0]!;
  const last = ticks[ticks.length - 1]!;
  if (t >= last.t) return last;
  let lo = 0;
  let hi = ticks.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ticks[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = ticks[lo]!;
  const b = ticks[hi]!;
  const f = (t - a.t) / Math.max(1, b.t - a.t);
  return { t, p: a.p + (b.p - a.p) * f };
}

function formatUsd(n: number) {
  return formatAssetPrice(n);
}

/** Compact in-plot axis labels (reference style). */
function formatAxisPrice(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return formatAssetPrice(n);
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type TipRect = { x: number; y: number; w: number; h: number };

function tipOverlaps(a: TipRect, b: TipRect, pad = 8) {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

/** Place scrub tip so it jumps around stake badges instead of covering them. */
function placeScrubTip(
  sx: number,
  sy: number,
  cssW: number,
  cssH: number,
  tipW: number,
  tipH: number,
  obstacles: TipRect[],
): { x: number; y: number } {
  const clamp = (x: number, y: number) => ({
    x: Math.max(4, Math.min(x, cssW - tipW - 4)),
    y: Math.max(4, Math.min(y, cssH - tipH - 4)),
  });

  const candidates: { x: number; y: number }[] = [
    clamp(sx - tipW / 2, sy - tipH - 14), // above
    clamp(sx - tipW / 2, sy + 16), // below
    clamp(sx - tipW - 18, sy - tipH / 2), // left
    clamp(sx + 18, sy - tipH / 2), // right
    clamp(sx - tipW / 2, sy - tipH - 48), // higher above
    clamp(sx - tipW - 18, sy - tipH - 14), // up-left
    clamp(sx + 18, sy - tipH - 14), // up-right
    clamp(sx - tipW - 18, sy + 16), // down-left
    clamp(sx + 18, sy + 16), // down-right
  ];

  for (const c of candidates) {
    const box: TipRect = { x: c.x, y: c.y, w: tipW, h: tipH };
    if (!obstacles.some((o) => tipOverlaps(box, o))) return c;
  }
  return candidates[0]!;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function expSmooth(current: number, target: number, dt: number, tau: number) {
  const alpha = 1 - Math.exp(-dt / Math.max(1, tau));
  return current + (target - current) * alpha;
}

function mixColor(
  up: boolean,
  mix: number,
  flash: number,
  dir: number,
): { main: string; deep: string; glow: string } {
  const upMain = [14, 203, 129] as const;
  const downMain = [246, 70, 93] as const;
  const t = up ? mix : 1 - mix;
  let r = lerp(downMain[0], upMain[0], t);
  let g = lerp(downMain[1], upMain[1], t);
  let b = lerp(downMain[2], upMain[2], t);
  const boost = 1 + flash * 0.55;
  r = Math.min(255, r * boost);
  g = Math.min(255, g * boost);
  b = Math.min(255, b * boost);
  const main = `rgb(${r | 0},${g | 0},${b | 0})`;
  const deep = up
    ? `rgb(${lerp(200, 10, 1 - mix) | 0},${lerp(57, 168, mix) | 0},${lerp(64, 104, mix) | 0})`
    : `rgb(${lerp(200, 246, 1 - mix) | 0},${lerp(57, 70, mix) | 0},${lerp(64, 93, mix) | 0})`;
  const glow = dir >= 0
    ? `rgba(14,203,129,${0.15 + flash * 0.45})`
    : `rgba(246,70,93,${0.15 + flash * 0.45})`;
  return { main, deep, glow };
}

type Ripple = { born: number; dir: 1 | -1; x: number; y: number };
type TrailPt = { x: number; y: number; born: number; dir: 1 | -1 };

/**
 * Markets / Polymarket lightning — bright spark that travels along the line
 * (same idea as ChanceChart streakSweep + liveline renderSpark).
 */
function strokeTravelingSpark(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  progress: number,
  rgb: string,
  lineWidth: number,
) {
  if (pts.length < 2 || progress <= 0 || progress >= 1) return;
  const firstX = pts[0]!.x;
  const lastX = pts[pts.length - 1]!.x;
  const span = lastX - firstX;
  if (span < 12) return;

  const SPARK_WIDTH = 0.11;
  const t = -SPARK_WIDTH + progress * (1 + SPARK_WIDTH * 2);
  const sparkCenter = firstX + t * span;
  const halfW = SPARK_WIDTH * span * 0.5;
  const edgeFade = Math.min(1, progress * 5, (1 - progress) * 5);
  if (edgeFade < 0.04) return;
  const alpha = 0.82 * edgeFade;

  const grad = ctx.createLinearGradient(
    sparkCenter - halfW * 1.5,
    0,
    sparkCenter + halfW * 1.5,
    0,
  );
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.28, `rgba(255,255,255,${alpha * 0.55})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.62, `rgba(${rgb},${alpha * 0.9})`);
  grad.addColorStop(0.78, `rgba(255,255,255,${alpha * 0.45})`);
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  buildSmoothPath(ctx, pts);
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth + 1.8;
  ctx.stroke();
  // Tighter white core of the bolt
  const core = ctx.createLinearGradient(
    sparkCenter - halfW * 0.7,
    0,
    sparkCenter + halfW * 0.7,
    0,
  );
  core.addColorStop(0, "rgba(255,255,255,0)");
  core.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.95})`);
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  buildSmoothPath(ctx, pts);
  ctx.strokeStyle = core;
  ctx.lineWidth = Math.max(1.2, lineWidth * 0.55);
  ctx.stroke();
  ctx.restore();
}

type GhostPos = ChartPosition & { goneAt: number };

function formatStakeLabel(stake: number, currency?: string) {
  const c = (currency ?? "USD").toUpperCase();
  if (c === "USD" || c === "USDT") {
    if (stake >= 1000)
      return `${(stake / 1000).toFixed(stake % 1000 ? 1 : 0)}k`;
    return `${Math.round(stake * 100) / 100}`;
  }
  if (stake >= 1000) return `${Math.round(stake / 1000)}k`;
  return `${Math.round(stake)}`;
}

export function BtcChart({
  ticks,
  openPrice,
  livePrice,
  changePct,
  startsAtMs,
  endsAtMs,
  lockAtMs,
  msToLock,
  msToEnd,
  bettingOpen,
  urgent = false,
  progress = 0,
  roundStartLabel,
  roundEndLabel,
  positions = [],
  mode = "calm",
  marketKey = "BTCUSDT:300000",
  accentHex = "#F7931A",
  accentRgb = "247, 147, 26",
  waitingLabel = "Waiting for market…",
  startLabel = "Start",
  logoSrc = "/images/btc-logo.png",
  onScrub,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Snake drawn here so left/top fade does not erase grid. */
  const lineLayerRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef(0);
  const smoothPriceRef = useRef<number | null>(livePrice);
  const smoothVelRef = useRef(0);
  const smoothTimeRef = useRef(Date.now());
  const boundsRef = useRef({ half: 0, ready: false });
  const centerRef = useRef<number | null>(null);
  /** Soft auto-Y — follows live/strike/entries without hard freeze. */
  const narrowRef = useRef(false);
  const manualRangeScaleRef = useRef(1);
  const accentMixRef = useRef(0.5);
  const flashRef = useRef(0);
  const tipKickPxRef = useRef(0);
  const punchScaleRef = useRef(1);
  const crossFlashRef = useRef(0);
  const lastWinningRef = useRef<boolean | null>(null);
  const tickDirRef = useRef<1 | -1 | 0>(0);
  const lastLiveSampleRef = useRef<number | null>(livePrice);
  const velSamplesRef = useRef<{ t: number; p: number }[]>([]);
  const lastImpulseAtRef = useRef(0);
  const lastStrikeSideRef = useRef<1 | -1 | 0>(0);
  const ripplesRef = useRef<Ripple[]>([]);
  const trailRef = useRef<TrailPt[]>([]);
  const pendingRippleDirRef = useRef<1 | -1 | 0>(0);
  const livePositionsRef = useRef<Map<number, ChartPosition>>(new Map());
  const ghostPositionsRef = useRef<Map<number, GhostPos>>(new Map());
  const moodRef = useRef<"up" | "down" | "tick-up" | "tick-down">("up");
  /** Cardiogram ink — committed (t,p) never rewritten; only tip is wet. */
  const inkRef = useRef<BtcTick[]>([]);
  const inkEmaRef = useRef<number | null>(null);
  const inkSeededRef = useRef(false);
  /** 0–1 along plot width while scrubbing; null when idle. */
  const scrubFracRef = useRef<number | null>(null);
  const scrubLayoutRef = useRef({
    padL: 0,
    padR: 0,
    cssW: 1,
  });
  const onScrubRef = useRef(onScrub);
  const lastScrubKeyRef = useRef("");
  const scrubTipRef = useRef<HTMLDivElement | null>(null);
  const scrubPriceRef = useRef<HTMLSpanElement | null>(null);
  const scrubTimeRef = useRef<HTMLSpanElement | null>(null);
  const [pricePulse, setPricePulse] = useState<"up" | "down" | null>(null);
  const [zoomLabel, setZoomLabel] = useState(100);

  onScrubRef.current = onScrub;

  const resetMotion = (price: number | null) => {
    boundsRef.current = { half: 0, ready: false };
    centerRef.current = null;
    narrowRef.current = false;
    trailRef.current = [];
    ripplesRef.current = [];
    livePositionsRef.current = new Map();
    ghostPositionsRef.current = new Map();
    flashRef.current = 0;
    tipKickPxRef.current = 0;
    punchScaleRef.current = 1;
    smoothVelRef.current = 0;
    pendingRippleDirRef.current = 0;
    tickDirRef.current = 0;
    lastWinningRef.current = null;
    crossFlashRef.current = 0;
    lastStrikeSideRef.current = 0;
    lastImpulseAtRef.current = 0;
    velSamplesRef.current = [];
    smoothPriceRef.current = price;
    lastLiveSampleRef.current = price;
    manualRangeScaleRef.current = 1;
    inkRef.current = [];
    inkEmaRef.current = null;
    inkSeededRef.current = false;
    scrubFracRef.current = null;
    lastScrubKeyRef.current = "";
    onScrubRef.current?.(null);
    if (scrubTipRef.current) delete scrubTipRef.current.dataset.on;
    setZoomLabel(100);
  };

  const latestRef = useRef({
    ticks,
    openPrice,
    livePrice,
    changePct,
    startsAtMs,
    endsAtMs,
    lockAtMs,
    msToLock,
    msToEnd,
    bettingOpen,
    positions,
    accentHex,
    accentRgb,
    waitingLabel,
    startLabel,
  });
  latestRef.current = {
    ticks,
    openPrice,
    livePrice,
    changePct,
    startsAtMs,
    endsAtMs,
    lockAtMs,
    msToLock,
    msToEnd,
    bettingOpen,
    positions,
    accentHex,
    accentRgb,
    waitingLabel,
    startLabel,
  };

  useEffect(() => {
    resetMotion(livePrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on market switch
  }, [marketKey]);

  // If live jumps across assets before remount settles, snap tip (no BTC→ETH glide).
  useEffect(() => {
    if (livePrice == null) return;
    const prev = smoothPriceRef.current;
    if (prev == null) {
      smoothPriceRef.current = livePrice;
      lastLiveSampleRef.current = livePrice;
      return;
    }
    const rel = Math.abs(livePrice - prev) / Math.max(Math.abs(livePrice), 1e-9);
    if (rel > 0.08) {
      smoothPriceRef.current = livePrice;
      lastLiveSampleRef.current = livePrice;
      smoothVelRef.current = 0;
      // Keep Y bounds — remapping mid-round causes vertical thrash.
    }
  }, [livePrice, marketKey]);

  const upNow = useMemo(() => {
    if (openPrice == null || livePrice == null) return true;
    return livePrice >= openPrice;
  }, [openPrice, livePrice]);

  useEffect(() => {
    if (livePrice != null && smoothPriceRef.current == null) {
      smoothPriceRef.current = livePrice;
      lastLiveSampleRef.current = livePrice;
    }
  }, [livePrice]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const publishZoom = () =>
      setZoomLabel(Math.round((1 / manualRangeScaleRef.current) * 100));

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 0.86 : 1.16;
      manualRangeScaleRef.current = Math.min(
        3.5,
        Math.max(0.4, manualRangeScaleRef.current * factor),
      );
      publishZoom();
    };

    const onDoubleClick = () => {
      manualRangeScaleRef.current = 1;
      publishZoom();
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("dblclick", onDoubleClick);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("dblclick", onDoubleClick);
    };
  }, []);

  const prevHudPriceRef = useRef<number | null>(livePrice);
  useEffect(() => {
    if (livePrice == null || prevHudPriceRef.current == null) {
      prevHudPriceRef.current = livePrice;
      return;
    }
    if (livePrice === prevHudPriceRef.current) return;
    const dir = livePrice > prevHudPriceRef.current ? "up" : "down";
    prevHudPriceRef.current = livePrice;
    setPricePulse(dir);
    const id = window.setTimeout(() => setPricePulse(null), 700);
    return () => window.clearTimeout(id);
  }, [livePrice]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const {
        ticks: rawTicks,
        openPrice: open,
        livePrice: live,
        startsAtMs: t0,
        endsAtMs: t1,
        lockAtMs: _lockT,
        msToLock: _toLock,
        msToEnd: _toEnd,
        bettingOpen: betsOpen,
        positions: posList,
        accentHex: brandHex,
        accentRgb: brandRgb,
        waitingLabel: waitLbl,
        startLabel: startLbl,
      } = latestRef.current;

      const now = Date.now();
      const dt = Math.min(32, now - smoothTimeRef.current);
      smoothTimeRef.current = now;

      if (live != null) {
        const prev = smoothPriceRef.current ?? live;
        // Softer glide — continuous rise/fall, not tick-to-tick snaps.
        smoothPriceRef.current = expSmooth(prev, live, dt, 480);
        lastLiveSampleRef.current = live;

        /* Impulse detector — sharp move over ~400ms. */
        const samples = velSamplesRef.current;
        samples.push({ t: now, p: live });
        while (samples.length && now - samples[0]!.t > 520) samples.shift();
        if (samples.length >= 2 && now - lastImpulseAtRef.current > 900) {
          const oldest = samples[0]!;
          const dp = live - oldest.p;
          const thresh = Math.max(Math.abs(live) * 0.00007, 3.5);
          if (Math.abs(dp) >= thresh) {
            const dir: 1 | -1 = dp > 0 ? 1 : -1;
            lastImpulseAtRef.current = now;
            punchScaleRef.current = 0.86;
            tipKickPxRef.current = dir > 0 ? -10 : 10;
            flashRef.current = 1;
            tickDirRef.current = dir;
            pendingRippleDirRef.current = dir;
          }
        }
      }

      /* 1) Impulse punch decay */
      punchScaleRef.current = expSmooth(punchScaleRef.current, 1, dt, 320);
      tipKickPxRef.current = expSmooth(tipKickPxRef.current, 0, dt, 200);
      flashRef.current = Math.max(0, flashRef.current - dt / 420);
      crossFlashRef.current = Math.max(0, crossFlashRef.current - dt / 580);

      const smoothLive = smoothPriceRef.current ?? live;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Stage height is fixed in CSS — always match DOM. Freezing an older
      // bitmap while CSS stretched to 100% caused vertical squash/bounce.
      const cssW = Math.max(1, wrap.clientWidth || 640);
      const cssH = Math.max(1, wrap.clientHeight || 360);
      const bufW = Math.floor(cssW * dpr);
      const bufH = Math.floor(cssH * dpr);
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW;
        canvas.height = bufH;
      }
      if (canvas.style.width !== `${cssW}px`) canvas.style.width = `${cssW}px`;
      if (canvas.style.height !== `${cssH}px`) canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // React hosts Polymarket-style HUD; canvas keeps plot room.
      // Hysteresis on narrow — flipping pad at 640 remapped every Y.
      if (!narrowRef.current && cssW < 620) narrowRef.current = true;
      else if (narrowRef.current && cssW > 660) narrowRef.current = false;
      const narrow = narrowRef.current;
      // Tight pads — axis labels live inside the plot, not in a right gutter.
      const pad = narrow
        ? { t: 8, r: 6, b: 12, l: 6 }
        : { t: 16, r: 10, b: 22, l: 8 };
      const w = Math.max(1, cssW - pad.l - pad.r);
      const h = Math.max(1, cssH - pad.t - pad.b);
      scrubLayoutRef.current = { padL: pad.l, padR: pad.r, cssW };

      ctx.clearRect(0, 0, cssW, cssH);

      ctx.fillStyle = MCW.bg;
      ctx.fillRect(0, 0, cssW, cssH);

      // Rolling window — tip near the right; history scrolls left like ECG paper.
      const lookbackMs = narrow ? 80_000 : 110_000;
      const futurePadMs = 5_000;
      const viewEnd = now + futurePadMs;
      const viewStart = now - lookbackMs;
      const inkKeepMs = lookbackMs + 40_000;
      const inkMinStepMs = 48;
      const inkEmaTau = 160;

      const tipP = smoothLive ?? open ?? null;

      /* Strike side for cross-flash (detect early so flash paints this frame). */
      if (open != null && smoothLive != null) {
        const side: 1 | -1 = smoothLive >= open ? 1 : -1;
        if (
          lastStrikeSideRef.current !== 0 &&
          side !== lastStrikeSideRef.current
        ) {
          crossFlashRef.current = 1;
          flashRef.current = Math.max(flashRef.current, 0.75);
          pendingRippleDirRef.current =
            pendingRippleDirRef.current || side;
        }
        lastStrikeSideRef.current = side;
      }

      // Cardiogram ink: seed once, then only APPEND. Never re-EMA / refine history.
      const ink = inkRef.current;
      const commitCausal = (t: number, p: number) => {
        const last = ink.length ? ink[ink.length - 1]! : null;
        if (last && t <= last.t) return;
        const prevT = last?.t ?? t;
        const prevP = inkEmaRef.current ?? last?.p ?? p;
        const dt = Math.max(1, t - prevT);
        const alpha = 1 - Math.exp(-dt / inkEmaTau);
        const ema = prevP + (p - prevP) * alpha;
        inkEmaRef.current = ema;
        if (!last || t - last.t >= inkMinStepMs) {
          ink.push({ t, p: ema });
        }
      };

      if (!inkSeededRef.current) {
        const seedSrc = rawTicks
          .filter((x) => x.t >= now - inkKeepMs && x.t <= now + 50)
          .sort((a, b) => a.t - b.t);
        if (seedSrc.length >= 2) {
          ink.length = 0;
          inkEmaRef.current = null;
          for (const pt of seedSrc) commitCausal(pt.t, pt.p);
          inkSeededRef.current = true;
        } else if (tipP != null) {
          ink.length = 0;
          ink.push({ t: now, p: tipP });
          inkEmaRef.current = tipP;
          inkSeededRef.current = true;
        }
      } else {
        const lastT = ink.length ? ink[ink.length - 1]!.t : 0;
        const newcomers = rawTicks
          .filter((x) => x.t > lastT + 1 && x.t <= now + 50)
          .sort((a, b) => a.t - b.t);
        for (const pt of newcomers) commitCausal(pt.t, pt.p);
        // Wet pen: commit live tip on step so history freezes behind it.
        if (tipP != null) {
          const last = ink[ink.length - 1];
          if (!last || now - last.t >= inkMinStepMs) {
            commitCausal(now, tipP);
          }
        }
      }

      // Drop ink only after it has fully left the soft-exit zone.
      const EXIT_KEEP_MS = 14_000;
      const cut = now - inkKeepMs;
      while (ink.length > 2 && ink[0]!.t < cut) ink.shift();

      // Keep points past the left edge so the path scrolls out (no pop).
      let frozenTicks: BtcTick[] = ink.filter(
        (pt) => pt.t >= viewStart - EXIT_KEEP_MS,
      );

      let wetTicks: BtcTick[] = [];
      if (tipP != null && frozenTicks.length) {
        const anchor = frozenTicks[frozenTicks.length - 1]!;
        const gap = Math.max(1, now - anchor.t);
        if (gap > 12) {
          const n = Math.min(10, Math.max(3, Math.ceil(gap / 40)));
          for (let k = 1; k <= n; k++) {
            const u = k / (n + 1);
            const s = u * u * (3 - 2 * u);
            wetTicks.push({
              t: anchor.t + gap * u,
              p: anchor.p + (tipP - anchor.p) * s,
            });
          }
        }
        wetTicks.push({ t: now, p: tipP });
      } else if (tipP != null) {
        frozenTicks = [
          { t: viewStart, p: tipP },
          { t: Math.max(viewStart + 1, now - 1), p: tipP },
        ];
        wetTicks = [{ t: now, p: tipP }];
      }

      const ptsRaw: BtcTick[] = [...frozenTicks, ...wetTicks];

      if (ptsRaw.length < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font =
          "500 14px SF Pro Display, Open Sans, system-ui, sans-serif";
        ctx.fillText(waitLbl, pad.l + 8, cssH / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const latestPos = posList.length
        ? [...posList].sort((a, b) => b.placedAtMs - a.placedAtMs)[0]!
        : null;

      // Auto Y like pro terminals: fit strike + live + path + entries,
      // then ease center/half so the tip never pins to the frame edge.
      const Y_BAND = 0.46;
      const midAbsSeed = Math.max(
        Math.abs(open ?? smoothLive ?? ptsRaw[0]?.p ?? 1),
        1,
      );
      const zoomFloor = Math.max(midAbsSeed * 0.00018, 8);

      let lo = Infinity;
      let hi = -Infinity;
      const pushP = (p: number | null | undefined) => {
        if (p == null || !Number.isFinite(p)) return;
        if (p < lo) lo = p;
        if (p > hi) hi = p;
      };
      for (const pt of ptsRaw) pushP(pt.p);
      pushP(open);
      pushP(smoothLive);
      for (const pos of posList) pushP(pos.entryPrice);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        lo = (smoothLive ?? open ?? 0) - zoomFloor;
        hi = (smoothLive ?? open ?? 0) + zoomFloor;
      }
      if (hi - lo < zoomFloor * 2) {
        const mid = (lo + hi) / 2;
        lo = mid - zoomFloor;
        hi = mid + zoomFloor;
      }
      const padFrac = 0.2;
      const span = hi - lo;
      const paddedLo = lo - span * padFrac;
      const paddedHi = hi + span * padFrac;
      const targetCenter = (paddedLo + paddedHi) / 2;
      const targetHalf = Math.max((paddedHi - paddedLo) / 2, zoomFloor);

      if (centerRef.current == null || !boundsRef.current.ready) {
        centerRef.current = targetCenter;
        boundsRef.current = { half: targetHalf, ready: true };
      } else {
        const curCenter = centerRef.current;
        const curHalf = Math.max(boundsRef.current.half, 1e-9);
        const tip = smoothLive ?? targetCenter;
        const edge = Math.abs(tip - curCenter) / curHalf;
        // Hub-style sticky Y: expand fast at the rim, barely shrink.
        const expandTau = edge > 0.78 ? 120 : edge > 0.62 ? 220 : 480;
        const shrinkTau = 9_500;
        centerRef.current = expSmooth(curCenter, targetCenter, dt, expandTau);
        if (targetHalf >= curHalf * 0.98 || edge > 0.7) {
          boundsRef.current.half = expSmooth(
            curHalf,
            Math.max(targetHalf, curHalf),
            dt,
            expandTau,
          );
        } else {
          boundsRef.current.half = expSmooth(
            curHalf,
            targetHalf,
            dt,
            shrinkTau,
          );
        }
      }

      const center = centerRef.current ?? targetCenter;
      const halfRange = Math.max(
        boundsRef.current.half *
          manualRangeScaleRef.current *
          punchScaleRef.current,
        1e-9,
      );
      const midY = pad.t + h / 2;
      const viewSpan = Math.max(1, viewEnd - viewStart);

      const xAt = (t: number) =>
        pad.l + ((t - viewStart) / viewSpan) * w;
      const xAtUi = (t: number) =>
        pad.l +
        ((Math.min(Math.max(t, viewStart), viewEnd) - viewStart) / viewSpan) *
          w;
      /* Soft Y — allow slight overshoot; line layer fades top/bottom. */
      const yAt = (p: number) =>
        midY - ((p - center) / halfRange) * (h * Y_BAND);
      const priceAtY = (y: number) =>
        center + ((midY - y) * halfRange) / (h * Y_BAND);

      const last = ptsRaw[ptsRaw.length - 1]!;
      const strikeRef = open ?? center;
      // Hysteresis — flipping green/red every tick around strike looked like jerking.
      const dead = Math.max(Math.abs(strikeRef) * 0.00004, 1.5);
      const rawAbove = last.p >= strikeRef;
      if (moodRef.current !== "up" && moodRef.current !== "down") {
        moodRef.current = rawAbove ? "up" : "down";
      } else if (rawAbove && last.p >= strikeRef + dead) {
        moodRef.current = "up";
      } else if (!rawAbove && last.p <= strikeRef - dead) {
        moodRef.current = "down";
      }
      const aboveStrike = moodRef.current === "up";
      const positionWinning = latestPos?.winning ?? null;
      if (
        positionWinning != null &&
        lastWinningRef.current != null &&
        positionWinning !== lastWinningRef.current
      ) {
        crossFlashRef.current = 1;
      }
      lastWinningRef.current = positionWinning;
      const positive = positionWinning ?? aboveStrike;
      const flash = flashRef.current;

      if (wrapRef.current) {
        wrapRef.current.dataset.mood = positive ? "up" : "down";
      }

      if (mode !== "price") {
        ctx.strokeStyle = MCW.axisMuted;
        ctx.lineWidth = 1;
        const hDivs = narrow ? 2 : 4;
        const vDivs = narrow ? 0 : 4;
        for (let i = 0; i <= hDivs; i++) {
          const y = pad.t + (h * i) / hDivs;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(pad.l + w, y);
          ctx.stroke();
        }
        for (let i = 0; i <= vDivs; i++) {
          const x = pad.l + (w * i) / Math.max(1, vDivs);
          ctx.beginPath();
          ctx.moveTo(x, pad.t);
          ctx.lineTo(x, pad.t + h);
          ctx.stroke();
        }
        // Gray prices inside the plot (left), on grid — not outside the block.
        const labelIdx = narrow ? [0, 1, 2] : [0, 1, 2, 3, 4];
        ctx.fillStyle = "rgba(108,130,145,0.88)";
        ctx.font = narrow
          ? "500 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          : "500 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const i of labelIdx) {
          const y = pad.t + (h * i) / (narrow ? 2 : 4);
          // Keep away from top/bottom edges a touch.
          const ty = Math.min(Math.max(y, pad.t + 8), pad.t + h - 8);
          ctx.fillText(formatAxisPrice(priceAtY(y)), pad.l + 6, ty);
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      const nowX = xAt(now);
      const endX = xAt(t1);

      // Soft future wash — no endgame darkening.
      if (nowX < pad.l + w) {
        const future = ctx.createLinearGradient(nowX, 0, pad.l + w, 0);
        future.addColorStop(0, "rgba(255,255,255,0.006)");
        future.addColorStop(1, "rgba(255,255,255,0.018)");
        ctx.fillStyle = future;
        ctx.fillRect(nowX, pad.t, pad.l + w - nowX, h);
      }

      const drawVLine = (
        x: number,
        color: string,
        dashed: boolean,
        width = 1.5,
      ) => {
        ctx.save();
        if (dashed) ctx.setLineDash([4, 5]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, pad.t + h);
        ctx.stroke();
        ctx.restore();
      };

      if (mode !== "price") {
        drawVLine(nowX, "rgba(255,255,255,0.35)", true, 1);
        if (t1 >= viewStart && t1 <= viewEnd) {
          drawVLine(endX, "rgba(255,255,255,0.22)", true, 1);
        }
      }

      // Midline = round open (strike to beat). Soft UP/DOWN zones + entry anchors.
      if (mode !== "price") {
        const strikeY = yAt(strikeRef);
        const zoneTop = pad.t;
        const zoneBot = pad.t + h;
        const sy = Math.min(Math.max(strikeY, zoneTop), zoneBot);

        // Green above strike / red below — anchored at strike, not chart mid.
        if (sy > zoneTop + 1) {
          const upZone = ctx.createLinearGradient(0, zoneTop, 0, sy);
          upZone.addColorStop(0, "rgba(10,207,151,0.14)");
          upZone.addColorStop(0.55, "rgba(10,207,151,0.06)");
          upZone.addColorStop(1, "rgba(10,207,151,0.02)");
          ctx.fillStyle = upZone;
          ctx.fillRect(pad.l, zoneTop, w, sy - zoneTop);
        }
        if (sy < zoneBot - 1) {
          const downZone = ctx.createLinearGradient(0, sy, 0, zoneBot);
          downZone.addColorStop(0, "rgba(239,71,58,0.02)");
          downZone.addColorStop(0.45, "rgba(239,71,58,0.06)");
          downZone.addColorStop(1, "rgba(239,71,58,0.14)");
          ctx.fillStyle = downZone;
          ctx.fillRect(pad.l, sy, w, zoneBot - sy);
        }

        ctx.save();
        const xFlash = crossFlashRef.current;
        if (xFlash > 0.05) {
          ctx.setLineDash([]);
          ctx.strokeStyle =
            smoothLive != null && open != null && smoothLive >= open
              ? MCW.upHex
              : MCW.downHex;
          ctx.globalAlpha = 0.4 + xFlash * 0.55;
          ctx.lineWidth = 1.35 + xFlash * 2;
        } else {
          ctx.setLineDash(narrow ? [4, 5] : [5, 6]);
          ctx.strokeStyle = "rgba(200, 214, 230, 0.55)";
          ctx.globalAlpha = 0.95;
          ctx.lineWidth = narrow ? 1.15 : 1.35;
        }
        ctx.beginPath();
        ctx.moveTo(pad.l, sy);
        ctx.lineTo(pad.l + w, sy);
        ctx.stroke();
        ctx.restore();
      }

      const freezeCount = frozenTicks.length;
      const plot: Pt[] = ptsRaw.map((pt) => ({ x: xAt(pt.t), y: yAt(pt.p) }));
      if (smoothLive != null && plot.length) {
        plot[plot.length - 1]!.y = yAt(smoothLive) + tipKickPxRef.current;
        plot[plot.length - 1]!.x = xAt(now);
      }

      const lastPt = plot[plot.length - 1]!;
      const mx = lastPt.x;
      const my = lastPt.y;

      const moodUp = positive;
      const lineHex = brandHex || (moodUp ? MCW.upHex : MCW.downHex);
      const liveRgb = brandRgb || (moodUp ? MCW.upRgb : MCW.downRgb);

      /* Strike cross ripple at tip (detection already ran earlier). */
      if (pendingRippleDirRef.current !== 0) {
        ripplesRef.current.push({
          born: now,
          dir: pendingRippleDirRef.current,
          x: mx,
          y: my,
        });
        if (ripplesRef.current.length > 4) ripplesRef.current.shift();
        pendingRippleDirRef.current = 0;
      }

      /* 2) Velocity trail behind tip */
      trailRef.current.push({
        x: mx,
        y: my,
        born: now,
        dir: tickDirRef.current || (moodUp ? 1 : -1),
      });
      trailRef.current = trailRef.current.filter((pt) => now - pt.born < 420);
      if (trailRef.current.length > 14) {
        trailRef.current = trailRef.current.slice(-14);
      }

      // Cardiogram stroke on a separate layer — soft left/top fade like hub cards.
      const frozenPlot = plot.slice(0, Math.max(2, freezeCount));
      const wetPlot =
        freezeCount > 0
          ? [plot[freezeCount - 1]!, ...plot.slice(freezeCount)]
          : plot;

      let layer = lineLayerRef.current;
      if (!layer) {
        layer = document.createElement("canvas");
        lineLayerRef.current = layer;
      }
      if (layer.width !== bufW || layer.height !== bufH) {
        layer.width = bufW;
        layer.height = bufH;
      }
      const lctx = layer.getContext("2d");
      if (lctx) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.clearRect(0, 0, cssW, cssH);

        const areaPts =
          frozenPlot.length >= 2
            ? [...frozenPlot, ...(wetPlot.length > 1 ? wetPlot.slice(1) : [])]
            : wetPlot;
        if (areaPts.length >= 2) {
          lctx.beginPath();
          buildSmoothPath(lctx, areaPts);
          const lastArea = areaPts[areaPts.length - 1]!;
          const firstArea = areaPts[0]!;
          lctx.lineTo(lastArea.x, pad.t + h);
          lctx.lineTo(firstArea.x, pad.t + h);
          lctx.closePath();
          const fillGrad = lctx.createLinearGradient(0, pad.t, 0, pad.t + h);
          fillGrad.addColorStop(0, `rgba(${liveRgb},0.24)`);
          fillGrad.addColorStop(0.55, `rgba(${liveRgb},0.07)`);
          fillGrad.addColorStop(1, `rgba(${liveRgb},0)`);
          lctx.fillStyle = fillGrad;
          lctx.fill();
        }

        lctx.lineWidth =
          latestPos || flashRef.current > 0.2
            ? 3.15 + flashRef.current * 0.6
            : 2.65;
        lctx.lineJoin = "round";
        lctx.lineCap = "round";
        lctx.strokeStyle = lineHex;
        if (frozenPlot.length >= 2) strokeSmooth(lctx, frozenPlot);
        if (wetPlot.length >= 2) {
          lctx.beginPath();
          lctx.moveTo(wetPlot[0]!.x, wetPlot[0]!.y);
          for (let i = 1; i < wetPlot.length; i++) {
            lctx.lineTo(wetPlot[i]!.x, wetPlot[i]!.y);
          }
          lctx.stroke();
        }

        /* Markets lightning — continuous streak sweeping along the curve. */
        const sparkCycle = 2800;
        const sparkPhase = (now % sparkCycle) / sparkCycle;
        // Match ChanceChart: visible ~0–68%, then rest.
        const sparkProgress = sparkPhase < 0.68 ? sparkPhase / 0.68 : 0;
        if (sparkProgress > 0 && areaPts.length >= 2) {
          strokeTravelingSpark(
            lctx,
            areaPts,
            sparkProgress,
            liveRgb,
            latestPos || flashRef.current > 0.2 ? 3.15 : 2.65,
          );
        }

        /* Velocity ribbon */
        const trail = trailRef.current;
        for (let i = 0; i < trail.length; i++) {
          const pt = trail[i]!;
          const age = (now - pt.born) / 420;
          const a = (1 - age) * 0.35;
          if (a <= 0.02) continue;
          const r = 1.2 + (1 - age) * 2.2;
          lctx.beginPath();
          lctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          lctx.fillStyle = `rgba(${liveRgb},${a})`;
          lctx.fill();
        }

        /* Impulse / cross ripples */
        ripplesRef.current = ripplesRef.current.filter(
          (r) => now - r.born < 700,
        );
        for (const r of ripplesRef.current) {
          const age = (now - r.born) / 700;
          const rad = 6 + age * 28;
          lctx.beginPath();
          lctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
          lctx.strokeStyle = `rgba(${
            r.dir > 0 ? MCW.upRgb : MCW.downRgb
          },${0.4 * (1 - age)})`;
          lctx.lineWidth = 1.4;
          lctx.stroke();
        }

        /* Markets live tip — solid core + expanding pulse ring. */
        const pulseT = (now % 1700) / 1700;
        const tipR = 4;
        const corona = lctx.createRadialGradient(mx, my, 0, mx, my, 14);
        corona.addColorStop(0, `rgba(${liveRgb},0.55)`);
        corona.addColorStop(0.5, `rgba(${liveRgb},0.16)`);
        corona.addColorStop(1, `rgba(${liveRgb},0)`);
        lctx.beginPath();
        lctx.arc(mx, my, 14, 0, Math.PI * 2);
        lctx.fillStyle = corona;
        lctx.fill();

        lctx.beginPath();
        lctx.arc(mx, my, tipR + pulseT * 7.5, 0, Math.PI * 2);
        lctx.strokeStyle = `rgba(${liveRgb},${0.65 * (1 - pulseT)})`;
        lctx.lineWidth = 1.5;
        lctx.stroke();

        lctx.beginPath();
        lctx.arc(mx, my, tipR, 0, Math.PI * 2);
        lctx.fillStyle = lineHex;
        lctx.fill();
        lctx.beginPath();
        lctx.arc(mx, my, tipR * 0.38, 0, Math.PI * 2);
        lctx.fillStyle = "rgba(255,255,255,0.85)";
        lctx.fill();

        /* Soft exit — dissolve at left (and lightly at top/bottom). */
        lctx.save();
        lctx.globalCompositeOperation = "destination-in";
        const fadeX = lctx.createLinearGradient(
          pad.l - 2,
          0,
          pad.l + Math.min(88, w * 0.13),
          0,
        );
        fadeX.addColorStop(0, "rgba(0,0,0,0)");
        fadeX.addColorStop(0.55, "rgba(0,0,0,0.75)");
        fadeX.addColorStop(1, "rgba(0,0,0,1)");
        lctx.fillStyle = fadeX;
        lctx.fillRect(0, 0, cssW, cssH);
        const fadeY = lctx.createLinearGradient(0, pad.t - 2, 0, pad.t + h + 2);
        fadeY.addColorStop(0, "rgba(0,0,0,0)");
        fadeY.addColorStop(0.08, "rgba(0,0,0,1)");
        fadeY.addColorStop(0.92, "rgba(0,0,0,1)");
        fadeY.addColorStop(1, "rgba(0,0,0,0)");
        lctx.fillStyle = fadeY;
        lctx.fillRect(0, 0, cssW, cssH);
        lctx.restore();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.restore();
      }

      // FuelTech-style stake tags — amount only; evaporate on settle.
      const stakeBadges: TipRect[] = [];
      if (mode !== "price") {
        const liveMap = livePositionsRef.current;
        const ghosts = ghostPositionsRef.current;
        const liveIds = new Set(posList.map((p) => p.id));

        for (const pos of posList) {
          liveMap.set(pos.id, pos);
          ghosts.delete(pos.id);
        }
        for (const [id, prev] of [...liveMap.entries()]) {
          if (!liveIds.has(id)) {
            ghosts.set(id, { ...prev, goneAt: now });
            liveMap.delete(id);
          }
        }
        for (const [id, g] of [...ghosts.entries()]) {
          if (now - g.goneAt > 900) ghosts.delete(id);
        }

        const drawPos = (
          pos: ChartPosition,
          alpha: number,
          evaporating: boolean,
        ) => {
          if (alpha <= 0.02) return;
          const py = yAt(pos.entryPrice);
          const sideUp = pos.side === "UP";
          const accent = sideUp ? MCW.upHex : MCW.downHex;
          const accentRgb = sideUp ? MCW.upRgb : MCW.downRgb;
          const isLatest = latestPos?.id === pos.id && !evaporating;
          const justPlaced = !evaporating && now - pos.placedAtMs < 1600;
          const entryX = xAtUi(pos.placedAtMs);
          const rise = evaporating
            ? ((now - (pos as GhostPos).goneAt) / 900) * 14
            : 0;

          // Short personal anchor — not a full-width line.
          const tickHalf = narrow ? 18 : 26;
          ctx.save();
          ctx.globalAlpha = alpha * (isLatest ? 0.9 : 0.65);
          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(${accentRgb},0.85)`;
          ctx.lineWidth = isLatest ? 1.35 : 1.1;
          ctx.beginPath();
          ctx.moveTo(Math.max(pad.l, entryX - tickHalf), py);
          ctx.lineTo(Math.min(pad.l + w, entryX + tickHalf), py);
          ctx.stroke();
          ctx.restore();

          const label = formatStakeLabel(pos.stake, pos.currency);
          ctx.font = narrow
            ? "600 11px SF Pro Display, Open Sans, system-ui, sans-serif"
            : "600 12px SF Pro Display, Open Sans, system-ui, sans-serif";
          const tw = ctx.measureText(label).width;
          const iconBox = narrow ? 14 : 16;
          const gap = narrow ? 6 : 7;
          const padX = narrow ? 9 : 11;
          const badgeH = narrow ? 24 : 26;
          const badgeW = padX + iconBox + gap + tw + padX;
          const bx = Math.min(
            Math.max(entryX - badgeW / 2, pad.l + 2),
            pad.l + w - badgeW - 2,
          );
          let by = py - badgeH - 12 - rise;
          let above = true;
          if (by < pad.t + 2) {
            by = Math.min(py + 12 + rise, pad.t + h - badgeH - 2);
            above = false;
          }

          if (!evaporating || alpha > 0.35) {
            stakeBadges.push({ x: bx, y: by, w: badgeW, h: badgeH });
          }

          // Soft stem into the pill.
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(234,236,239,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(entryX, py);
          ctx.lineTo(entryX, above ? by + badgeH : by);
          ctx.stroke();
          ctx.restore();

          // White Take-control pill for stake.
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 2;
          roundRect(ctx, bx, by, badgeW, badgeH, badgeH / 2);
          ctx.fillStyle = "#eaecef";
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = "rgba(0,0,0,0.06)";
          ctx.lineWidth = 1;
          ctx.stroke();

          const ix = bx + padX + iconBox / 2;
          const iy = by + badgeH / 2;
          // Side mark — filled circle with UP/DOWN chevron.
          ctx.beginPath();
          ctx.arc(ix, iy, iconBox / 2 - 0.5, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.beginPath();
          if (sideUp) {
            ctx.moveTo(ix, iy - 3.2);
            ctx.lineTo(ix + 3.2, iy + 2.2);
            ctx.lineTo(ix - 3.2, iy + 2.2);
          } else {
            ctx.moveTo(ix, iy + 3.2);
            ctx.lineTo(ix + 3.2, iy - 2.2);
            ctx.lineTo(ix - 3.2, iy - 2.2);
          }
          ctx.closePath();
          ctx.fillStyle = "#fff";
          ctx.fill();

          ctx.fillStyle = "#0b0e11";
          ctx.textBaseline = "middle";
          ctx.fillText(label, bx + padX + iconBox + gap, iy + 0.5);
          ctx.textBaseline = "alphabetic";
          ctx.restore();

          if (justPlaced) {
            const pulse = Math.max(0, 1 - (now - pos.placedAtMs) / 1600);
            ctx.beginPath();
            ctx.arc(entryX, py, 5 + pulse * 12, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${accentRgb},${0.4 * pulse})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }

          // Entry dot — personal anchor on the price.
          ctx.beginPath();
          ctx.arc(entryX, py, narrow ? 3.6 : 4.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${accentRgb},0.18)`;
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.7;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(entryX, py, narrow ? 1.5 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
        };

        for (const pos of posList) drawPos(pos, 1, false);
        for (const g of ghosts.values()) {
          const age = (now - g.goneAt) / 900;
          drawPos(g, Math.max(0, 1 - age), true);
        }
      }

      // Round-open marker when it falls inside the live window.
      if (t0 >= viewStart && t0 <= viewEnd) {
        const ox = xAtUi(t0);
        ctx.save();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = narrow
          ? "rgba(108,130,145,0.35)"
          : MCW.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, pad.t);
        ctx.lineTo(ox, pad.t + h);
        ctx.stroke();
        ctx.restore();
        if (!narrow) {
          ctx.fillStyle = "rgba(108,130,145,0.9)";
          ctx.font =
            "600 9px SF Pro Display, Open Sans, system-ui, sans-serif";
          ctx.fillText(startLbl, ox + 4, pad.t + 12);
        }
      }

      // Tip guide — dashed live level across plot (no price pill on the snake tip).
      if (mode !== "price" && last && scrubFracRef.current == null) {
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = moodUp
          ? `rgba(${liveRgb},0.45)`
          : `rgba(${MCW.downRgb},0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, my);
        ctx.lineTo(pad.l + w, my);
        ctx.stroke();
        ctx.restore();
      }

      // Polymarket-style scrub: vertical line + brand tip + logo tooltip.
      const scrubFrac = scrubFracRef.current;
      if (scrubFrac != null && ptsRaw.length >= 2) {
        const scrubTRaw = viewStart + scrubFrac * viewSpan;
        const scrubT = Math.min(Math.max(scrubTRaw, viewStart), now);
        const sample = interpolateTick(ptsRaw, scrubT);
        if (sample) {
          const sx = xAtUi(sample.t);
          const sy = yAt(sample.p);
          const tipAccent = brandHex || MCW.upHex;
          // Short caret — just around the cursor/point, not full chart height.
          const tickHalf = narrow ? 22 : 28;
          const lineTop = Math.max(pad.t + 2, sy - tickHalf);
          const lineBot = Math.min(pad.t + h - 2, sy + tickHalf);

          ctx.save();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(200, 210, 220, 0.42)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, lineTop);
          ctx.lineTo(sx, lineBot);
          ctx.stroke();
          ctx.restore();

          ctx.beginPath();
          ctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
          ctx.fillStyle = tipAccent;
          ctx.fill();
          ctx.strokeStyle = "rgba(10, 14, 20, 0.75)";
          ctx.lineWidth = 1.25;
          ctx.stroke();

          const tipEl = scrubTipRef.current;
          const tipW = tipEl?.offsetWidth || (narrow ? 96 : 112);
          const tipH = tipEl?.offsetHeight || 38;
          const placed = placeScrubTip(
            sx,
            sy,
            cssW,
            cssH,
            tipW,
            tipH,
            stakeBadges,
          );
          if (tipEl) {
            tipEl.style.left = `${placed.x}px`;
            tipEl.style.top = `${placed.y}px`;
          }
          if (scrubPriceRef.current) {
            scrubPriceRef.current.textContent = formatScrubPrice(sample.p);
            scrubPriceRef.current.style.color = tipAccent;
          }
          if (scrubTimeRef.current) {
            scrubTimeRef.current.textContent = formatScrubStamp(sample.t);
          }

          const key = `${Math.round(sample.t / 50)}:${sample.p.toFixed(priceFractionDigits(sample.p))}`;
          if (key !== lastScrubKeyRef.current) {
            lastScrubKeyRef.current = key;
            onScrubRef.current?.(sample);
          }
          if (scrubTipRef.current) scrubTipRef.current.dataset.on = "1";
        }
      } else if (lastScrubKeyRef.current !== "" || scrubTipRef.current?.dataset.on) {
        lastScrubKeyRef.current = "";
        if (scrubTipRef.current) delete scrubTipRef.current.dataset.on;
        onScrubRef.current?.(null);
      }

      if (!narrow) {
        const fmt = (ms: number) =>
          new Date(ms).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "500 10px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(fmt(viewStart), pad.l, cssH - 8);
        const midLabel = fmt(now);
        if (nowX < pad.l + w - 72) {
          ctx.fillText(
            midLabel,
            nowX - ctx.measureText(midLabel).width / 2,
            cssH - 8,
          );
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const roundLabel =
    roundStartLabel && roundEndLabel
      ? `${roundStartLabel}–${roundEndLabel}`
      : "—";

  const setScrubFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const { padL, padR, cssW } = scrubLayoutRef.current;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const plotW = Math.max(1, cssW - padL - padR);
    scrubFracRef.current = Math.max(0, Math.min(1, (x - padL) / plotW));
  };

  const clearScrub = () => {
    if (scrubFracRef.current == null) return;
    scrubFracRef.current = null;
  };

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${upNow ? styles.wrapUp : styles.wrapDown} ${
        mode === "price" ? styles.priceMode : ""
      } ${styles.wrapScrub}`}
      onPointerDown={(e) => {
        if (mode === "price") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setScrubFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (mode === "price") return;
        if (
          e.pointerType === "mouse" ||
          e.currentTarget.hasPointerCapture(e.pointerId)
        ) {
          setScrubFromClientX(e.clientX);
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") clearScrub();
      }}
      onPointerLeave={() => clearScrub()}
      onPointerCancel={() => clearScrub()}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <div
        ref={scrubTipRef}
        className={styles.scrubTip}
        style={{ "--scrub-accent": accentHex } as CSSProperties}
        aria-hidden
      >
        <div className={styles.scrubTipRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            width={18}
            height={18}
            className={styles.scrubTipLogo}
            draggable={false}
          />
          <span ref={scrubPriceRef} className={styles.scrubTipPrice}>
            $0.00
          </span>
        </div>
        <span ref={scrubTimeRef} className={styles.scrubTipTime}>
          —
        </span>
      </div>
    </div>
  );
}
