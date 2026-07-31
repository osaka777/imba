"use client";

import NumberFlow, { continuous } from "@number-flow/react";
import {
  memo,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { RaceTick } from "../api/client";

import styles from "./RaceChart.module.css";

const PAD = { t: 44, r: 36, b: 18, l: 14 };
const INK_MIN_STEP_MS = 32;
const INK_EMA_TAU_MS = 70;
const LOOKBACK_MS = 100_000;
const TIP_RIGHT_GAP = 0.18;
const Y_MIN_SPAN = 0.08;
const Y_PAD_RATIO = 0.35;
const RESIZE_DEBOUNCE_MS = 150;
const SERIES_CAP0 = 512;
/** Preallocated projected vertices for culled window (no per-frame alloc). */
const SCRATCH_XY_CAP = 2048;
/** Tip vertical lerp time-constant (seconds) — snappy on reversals. */
const TIP_TAU_S = 0.09;
/** Soft clock sync rate when feed.nowMs drifts from wall clock. */
const CLOCK_SYNC_K = 0.12;

type FeedSnap = {
  ticksA: RaceTick[];
  ticksB: RaceTick[];
  openA: number | null;
  openB: number | null;
  liveA: number | null;
  liveB: number | null;
  startsAtMs: number;
  endsAtMs: number;
  nowMs: number;
  colorA: string;
  colorB: string;
};

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let id: number | null = null;
  const run = (...args: Parameters<T>) => {
    if (id != null) window.clearTimeout(id);
    id = window.setTimeout(() => {
      id = null;
      fn(...args);
    }, ms);
  };
  run.cancel = () => {
    if (id != null) {
      window.clearTimeout(id);
      id = null;
    }
  };
  return run;
}

/** First index with t[i] >= x (or len). */
function lowerBoundT(t: Float64Array, len: number, x: number): number {
  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index with t[i] > x (or len). */
function upperBoundT(t: Float64Array, len: number, x: number): number {
  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sampleSeries(
  t: Float64Array,
  v: Float64Array,
  len: number,
  at: number,
): number {
  if (len <= 0) return 0;
  if (at <= t[0]!) return v[0]!;
  if (at >= t[len - 1]!) return v[len - 1]!;
  let lo = 0;
  let hi = len - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= at) lo = mid;
    else hi = mid;
  }
  const t0 = t[lo]!;
  const t1 = t[hi]!;
  const u = (at - t0) / Math.max(1, t1 - t0);
  return v[lo]! + (v[hi]! - v[lo]!) * u;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  let full = h;
  if (h.length === 3) {
    full = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return r + "," + g + "," + b;
}

/** GC-free SoA series buffer — mutate only in hot path. */
class SeriesBuf {
  t: Float64Array;
  v: Float64Array;
  len = 0;
  ema = 0;
  hasEma = false;
  seeded = false;
  open = 0;
  hasOpen = false;
  start = 0;

  constructor(cap = SERIES_CAP0) {
    this.t = new Float64Array(cap);
    this.v = new Float64Array(cap);
  }

  reset(open: number | null, start: number) {
    this.len = 0;
    this.hasEma = false;
    this.ema = 0;
    this.seeded = false;
    this.start = start;
    if (open != null && Number.isFinite(open) && open > 0) {
      this.open = open;
      this.hasOpen = true;
    } else {
      this.open = 0;
      this.hasOpen = false;
    }
  }

  private grow() {
    const next = this.t.length << 1;
    const nt = new Float64Array(next);
    const nv = new Float64Array(next);
    nt.set(this.t);
    nv.set(this.v);
    this.t = nt;
    this.v = nv;
  }

  /** Zero-alloc append with light densify on large moves (grows buffer rarely). */
  append(time: number, value: number) {
    if (time < this.start) return;

    // Always start from open (=0%) so the snake never appears mid-plot.
    if (this.len === 0) {
      if (this.t.length < 2) this.grow();
      this.t[0] = this.start;
      this.v[0] = 0;
      this.len = 1;
      this.ema = 0;
      this.hasEma = true;
      this.seeded = true;
    }

    const n = this.len;
    if (time <= this.t[n - 1]!) {
      if (n > 0 && time + 2 >= this.t[n - 1]!) {
        const prevV = this.v[n - 1]!;
        const next = prevV + (value - prevV) * 0.55;
        this.v[n - 1] = next;
        this.ema = next;
        this.hasEma = true;
      }
      return;
    }

    const prevT = this.t[n - 1]!;
    const prevV = this.hasEma ? this.ema : this.v[n - 1]!;
    const dt = Math.max(1, time - prevT);
    const alpha = 1 - Math.exp(-dt / INK_EMA_TAU_MS);
    const ema = prevV + (value - prevV) * alpha;
    this.ema = ema;
    this.hasEma = true;

    // Within min step: update last point in place (no dropped updates → no stutter).
    if (time - prevT < INK_MIN_STEP_MS) {
      this.v[n - 1] = ema;
      this.t[n - 1] = time;
      return;
    }

    const gap = time - prevT;
    const dv = Math.abs(ema - prevV);
    if (dv > 1e-9 && gap > 40) {
      const steps = Math.min(8, Math.max(2, Math.ceil(gap / 55)));
      for (let k = 1; k <= steps; k++) {
        const u = k / (steps + 1);
        const s = u * u * (3 - 2 * u);
        if (this.len >= this.t.length) this.grow();
        const i = this.len;
        this.t[i] = prevT + gap * u;
        this.v[i] = prevV + (ema - prevV) * s;
        this.len = i + 1;
      }
    }

    if (this.len >= this.t.length) this.grow();
    const i = this.len;
    this.t[i] = time;
    this.v[i] = ema;
    this.len = i + 1;
  }

  /** Drop head in-place (no splice alloc). Keeps one sample before window. */
  trimBefore(keepAfter: number) {
    const n = this.len;
    if (n < 64) return;
    let cut = 0;
    while (cut < n && this.t[cut]! < keepAfter) cut++;
    if (cut <= 0) return;
    if (cut > 0) cut--;
    const remain = n - cut;
    for (let i = 0; i < remain; i++) {
      this.t[i] = this.t[i + cut]!;
      this.v[i] = this.v[i + cut]!;
    }
    this.len = remain;
  }

  /** Guarantee (start, 0) is the first vertex. */
  ensureOrigin() {
    if (!this.hasOpen) return;
    if (this.len === 0) {
      if (this.t.length < 1) this.grow();
      this.t[0] = this.start;
      this.v[0] = 0;
      this.len = 1;
      this.ema = 0;
      this.hasEma = true;
      this.seeded = true;
      return;
    }
    if (this.t[0]! <= this.start + 1) {
      this.t[0] = this.start;
      if (Math.abs(this.v[0]!) < 1e-9) this.v[0] = 0;
      return;
    }
    if (this.len + 1 > this.t.length) this.grow();
    for (let i = this.len; i > 0; i--) {
      this.t[i] = this.t[i - 1]!;
      this.v[i] = this.v[i - 1]!;
    }
    this.t[0] = this.start;
    this.v[0] = 0;
    this.len = this.len + 1;
    this.seeded = true;
  }

  seedFromTicks(ticks: RaceTick[], open: number | null, fromT: number) {
    this.reset(open, fromT);
    if (!this.hasOpen) return;
    const inv = 100 / this.open;

    // Always open at 0% — both snakes share the left edge.
    if (this.t.length < 2) this.grow();
    this.t[0] = fromT;
    this.v[0] = 0;
    let count = 1;
    let lastV = 0;

    for (let i = 0; i < ticks.length; i++) {
      const tk = ticks[i]!;
      if (tk.t <= fromT || !Number.isFinite(tk.p)) continue;
      const pv = (tk.p - this.open) * inv;
      if (count > 1 && Math.abs(pv - lastV) < 2e-6 && Math.abs(lastV) > 1e-9) {
        this.t[count - 1] = tk.t;
        continue;
      }
      if (count >= this.t.length) this.grow();
      this.t[count] = tk.t;
      this.v[count] = pv;
      count++;
      lastV = pv;
    }

    if (count > 120) {
      const keep = 120;
      const step = (count - 1) / (keep - 1);
      const ot = this.t[0]!;
      const ov = this.v[0]!;
      for (let i = 1; i < keep; i++) {
        const src = Math.round(i * step);
        this.t[i] = this.t[src]!;
        this.v[i] = this.v[src]!;
      }
      this.t[0] = ot;
      this.v[0] = ov;
      count = keep;
    }

    if (count > 1) {
      let ema = this.v[1]!;
      this.v[1] = ema;
      for (let i = 2; i < count; i++) {
        const dti = Math.max(1, this.t[i]! - this.t[i - 1]!);
        const a = 1 - Math.exp(-dti / 90);
        ema = ema + (this.v[i]! - ema) * a;
        this.v[i] = ema;
      }
      this.ema = ema;
      this.hasEma = true;
    } else {
      this.ema = 0;
      this.hasEma = true;
    }
    this.v[0] = 0;
    this.len = count;
    this.seeded = true;
  }
}

/**
 * 60fps imperative engine: SoA buffers, cull, wall-clock X, batched strokes,
 * sub-pixel coords. paint() / append allocate nothing.
 */
class RaceChartEngine {
  private canvas: HTMLCanvasElement;
  private feed: MutableRefObject<FeedSnap>;
  private scrubTip: HTMLElement | null;
  private scrubTime: HTMLElement | null;
  private onScrubHud: (h: {
    side: "A" | "B";
    pct: number;
    t: number;
  } | null) => void;

  private raf = 0;
  private lastFrame = 0;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private sizeReady = false;

  private seriesA = new SeriesBuf();
  private seriesB = new SeriesBuf();

  private dispA = 0;
  private dispB = 0;
  private tipReady = false;
  private hasTargetA = false;
  private hasTargetB = false;
  private targetA = 0;
  private targetB = 0;

  private yLo = -Y_MIN_SPAN / 2;
  private yHi = Y_MIN_SPAN / 2;
  private ySugLo = -Y_MIN_SPAN / 2;
  private ySugHi = Y_MIN_SPAN / 2;
  private yReady = false;

  /** Wall-clock driven chart time (ms epoch). */
  private chartNow = 0;
  private clockSynced = false;
  private xMin = 0;
  private xMax = 1;

  private scrubFrac: number | null = null;
  /** Cursor Y in CSS px relative to wrap (for picking nearest snake). */
  private scrubY: number | null = null;
  private lastScrubUiAt = 0;
  private scrubHudOn = false;
  private scrubHudSide: 0 | 1 = 0; // 0=A 1=B
  private scrubHudPct = 0;
  private scrubHudT = 0;

  private roundStart = 0;
  private roundOpenA = NaN;
  private roundOpenB = NaN;

  private colorA = "#3b82f6";
  private colorB = "#ef4444";
  private fillA = "rgba(59,130,246,0.12)";
  private fillB = "rgba(239,68,68,0.12)";

  private scratchTipX = 0;
  private scratchTipY = 0;
  private scratchCount = 0;
  private scratchX = new Float64Array(SCRATCH_XY_CAP);
  private scratchY = new Float64Array(SCRATCH_XY_CAP);
  private scratchN = 0;
  private tipAX = 0;
  private tipAY = 0;
  private tipBX = 0;
  private tipBY = 0;
  private hasTipDotA = false;
  private hasTipDotB = false;

  private gradA: CanvasGradient | null = null;
  private gradB: CanvasGradient | null = null;
  private gradCssH = 0;
  private gradColorA = "";
  private gradColorB = "";

  private ctx: CanvasRenderingContext2D | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    _wrap: HTMLElement,
    feed: MutableRefObject<FeedSnap>,
    scrubTip: HTMLElement | null,
    scrubTime: HTMLElement | null,
    onScrubHud: (h: {
      side: "A" | "B";
      pct: number;
      t: number;
    } | null) => void,
  ) {
    this.canvas = canvas;
    this.feed = feed;
    this.scrubTip = scrubTip;
    this.scrubTime = scrubTime;
    this.onScrubHud = onScrubHud;
    this.ctx = canvas.getContext("2d", { alpha: true });
  }

  setSize(cssW: number, cssH: number) {
    const w = Math.max(1, Math.round(cssW));
    const h = Math.max(1, Math.round(cssH));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (
      this.sizeReady &&
      this.cssW === w &&
      this.cssH === h &&
      this.dpr === dpr
    ) {
      return;
    }
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.sizeReady = true;

    const bufW = Math.floor(w * dpr);
    const bufH = Math.floor(h * dpr);
    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW;
      this.canvas.height = bufH;
      this.ctx = this.canvas.getContext("2d", { alpha: true });
      this.gradA = null;
      this.gradB = null;
    }
    if (this.canvas.style.width !== w + "px") {
      this.canvas.style.width = w + "px";
    }
    if (this.canvas.style.height !== h + "px") {
      this.canvas.style.height = h + "px";
    }
  }

  setScrub(frac: number | null, yCss: number | null) {
    this.scrubFrac = frac;
    this.scrubY = yCss;
  }

  start() {
    this.lastFrame = performance.now();
    const tick = (now: number) => {
      this.paint(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private syncColors(a: string, b: string) {
    if (a !== this.colorA) {
      this.colorA = a;
      this.fillA = "rgba(" + hexToRgbTriplet(a) + ",0.12)";
    }
    if (b !== this.colorB) {
      this.colorB = b;
      this.fillB = "rgba(" + hexToRgbTriplet(b) + ",0.12)";
    }
  }

  private ensureRound(feed: FeedSnap) {
    const oa = feed.openA ?? NaN;
    const ob = feed.openB ?? NaN;
    if (
      feed.startsAtMs === this.roundStart &&
      oa === this.roundOpenA &&
      ob === this.roundOpenB
    ) {
      return;
    }
    this.roundStart = feed.startsAtMs;
    this.roundOpenA = oa;
    this.roundOpenB = ob;
    this.seriesA.seedFromTicks(feed.ticksA, feed.openA, feed.startsAtMs);
    this.seriesB.seedFromTicks(feed.ticksB, feed.openB, feed.startsAtMs);
    this.yReady = false;
    this.tipReady = false;
    this.clockSynced = false;
  }

  /** Append only newer ticks — no temporary arrays. */
  private ingest(series: SeriesBuf, ticks: RaceTick[]) {
    if (!series.hasOpen) return;
    series.ensureOrigin();
    const open = series.open;
    const inv = 100 / open;
    const n = series.len;
    const lastT = n > 0 ? series.t[n - 1]! : series.start;
    let lo = 0;
    let hi = ticks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ticks[mid]!.t <= lastT) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < ticks.length; i++) {
      const tk = ticks[i]!;
      if (tk.t < series.start || !Number.isFinite(tk.p)) continue;
      series.append(tk.t, (tk.p - open) * inv);
    }
  }

  private ensureGradients(ctx: CanvasRenderingContext2D, bottomY: number) {
    if (
      this.gradA &&
      this.gradB &&
      this.gradCssH === this.cssH &&
      this.gradColorA === this.colorA &&
      this.gradColorB === this.colorB
    ) {
      return;
    }
    this.gradCssH = this.cssH;
    this.gradColorA = this.colorA;
    this.gradColorB = this.colorB;
    const aRgb = hexToRgbTriplet(this.colorA);
    const bRgb = hexToRgbTriplet(this.colorB);
    const ga = ctx.createLinearGradient(0, PAD.t, 0, bottomY);
    ga.addColorStop(0, "rgba(" + aRgb + ",0.16)");
    ga.addColorStop(0.55, "rgba(" + aRgb + ",0.05)");
    ga.addColorStop(1, "rgba(" + aRgb + ",0)");
    const gb = ctx.createLinearGradient(0, PAD.t, 0, bottomY);
    gb.addColorStop(0, "rgba(" + bRgb + ",0.16)");
    gb.addColorStop(0.55, "rgba(" + bRgb + ",0.05)");
    gb.addColorStop(1, "rgba(" + bRgb + ",0)");
    this.gradA = ga;
    this.gradB = gb;
  }

  /**
   * Project culled samples into scratchX/Y (float coords — smooth scroll, AA).
   */
  private projectCulled(
    series: SeriesBuf,
    tipT: number,
    tipV: number,
    hasTip: boolean,
    xMin: number,
    xMax: number,
    yLo: number,
    yHi: number,
    plotW: number,
    plotH: number,
  ) {
    const tArr = series.t;
    const vArr = series.v;
    const len = series.len;
    const xs = this.scratchX;
    const ys = this.scratchY;
    let n = 0;

    const xSpan = xMax - xMin;
    const ySpan = yHi - yLo;
    this.scratchN = 0;
    this.scratchCount = 0;
    if (xSpan <= 0 || ySpan <= 0) return;

    const xScale = plotW / xSpan;

    // Empty series: flat from left open to tip
    if (len <= 0) {
      if (!hasTip) return;
      const leftT = Math.max(xMin, this.roundStart);
      xs[0] = PAD.l + (leftT - xMin) * xScale;
      ys[0] = PAD.t + (1 - (0 - yLo) / ySpan) * plotH;
      xs[1] = PAD.l + (tipT - xMin) * xScale;
      ys[1] = PAD.t + (1 - (tipV - yLo) / ySpan) * plotH;
      n = 2;
      this.scratchTipX = xs[1]!;
      this.scratchTipY = ys[1]!;
      this.scratchN = n;
      this.scratchCount = n;
      return;
    }

    let i0 = lowerBoundT(tArr, len, xMin) - 1;
    let i1 = upperBoundT(tArr, len, xMax);
    if (i0 < 0) i0 = 0;
    if (i1 >= len) i1 = len - 1;
    if (i1 < i0) {
      i0 = 0;
      i1 = len - 1;
    }

    let lastX = -1e9;

    // If first data is after the left edge, draw flat 0% from the edge
    // (fixes "snake starts in the middle").
    const leftT = Math.max(xMin, this.roundStart);
    if (tArr[i0]! > leftT + 8) {
      xs[0] = PAD.l + (leftT - xMin) * xScale;
      ys[0] = PAD.t + (1 - (0 - yLo) / ySpan) * plotH;
      lastX = xs[0]!;
      n = 1;
    }

    for (let i = i0; i <= i1; i++) {
      if (n >= SCRATCH_XY_CAP - 2) break;
      const x = PAD.l + (tArr[i]! - xMin) * xScale;
      const y = PAD.t + (1 - (vArr[i]! - yLo) / ySpan) * plotH;
      if (n > 0 && x - lastX < 0.35) {
        xs[n - 1] = x;
        ys[n - 1] = y;
        lastX = x;
        continue;
      }
      xs[n] = x;
      ys[n] = y;
      lastX = x;
      n++;
    }

    if (hasTip && tipT >= tArr[len - 1]!) {
      const x = PAD.l + (tipT - xMin) * xScale;
      const y = PAD.t + (1 - (tipV - yLo) / ySpan) * plotH;
      if (n > 0 && x - lastX < 0.35) {
        xs[n - 1] = x;
        ys[n - 1] = y;
      } else if (n < SCRATCH_XY_CAP) {
        xs[n] = x;
        ys[n] = y;
        n++;
      }
    }

    if (n > 0) {
      this.scratchTipX = xs[n - 1]!;
      this.scratchTipY = ys[n - 1]!;
    }
    this.scratchN = n;
    this.scratchCount = n;
  }

  /** Catmull-Rom → cubic Bézier, GC-free from scratch buffers. */
  private strokeSmoothScratch(ctx: CanvasRenderingContext2D) {
    const n = this.scratchN;
    const xs = this.scratchX;
    const ys = this.scratchY;
    if (n < 2) return;
    ctx.beginPath();
    ctx.moveTo(xs[0]!, ys[0]!);
    if (n === 2) {
      ctx.lineTo(xs[1]!, ys[1]!);
      ctx.stroke();
      return;
    }
    for (let i = 0; i < n - 1; i++) {
      const i0 = i === 0 ? 0 : i - 1;
      const i1 = i;
      const i2 = i + 1;
      const i3 = i + 2 < n ? i + 2 : i2;
      const p0x = xs[i0]!;
      const p0y = ys[i0]!;
      const p1x = xs[i1]!;
      const p1y = ys[i1]!;
      const p2x = xs[i2]!;
      const p2y = ys[i2]!;
      const p3x = xs[i3]!;
      const p3y = ys[i3]!;

      let cp1x = p1x + (p2x - p0x) / 8;
      let cp2x = p2x - (p3x - p1x) / 8;
      cp1x = Math.min(p2x - 0.05, Math.max(p1x + 0.05, cp1x));
      cp2x = Math.min(p2x - 0.05, Math.max(p1x + 0.05, cp2x));

      let cp1y = p1y + (p2y - p0y) / 8;
      let cp2y = p2y - (p3y - p1y) / 8;
      const yLoSeg = p1y < p2y ? p1y : p2y;
      const yHiSeg = p1y > p2y ? p1y : p2y;
      // Tight clamp — less overshoot / “lag bounce” on reversals
      const slack = Math.max(1.2, (yHiSeg - yLoSeg) * 0.06 + 0.8);
      cp1y = Math.min(yHiSeg + slack, Math.max(yLoSeg - slack, cp1y));
      cp2y = Math.min(yHiSeg + slack, Math.max(yLoSeg - slack, cp2y));

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y);
    }
    ctx.stroke();
  }

  private fillScratch(
    ctx: CanvasRenderingContext2D,
    bottomY: number,
    grad: CanvasGradient | null,
    fallback: string,
  ) {
    const n = this.scratchN;
    const xs = this.scratchX;
    const ys = this.scratchY;
    if (n < 2) return;
    ctx.beginPath();
    ctx.moveTo(xs[0]!, ys[0]!);
    for (let i = 1; i < n; i++) {
      ctx.lineTo(xs[i]!, ys[i]!);
    }
    ctx.lineTo(xs[n - 1]!, bottomY);
    ctx.lineTo(xs[0]!, bottomY);
    ctx.closePath();
    ctx.fillStyle = grad ?? fallback;
    ctx.fill();
  }

  private paintOneSeries(
    ctx: CanvasRenderingContext2D,
    series: SeriesBuf,
    tipV: number,
    hasTip: boolean,
    stroke: string,
    fillFallback: string,
    grad: CanvasGradient | null,
    width: number,
    alpha: number,
    tipT: number,
    plotW: number,
    plotH: number,
    bottomY: number,
  ) {
    this.projectCulled(
      series,
      tipT,
      tipV,
      hasTip,
      this.xMin,
      this.xMax,
      this.yLo,
      this.yHi,
      plotW,
      plotH,
    );
    if (this.scratchN < 2) return;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Fill under (soft gradient)
    ctx.globalAlpha = alpha;
    this.fillScratch(ctx, bottomY, grad, fillFallback);

    // Dark understroke for overlap clarity
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = "rgba(6,10,18,0.95)";
    ctx.lineWidth = width + 1.6;
    this.strokeSmoothScratch(ctx);

    // Main smooth stroke
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    this.strokeSmoothScratch(ctx);
  }

  private drawTipDot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
  ) {
    ctx.beginPath();
    ctx.arc(x, y, 5.2, 0, 6.283185307179586);
    ctx.fillStyle = "rgba(6,10,18,0.95)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 3.1, 0, 6.283185307179586);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private paint(frameNow: number) {
    if (!this.sizeReady) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const dt = Math.min(0.05, (frameNow - this.lastFrame) / 1000);
    this.lastFrame = frameNow;

    const feed = this.feed.current;
    this.ensureRound(feed);
    this.syncColors(feed.colorA, feed.colorB);

    // --- Time-based chart clock (independent of tick jitter) ---
    if (!this.clockSynced) {
      this.chartNow = Math.min(feed.nowMs, feed.endsAtMs);
      this.clockSynced = true;
    } else {
      this.chartNow += dt * 1000;
      const feedNow = Math.min(feed.nowMs, feed.endsAtMs);
      const drift = feedNow - this.chartNow;
      // Soft-correct toward server clock; hard-snap if wildly off
      if (drift > 2500 || drift < -2500) {
        this.chartNow = feedNow;
      } else {
        this.chartNow += drift * CLOCK_SYNC_K;
      }
      if (this.chartNow > feed.endsAtMs) this.chartNow = feed.endsAtMs;
      if (this.chartNow < feed.startsAtMs) this.chartNow = feed.startsAtMs;
    }

    const tipT = this.chartNow;
    const start = feed.startsAtMs;

    // Live targets
    this.hasTargetA = false;
    this.hasTargetB = false;
    if (feed.openA && feed.liveA != null && feed.openA > 0) {
      this.targetA = ((feed.liveA - feed.openA) / feed.openA) * 100;
      this.hasTargetA = true;
    }
    if (feed.openB && feed.liveB != null && feed.openB > 0) {
      this.targetB = ((feed.liveB - feed.openB) / feed.openB) * 100;
      this.hasTargetB = true;
    }

    // Time-based tip lerp — snap harder on reverses / large jumps
    if (this.hasTargetA) {
      if (!this.tipReady) {
        this.dispA = this.targetA;
      } else {
        const err = this.targetA - this.dispA;
        const tau = Math.abs(err) > 0.04 ? TIP_TAU_S * 0.45 : TIP_TAU_S;
        const tipK = 1 - Math.exp(-dt / tau);
        this.dispA += err * tipK;
      }
    }
    if (this.hasTargetB) {
      if (!this.tipReady) {
        this.dispB = this.targetB;
      } else {
        const err = this.targetB - this.dispB;
        const tau = Math.abs(err) > 0.04 ? TIP_TAU_S * 0.45 : TIP_TAU_S;
        const tipK = 1 - Math.exp(-dt / tau);
        this.dispB += err * tipK;
      }
    }
    if (this.hasTargetA || this.hasTargetB) this.tipReady = true;

    this.ingest(this.seriesA, feed.ticksA);
    this.ingest(this.seriesB, feed.ticksB);
    this.seriesA.ensureOrigin();
    this.seriesB.ensureOrigin();

    this.seriesA.trimBefore(tipT - LOOKBACK_MS - 8_000);
    this.seriesB.trimBefore(tipT - LOOKBACK_MS - 8_000);

    // X window locked to wall clock tip — scrolls left even if socket stalls
    const lookback = Math.min(LOOKBACK_MS, Math.max(12_000, tipT - start));
    this.xMin = Math.max(start, tipT - lookback);
    const spanMs = Math.max(2_500, tipT - this.xMin);
    const futurePadMs =
      (spanMs * TIP_RIGHT_GAP) / Math.max(0.05, 1 - TIP_RIGHT_GAP);
    this.xMax = tipT + futurePadMs;

    // Y suggested from culled samples (no arrays)
    let dataLo = 0;
    let dataHi = 0;
    const scanY = (s: SeriesBuf) => {
      const n = s.len;
      if (n <= 0) return;
      let i0 = lowerBoundT(s.t, n, this.xMin) - 1;
      let i1 = upperBoundT(s.t, n, this.xMax);
      if (i0 < 0) i0 = 0;
      if (i1 >= n) i1 = n - 1;
      for (let i = i0; i <= i1; i++) {
        const vv = s.v[i]!;
        if (vv < dataLo) dataLo = vv;
        if (vv > dataHi) dataHi = vv;
      }
    };
    scanY(this.seriesA);
    scanY(this.seriesB);
    if (this.hasTargetA) {
      if (this.dispA < dataLo) dataLo = this.dispA;
      if (this.dispA > dataHi) dataHi = this.dispA;
    }
    if (this.hasTargetB) {
      if (this.dispB < dataLo) dataLo = this.dispB;
      if (this.dispB > dataHi) dataHi = this.dispB;
    }

    let span = dataHi - dataLo;
    if (span < Y_MIN_SPAN) span = Y_MIN_SPAN;
    const pad = span * Y_PAD_RATIO;
    this.ySugLo = dataLo - pad;
    this.ySugHi = dataHi + pad;
    if (this.ySugHi - this.ySugLo < Y_MIN_SPAN) {
      const mid = (this.ySugHi + this.ySugLo) * 0.5;
      this.ySugLo = mid - Y_MIN_SPAN * 0.5;
      this.ySugHi = mid + Y_MIN_SPAN * 0.5;
    }

    if (!this.yReady) {
      this.yLo = this.ySugLo;
      this.yHi = this.ySugHi;
      this.yReady = true;
    } else {
      const expand =
        this.ySugLo < this.yLo - 1e-9 || this.ySugHi > this.yHi + 1e-9;
      const rate = expand ? 2.4 : 0.55;
      const yK = 1 - Math.exp(-dt * rate);
      this.yLo += (this.ySugLo - this.yLo) * yK;
      this.yHi += (this.ySugHi - this.yHi) * yK;
    }
    if (this.yHi - this.yLo < Y_MIN_SPAN) {
      const mid = (this.yHi + this.yLo) * 0.5;
      this.yLo = mid - Y_MIN_SPAN * 0.5;
      this.yHi = mid + Y_MIN_SPAN * 0.5;
    }

    const cssW = this.cssW;
    const cssH = this.cssH;
    const dpr = this.dpr;
    // DPR scale once per frame
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const plotW = cssW - PAD.l - PAD.r;
    const plotH = cssH - PAD.t - PAD.b;
    if (plotW < 1 || plotH < 1) return;

    const bottomY = PAD.t + plotH;
    const xSpan = this.xMax - this.xMin;

    this.ensureGradients(ctx, bottomY);

    ctx.clearRect(0, 0, cssW, cssH);

    // Zero line — crisp grid only (series uses float coords)
    const zeroY =
      Math.floor(PAD.t + (1 - (0 - this.yLo) / (this.yHi - this.yLo)) * plotH) +
      0.5;
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l + 0.5, zeroY);
    ctx.lineTo(PAD.l + plotW + 0.5, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    const aLeads = this.dispA >= this.dispB;

    // Trailing first, leader on top — smooth Catmull + gradient fill
    if (aLeads) {
      this.paintOneSeries(
        ctx,
        this.seriesB,
        this.dispB,
        this.hasTargetB,
        this.colorB,
        this.fillB,
        this.gradB,
        1.7,
        0.72,
        tipT,
        plotW,
        plotH,
        bottomY,
      );
      this.tipBX = this.scratchTipX;
      this.tipBY = this.scratchTipY;
      this.hasTipDotB = this.scratchCount >= 1;

      this.paintOneSeries(
        ctx,
        this.seriesA,
        this.dispA,
        this.hasTargetA,
        this.colorA,
        this.fillA,
        this.gradA,
        2.35,
        1,
        tipT,
        plotW,
        plotH,
        bottomY,
      );
      this.tipAX = this.scratchTipX;
      this.tipAY = this.scratchTipY;
      this.hasTipDotA = this.scratchCount >= 1;
    } else {
      this.paintOneSeries(
        ctx,
        this.seriesA,
        this.dispA,
        this.hasTargetA,
        this.colorA,
        this.fillA,
        this.gradA,
        1.7,
        0.72,
        tipT,
        plotW,
        plotH,
        bottomY,
      );
      this.tipAX = this.scratchTipX;
      this.tipAY = this.scratchTipY;
      this.hasTipDotA = this.scratchCount >= 1;

      this.paintOneSeries(
        ctx,
        this.seriesB,
        this.dispB,
        this.hasTargetB,
        this.colorB,
        this.fillB,
        this.gradB,
        2.35,
        1,
        tipT,
        plotW,
        plotH,
        bottomY,
      );
      this.tipBX = this.scratchTipX;
      this.tipBY = this.scratchTipY;
      this.hasTipDotB = this.scratchCount >= 1;
    }

    ctx.globalAlpha = 1;

    if (aLeads) {
      if (this.hasTipDotB) {
        this.drawTipDot(ctx, this.tipBX, this.tipBY, this.colorB);
      }
      if (this.hasTipDotA) {
        this.drawTipDot(ctx, this.tipAX, this.tipAY, this.colorA);
      }
    } else {
      if (this.hasTipDotA) {
        this.drawTipDot(ctx, this.tipAX, this.tipAY, this.colorA);
      }
      if (this.hasTipDotB) {
        this.drawTipDot(ctx, this.tipBX, this.tipBY, this.colorB);
      }
    }

    // Scrub — show only the snake nearest to the cursor
    const scrubFrac = this.scrubFrac;
    const tipEl = this.scrubTip;
    if (
      scrubFrac != null &&
      (this.seriesA.len >= 1 || this.seriesB.len >= 1 || this.hasTargetA || this.hasTargetB)
    ) {
      const scrubT = this.xMin + scrubFrac * xSpan;
      const scrubX =
        Math.floor(PAD.l + ((scrubT - this.xMin) / xSpan) * plotW) + 0.5;
      const ySpan = this.yHi - this.yLo;
      const vA = sampleSeries(
        this.seriesA.t,
        this.seriesA.v,
        this.seriesA.len,
        scrubT,
      );
      const vB = sampleSeries(
        this.seriesB.t,
        this.seriesB.v,
        this.seriesB.len,
        scrubT,
      );
      const hasA = this.seriesA.len > 0 || this.hasTargetA;
      const hasB = this.seriesB.len > 0 || this.hasTargetB;
      const yA = hasA
        ? PAD.t + (1 - (vA - this.yLo) / ySpan) * plotH
        : 1e9;
      const yB = hasB
        ? PAD.t + (1 - (vB - this.yLo) / ySpan) * plotH
        : 1e9;

      const cy = this.scrubY != null ? this.scrubY : (yA + yB) * 0.5;
      let side: 0 | 1 = 0;
      if (!hasA && hasB) side = 1;
      else if (hasA && !hasB) side = 0;
      else {
        side = Math.abs(cy - yA) <= Math.abs(cy - yB) ? 0 : 1;
      }

      const pct = side === 0 ? vA : vB;
      const hitY = side === 0 ? yA : yB;
      const hitColor = side === 0 ? this.colorA : this.colorB;
      this.scrubHudSide = side;
      this.scrubHudPct = pct;
      this.scrubHudT = scrubT;

      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scrubX, PAD.t + 0.5);
      ctx.lineTo(scrubX, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight only the hovered snake
      const hy = Math.floor(hitY) + 0.5;
      ctx.beginPath();
      ctx.arc(scrubX, hy, 5.5, 0, 6.283185307179586);
      ctx.fillStyle = "rgba(6,10,18,0.95)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(scrubX, hy, 3.4, 0, 6.283185307179586);
      ctx.fillStyle = hitColor;
      ctx.fill();

      if (this.scrubTime) {
        this.scrubTime.textContent = fmtClock(scrubT);
      }
      if (frameNow - this.lastScrubUiAt > 50) {
        this.lastScrubUiAt = frameNow;
        this.scrubHudOn = true;
        this.onScrubHud({
          side: side === 0 ? "A" : "B",
          pct,
          t: scrubT,
        });
      }
      if (tipEl) {
        tipEl.dataset.on = "1";
        tipEl.dataset.side = side === 0 ? "a" : "b";
        const tipW = tipEl.offsetWidth || 120;
        const tipH = tipEl.offsetHeight || 52;
        const left = Math.min(
          Math.max(10, scrubX + 14),
          Math.max(10, cssW - tipW - 10),
        );
        const top = Math.min(
          Math.max(PAD.t, hy - tipH * 0.5),
          Math.max(PAD.t, cssH - tipH - 8),
        );
        tipEl.style.left = left + "px";
        tipEl.style.top = top + "px";
      }
    } else {
      if (tipEl) {
        delete tipEl.dataset.on;
        delete tipEl.dataset.side;
      }
      if (this.scrubHudOn) {
        this.scrubHudOn = false;
        this.onScrubHud(null);
      }
    }
  }
}

const FLOW_PLUGINS = [continuous];
const FLOW_SPIN = {
  duration: 380,
  easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
} as const;

function FlowPct({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <span>—</span>;
  }
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return (
    <NumberFlow
      className={styles.flowNum}
      value={Math.abs(value)}
      locales="en-US"
      prefix={sign}
      suffix="%"
      format={{
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
        useGrouping: false,
      }}
      plugins={FLOW_PLUGINS}
      willChange
      spinTiming={FLOW_SPIN}
      transformTiming={FLOW_SPIN}
      opacityTiming={{ duration: 160, easing: "ease-out" }}
      style={{
        color: value >= 0 ? "#0ecb81" : "#f6465d",
      }}
    />
  );
}

function RaceChartInner({
  ticksA,
  ticksB,
  openA,
  openB,
  liveA,
  liveB,
  startsAtMs,
  endsAtMs,
  nowMs,
  colorA,
  colorB,
  shortA,
  shortB,
  logoA,
  logoB,
}: {
  ticksA: RaceTick[];
  ticksB: RaceTick[];
  openA: number | null;
  openB: number | null;
  liveA: number | null;
  liveB: number | null;
  startsAtMs: number;
  endsAtMs: number;
  nowMs: number;
  colorA: string;
  colorB: string;
  shortA: string;
  shortB: string;
  logoA?: string;
  logoB?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrubTipRef = useRef<HTMLDivElement | null>(null);
  const scrubTimeRef = useRef<HTMLSpanElement | null>(null);
  const engineRef = useRef<RaceChartEngine | null>(null);

  const feedRef = useRef<FeedSnap>({
    ticksA,
    ticksB,
    openA,
    openB,
    liveA,
    liveB,
    startsAtMs,
    endsAtMs,
    nowMs,
    colorA,
    colorB,
  });
  feedRef.current = {
    ticksA,
    ticksB,
    openA,
    openB,
    liveA,
    liveB,
    startsAtMs,
    endsAtMs,
    nowMs,
    colorA,
    colorB,
  };

  const [scrubHud, setScrubHud] = useState<{
    side: "A" | "B";
    pct: number;
    t: number;
  } | null>(null);

  const curPctA =
    openA && liveA != null ? ((liveA - openA) / openA) * 100 : null;
  const curPctB =
    openB && liveB != null ? ((liveB - openB) / openB) * 100 : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const engine = new RaceChartEngine(
      canvas,
      wrap,
      feedRef,
      scrubTipRef.current,
      scrubTimeRef.current,
      setScrubHud,
    );
    engineRef.current = engine;

    const applySize = () => {
      engine.setSize(wrap.clientWidth || 640, wrap.clientHeight || 240);
    };
    applySize();

    let resizeRaf = 0;
    const scheduleResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        applySize();
      });
    };
    const settleResize = debounce(applySize, RESIZE_DEBOUNCE_MS);

    const ro = new ResizeObserver(() => {
      scheduleResize();
      settleResize();
    });
    ro.observe(wrap);

    engine.start();

    return () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      settleResize.cancel();
      ro.disconnect();
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const setScrubFromClient = (clientX: number, clientY: number) => {
    const el = wrapRef.current;
    const engine = engineRef.current;
    if (!el || !engine) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const plotL = PAD.l;
    const plotR = rect.width - PAD.r;
    const frac = (x - plotL) / Math.max(1, plotR - plotL);
    engine.setScrub(Math.max(0, Math.min(1, frac)), y);
  };

  const clearScrub = () => {
    engineRef.current?.setScrub(null, null);
  };

  const scrubSide = scrubHud?.side ?? null;
  const scrubPct = scrubHud?.pct ?? null;
  const scrubColor = scrubSide === "B" ? colorB : colorA;
  const scrubShort = scrubSide === "B" ? shortB : shortA;
  const scrubLogo = scrubSide === "B" ? logoB : logoA;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setScrubFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (
          e.pointerType === "mouse" ||
          e.currentTarget.hasPointerCapture(e.pointerId)
        ) {
          setScrubFromClient(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") clearScrub();
      }}
      onPointerLeave={() => clearScrub()}
      onPointerCancel={() => clearScrub()}
    >
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.legend}>
        <div className={styles.legendRow}>
          <span className={styles.legendDot} style={{ background: colorA }} />
          <span className={styles.legendName} style={{ color: colorA }}>
            {shortA}
          </span>
          <span className={styles.legendPct}>
            <FlowPct value={curPctA} />
          </span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendDot} style={{ background: colorB }} />
          <span className={styles.legendName} style={{ color: colorB }}>
            {shortB}
          </span>
          <span className={styles.legendPct}>
            <FlowPct value={curPctB} />
          </span>
        </div>
      </div>

      <div ref={scrubTipRef} className={styles.scrubTip} aria-hidden>
        <div className={styles.scrubRow}>
          {scrubLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scrubLogo}
              alt=""
              width={16}
              height={16}
              className={styles.scrubLogo}
              draggable={false}
            />
          ) : (
            <span
              className={styles.scrubDot}
              style={{ background: scrubColor }}
            />
          )}
          <span className={styles.scrubName} style={{ color: scrubColor }}>
            {scrubShort}
          </span>
          <span className={styles.scrubPct}>
            <FlowPct value={scrubPct} />
          </span>
        </div>
        <span ref={scrubTimeRef} className={styles.scrubTime}>
          —
        </span>
      </div>
    </div>
  );
}

export const RaceChart = memo(RaceChartInner);
