"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BtcTick } from "../api/client";
import styles from "./BtcChart.module.css";

export type ChartPosition = {
  id: number;
  side: "UP" | "DOWN";
  stake: number;
  entryPrice: number;
  placedAtMs: number;
  winning: boolean | null;
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
};

type Pt = { x: number; y: number };

function strokeSmooth(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  // Deliberately use direct segments: distinct ridges and falls instead of a wave.
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.stroke();
}

function densifyTicks(ticks: BtcTick[], perGap = 3): BtcTick[] {
  if (ticks.length < 2) return ticks;
  const out: BtcTick[] = [ticks[0]!];
  for (let i = 1; i < ticks.length; i++) {
    const a = ticks[i - 1]!;
    const b = ticks[i]!;
    for (let j = 1; j <= perGap; j++) {
      const k = j / (perGap + 1);
      out.push({
        t: a.t + (b.t - a.t) * k,
        p: a.p + (b.p - a.p) * k,
      });
    }
    out.push(b);
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

function formatUsd(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatCountdownShort(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}:${r.toString().padStart(2, "0")}`;
  return `:${r.toString().padStart(2, "0")}`;
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

type Ripple = { born: number; dir: 1 | -1 };
type TrailPt = { x: number; y: number; born: number };

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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef(0);
  const smoothPriceRef = useRef<number | null>(livePrice);
  const smoothVelRef = useRef(0);
  const smoothTimeRef = useRef(Date.now());
  const boundsRef = useRef({ half: 0, ready: false });
  const manualRangeScaleRef = useRef(1);
  const accentMixRef = useRef(0.5);
  const flashRef = useRef(0);
  const tipKickPxRef = useRef(0);
  const crossFlashRef = useRef(0);
  const lastWinningRef = useRef<boolean | null>(null);
  const tickDirRef = useRef<1 | -1 | 0>(0);
  const lastLiveSampleRef = useRef<number | null>(livePrice);
  const ripplesRef = useRef<Ripple[]>([]);
  const trailRef = useRef<TrailPt[]>([]);
  const moodRef = useRef<"up" | "down" | "tick-up" | "tick-down">("up");
  const [pricePulse, setPricePulse] = useState<"up" | "down" | null>(null);
  const [zoomLabel, setZoomLabel] = useState(100);

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
  };

  useEffect(() => {
    boundsRef.current = { half: 0, ready: false };
    trailRef.current = [];
    ripplesRef.current = [];
    flashRef.current = 0;
    tipKickPxRef.current = 0;
    smoothVelRef.current = 0;
  }, [startsAtMs]);

  const upNow = useMemo(() => {
    if (openPrice == null || livePrice == null) return true;
    return livePrice >= openPrice;
  }, [openPrice, livePrice]);

  const activePosition = useMemo(
    () => [...positions].sort((a, b) => b.placedAtMs - a.placedAtMs)[0] ?? null,
    [positions],
  );
  const positionMovePct =
    activePosition && livePrice != null
      ? ((livePrice - activePosition.entryPrice) / activePosition.entryPrice) *
        (activePosition.side === "UP" ? 100 : -100)
      : null;
  const nearEntry =
    activePosition && livePrice != null
      ? Math.abs(livePrice - activePosition.entryPrice) / activePosition.entryPrice <= 0.0005
      : false;

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
        lockAtMs: lockT,
        msToLock: toLock,
        msToEnd: toEnd,
        bettingOpen: betsOpen,
        positions: posList,
      } = latestRef.current;

      const now = Date.now();
      const dt = Math.min(32, now - smoothTimeRef.current);
      smoothTimeRef.current = now;

      if (live != null) {
        const prev = smoothPriceRef.current ?? live;
        if (
          lastLiveSampleRef.current != null &&
          live !== lastLiveSampleRef.current &&
          Math.abs(live - lastLiveSampleRef.current) > 0.00001
        ) {
          const dir: 1 | -1 = live > lastLiveSampleRef.current ? 1 : -1;
          tickDirRef.current = dir;
          flashRef.current = 0.72;
          // A real micro-tick can be sub-pixel on BTC. Give the live tip a short,
          // directional pixel impulse while keeping all numeric prices untouched.
          const kick = dir > 0 ? -8 : 8;
          tipKickPxRef.current = Math.max(
            -18,
            Math.min(18, tipKickPxRef.current * 0.35 + kick),
          );
          // Smooth interpolation: price movement remains readable on larger ticks.
          smoothVelRef.current += (live - lastLiveSampleRef.current) * 0.06;
        }
        lastLiveSampleRef.current = live;
        // Critically damped movement: no visible bounce or sudden cliffs.
        const spring = 0.055;
        const damp = 0.91;
        smoothVelRef.current =
          smoothVelRef.current * damp + (live - prev) * spring;
        // Cap velocity so big $ dumps don't look like a cliff
        const maxStep = Math.max(Math.abs(live - prev) * 0.1, 0.18);
        if (smoothVelRef.current > maxStep) smoothVelRef.current = maxStep;
        if (smoothVelRef.current < -maxStep) smoothVelRef.current = -maxStep;
        let next = prev + smoothVelRef.current;
        next = expSmooth(next, live, dt, 520);
        smoothPriceRef.current = next;
      }

      flashRef.current = Math.max(0, flashRef.current - dt / 500);
      tipKickPxRef.current = expSmooth(tipKickPxRef.current, 0, dt, 170);
      crossFlashRef.current = Math.max(0, crossFlashRef.current - dt / 620);

      const smoothLive = smoothPriceRef.current ?? live;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = wrap.clientWidth || 640;
      const cssH = wrap.clientHeight || 360;

      if (
        canvas.width !== Math.floor(cssW * dpr) ||
        canvas.height !== Math.floor(cssH * dpr)
      ) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = { t: 96, r: 72, b: 44, l: 16 };
      const w = Math.max(1, cssW - pad.l - pad.r);
      const h = Math.max(1, cssH - pad.t - pad.b);

      ctx.clearRect(0, 0, cssW, cssH);

      ctx.fillStyle = "#0c0f15";
      ctx.fillRect(0, 0, cssW, cssH);

      // Keep a moving, tight window around "now": real ticks feel like movement
      // instead of being compressed into the full 5/15 minute round.
      const roundSpan = Math.max(60_000, t1 - t0);
      const lookback = Math.min(
        roundSpan,
        roundSpan <= 60_000 ? 38_000 : roundSpan <= 300_000 ? 72_000 : 105_000,
      );
      const futureRoom = Math.min(18_000, lookback * 0.18);
      const viewStart = Math.max(t0, now - lookback);
      const viewEnd = Math.min(t1, Math.max(now + futureRoom, viewStart + lookback));

      const windowTicks = rawTicks.filter(
        (x) => x.t >= viewStart - 1_000 && x.t <= now + 2_000,
      );

      let ptsRaw =
        windowTicks.length >= 2 ? windowTicks : rawTicks.slice(-90);

      if (smoothLive != null && ptsRaw.length) {
        const last = ptsRaw[ptsRaw.length - 1]!;
        ptsRaw = [
          ...ptsRaw.slice(0, -1),
          { t: last.t, p: last.p },
          { t: now, p: smoothLive },
        ];
      } else if (smoothLive != null) {
        ptsRaw = [
          { t: now - 2_000, p: smoothLive },
          { t: now, p: smoothLive },
        ];
      }

      // Binance ticks remain raw: every ridge and drop comes from real price data.
      ptsRaw = downsample(ptsRaw, 480);

      if (ptsRaw.length < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("Ожидание цены…", pad.l + 8, cssH / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const prices = ptsRaw.map((p) => p.p);
      if (smoothLive != null) prices.push(smoothLive);
      if (open != null) prices.push(open);
      for (const pos of posList) prices.push(pos.entryPrice);

      const latestPos = posList.length
        ? [...posList].sort((a, b) => b.placedAtMs - a.placedAtMs)[0]!
        : null;
      const center =
        latestPos?.entryPrice ??
        open ??
        (smoothLive != null
          ? smoothLive
          : prices.reduce((a, b) => a + b, 0) / Math.max(1, prices.length));

      // Tight adaptive range makes ordinary real ticks readable and energetic.
      const recentCut = now - Math.min(28_000, lookback * 0.55);
      let recentDev = 0;
      for (const pt of ptsRaw) {
        if (pt.t < recentCut) continue;
        recentDev = Math.max(recentDev, Math.abs(pt.p - center));
      }
      if (smoothLive != null) {
        recentDev = Math.max(recentDev, Math.abs(smoothLive - center));
      }
      for (const pos of posList) {
        recentDev = Math.max(recentDev, Math.abs(pos.entryPrice - center));
      }
      const zoomMultiplier = mode === "detail" ? 0.82 : 1.02;
      const zoomFloor = Math.max(
        center * (mode === "detail" ? 0.000035 : 0.00005),
        mode === "detail" ? 2.5 : 3.5,
      );
      const zoomCeil = Math.max(center * 0.0008, 60);
      const targetHalf = Math.min(zoomCeil, Math.max(recentDev * zoomMultiplier, zoomFloor));

      if (!boundsRef.current.ready) {
        boundsRef.current = { half: targetHalf, ready: true };
      } else if (targetHalf < boundsRef.current.half) {
        // Zoom in slowly to prevent the camera from breathing.
        boundsRef.current.half = expSmooth(
          boundsRef.current.half,
          targetHalf,
          dt,
          1_350,
        );
      } else {
        // Zoom out quickly to keep a sharp move inside its frame.
        boundsRef.current.half = expSmooth(
          boundsRef.current.half,
          targetHalf,
          dt,
          150,
        );
      }

      const halfRange = Math.max(
        boundsRef.current.half * manualRangeScaleRef.current,
        1e-9,
      );
      const midY = pad.t + h / 2;
      const viewSpan = Math.max(1, viewEnd - viewStart);

      const xAt = (t: number) =>
        pad.l + ((Math.min(Math.max(t, viewStart), viewEnd) - viewStart) / viewSpan) * w;
      const yAt = (p: number) =>
        midY - ((p - center) / halfRange) * (h * (mode === "detail" ? 0.47 : 0.4));

      const last = ptsRaw[ptsRaw.length - 1]!;
      const aboveStrike = last.p >= center;
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
      const targetMix = positive ? 1 : 0;
      accentMixRef.current = expSmooth(accentMixRef.current, targetMix, dt, 520);
      const flash = flashRef.current;
      const colors = mixColor(
        aboveStrike,
        accentMixRef.current,
        flash,
        tickDirRef.current,
      );
      const accent = colors.main;
      const accentDeep = colors.deep;

      moodRef.current = positive ? "up" : "down";
      if (wrapRef.current) {
        wrapRef.current.dataset.mood = moodRef.current;
      }

      if (mode !== "price") {
        ctx.strokeStyle = "rgba(171,186,208,0.18)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = pad.t + (h * i) / 4;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(pad.l + w, y);
          ctx.stroke();
        }
        for (let i = 0; i <= 5; i++) {
          const x = pad.l + (w * i) / 5;
          ctx.beginPath();
          ctx.moveTo(x, pad.t);
          ctx.lineTo(x, pad.t + h);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(205,215,229,0.52)";
        ctx.font = "500 9px ui-sans-serif, system-ui, sans-serif";
        for (let i = 0; i <= 4; i++) {
          const y = pad.t + (h * i) / 4;
          const value = center + ((midY - y) * halfRange) / (h * 0.4);
          ctx.fillText(formatUsd(value), pad.l + w + 7, y + 3);
        }
      }

      const nowX = xAt(now);
      const lockX = xAt(lockT);
      const endX = xAt(t1);

      // A neutral future region keeps the current tick easy to locate.
      if (nowX < pad.l + w) {
        const future = ctx.createLinearGradient(nowX, 0, pad.l + w, 0);
        const finalPhase = toEnd <= 30_000;
        future.addColorStop(0, finalPhase ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.006)");
        future.addColorStop(1, finalPhase ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.018)");
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
        drawVLine(nowX, "rgba(255,255,255,0.46)", true, 1);
      }

      const drawBottomBadge = (
        x: number,
        topText: string,
        bottomText: string,
        bg: string,
        fg: string,
      ) => {
        ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif";
        const tw1 = ctx.measureText(topText).width;
        ctx.font = "800 11px ui-sans-serif, system-ui, sans-serif";
        const tw2 = ctx.measureText(bottomText).width;
        const boxW = Math.max(tw1, tw2) + 14;
        const boxH = 30;
        const boxX = Math.min(Math.max(x - boxW / 2, pad.l), pad.l + w - boxW);
        const boxY = pad.t + h + 4;
        roundRect(ctx, boxX, boxY, boxW, boxH, 5);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(topText, boxX + (boxW - tw1) / 2, boxY + 11);
        ctx.font = "800 11px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(bottomText, boxX + (boxW - tw2) / 2, boxY + 24);
      };

      const endLabel = new Date(t1).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      if (mode !== "price" && betsOpen && lockT >= viewStart && lockT <= viewEnd && lockX > nowX - 4) {
        drawVLine(lockX, "rgba(255,255,255,0.55)", true);
        drawBottomBadge(
          lockX,
          "ЗАКРЫТИЕ",
          formatCountdownShort(toLock),
          "rgba(255,255,255,0.12)",
          "rgba(255,255,255,0.9)",
        );
      }

      if (mode !== "price" && t1 >= viewStart && t1 <= viewEnd) {
        drawVLine(endX, "#f6465d", false, 2);
        drawBottomBadge(
          endX,
          "ФИНИШ",
          formatCountdownShort(toEnd),
          "rgba(246,70,93,0.22)",
          "#ffb4bc",
        );
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 9px ui-sans-serif, system-ui, sans-serif";
        const endTag = endLabel;
        ctx.fillText(endTag, endX - ctx.measureText(endTag).width / 2, pad.t - 6);
      } else if (mode !== "price" && t1 > viewEnd) {
        // Finishing later — keep a finish cue on the right edge
        drawVLine(pad.l + w, "rgba(246,70,93,0.55)", true, 1.5);
        drawBottomBadge(
          pad.l + w - 8,
          "ФИНИШ",
          formatCountdownShort(toEnd),
          "rgba(246,70,93,0.22)",
          "#ffb4bc",
        );
      }

      // Midline = latest entry (or round open). Each bet also draws its own line.
      if (mode !== "price") {
        const strikeY = midY;
        const hasPos = posList.length > 0;
        const entryDistance =
          latestPos && smoothLive != null
            ? Math.abs(smoothLive - latestPos.entryPrice) / latestPos.entryPrice
            : Number.POSITIVE_INFINITY;
        const tension = Math.max(0, 1 - entryDistance / 0.0005);
        const crossFlash = crossFlashRef.current;

        const zone = ctx.createLinearGradient(0, pad.t, 0, pad.t + h);
        zone.addColorStop(0, "rgba(14,203,129,0.07)");
        zone.addColorStop(0.48, "rgba(14,203,129,0.01)");
        zone.addColorStop(0.5, "rgba(0,0,0,0)");
        zone.addColorStop(0.52, "rgba(246,70,93,0.01)");
        zone.addColorStop(1, "rgba(246,70,93,0.07)");
        ctx.fillStyle = zone;
        ctx.fillRect(pad.l, pad.t, w, h);

        // Round open reference (dashed) when different from centered entry
        if (open != null && (!latestPos || Math.abs(open - center) > 0.01)) {
          const openY = yAt(open);
          ctx.save();
          ctx.setLineDash([4, 6]);
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pad.l, openY);
          ctx.lineTo(pad.l + w, openY);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.setLineDash(hasPos ? [] : [5, 7]);
        ctx.strokeStyle = hasPos
          ? latestPos!.winning == null
            ? "#f0b90b"
            : latestPos!.winning
              ? "#0ecb81"
              : "#f6465d"
          : "rgba(255,255,255,0.4)";
        ctx.shadowColor =
          latestPos?.winning === false ? "rgba(246,70,93,0.9)" : "rgba(14,203,129,0.9)";
        ctx.shadowBlur = hasPos ? 4 + tension * 14 + crossFlash * 22 : 0;
        ctx.globalAlpha = 0.72 + Math.sin(now / 105) * tension * 0.28;
        ctx.lineWidth = hasPos ? 2.25 + tension * 1.8 + crossFlash * 2 : 1.25;
        ctx.beginPath();
        ctx.moveTo(pad.l, strikeY);
        ctx.lineTo(pad.l + w, strikeY);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.font = "600 9px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("▲ ВВЕРХ", pad.l + 6, strikeY - 8);
        ctx.fillText("▼ ВНИЗ", pad.l + 6, strikeY + 16);

        // Every pending bet: own fixation line at its entry price
        for (const pos of posList) {
          const py = yAt(pos.entryPrice);
          const sideColor = pos.side === "UP" ? "#0ecb81" : "#f6465d";
          const lineColor =
            pos.winning == null
              ? sideColor
              : pos.winning
                ? "#0ecb81"
                : "#f6465d";
          const isLatest = latestPos?.id === pos.id;

          ctx.save();
          ctx.setLineDash(isLatest ? [] : [3, 5]);
          ctx.strokeStyle = lineColor;
          ctx.globalAlpha = isLatest ? 1 : 0.7;
          ctx.lineWidth = isLatest ? 2 : 1.25;
          ctx.beginPath();
          ctx.moveTo(pad.l, py);
          ctx.lineTo(pad.l + w, py);
          ctx.stroke();
          ctx.restore();

          const entryX = xAt(pos.placedAtMs);
          const badgeW = 62;
          const badgeH = 22;
          const bx = Math.min(
            Math.max(entryX - badgeW / 2, pad.l),
            pad.l + w - badgeW,
          );
          const by = py - badgeH / 2;
          roundRect(ctx, bx, by, badgeW, badgeH, 6);
          ctx.fillStyle = sideColor;
          ctx.fill();
          ctx.fillStyle = pos.side === "UP" ? "#04120a" : "#1a0507";
          ctx.font = "800 10px ui-sans-serif, system-ui, sans-serif";
          const stakeTxt =
            pos.stake >= 1000
              ? `${Math.round(pos.stake / 100) / 10}k`
              : String(Math.round(pos.stake));
          const arrow = pos.side === "UP" ? "▲" : "▼";
          ctx.fillText(`${stakeTxt} ${arrow}`, bx + 7, by + 15);

          ctx.beginPath();
          ctx.arc(entryX, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = sideColor;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(entryX, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
        }
      }

      const plot: Pt[] = ptsRaw.map((pt) => ({ x: xAt(pt.t), y: yAt(pt.p) }));
      const kickPx = tipKickPxRef.current;
      const kickStart = Math.max(0, plot.length - 5);
      for (let i = kickStart; i < plot.length; i++) {
        const weight = (i - kickStart + 1) / (plot.length - kickStart);
        plot[i]!.y += kickPx * weight * weight;
      }

      // Minimal area tint keeps the price legible without a game-like glow.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(plot[0]!.x, plot[0]!.y);
      for (let i = 1; i < plot.length; i++) {
        ctx.lineTo(plot[i]!.x, plot[i]!.y);
      }

      const lastPt = plot[plot.length - 1]!;
      const firstPt = plot[0]!;
      ctx.lineTo(lastPt.x, midY);
      ctx.lineTo(firstPt.x, midY);
      ctx.closePath();

      const area = ctx.createLinearGradient(0, pad.t, 0, pad.t + h);
      if (latestPos) {
        const areaColor = positive ? "14,203,129" : "246,70,93";
        area.addColorStop(0, `rgba(${areaColor},0.24)`);
        area.addColorStop(0.58, `rgba(${areaColor},0.08)`);
        area.addColorStop(1, `rgba(${areaColor},0.01)`);
      } else {
        area.addColorStop(0, "rgba(230,235,243,0.18)");
        area.addColorStop(0.52, "rgba(157,170,190,0.07)");
        area.addColorStop(1, "rgba(80,91,109,0.015)");
      }
      ctx.fillStyle = area;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.lineWidth = latestPos ? 2.7 : 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = latestPos
        ? positive
          ? "#0ecb81"
          : "#f6465d"
        : "rgba(239,243,249,0.94)";
      ctx.shadowColor = latestPos
        ? positive
          ? "rgba(14,203,129,0.42)"
          : "rgba(246,70,93,0.42)"
        : "transparent";
      ctx.shadowBlur = latestPos ? 9 : 0;
      strokeSmooth(ctx, plot);
      ctx.restore();

      const mx = lastPt.x;
      const my = lastPt.y;

      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.fillStyle = positive
        ? "rgba(14,203,129,0.16)"
        : "rgba(246,70,93,0.16)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = latestPos ? (positive ? "#0ecb81" : "#f6465d") : accentDeep;
      ctx.fill();

      const drawPill = (
        y: number,
        label: string,
        value: string,
        bgColor: string,
        textColor: string,
      ) => {
        const boxX = pad.l + w + 6;
        const boxW = pad.r - 10;
        const boxH = 32;
        const boxY = Math.min(Math.max(y - boxH / 2, pad.t), pad.t + h - boxH);
        const r = 6;
        ctx.save();
        roundRect(ctx, boxX, boxY, boxW, boxH, r);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(label, boxX + 7, boxY + 11);
        ctx.font = "700 10px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(value, boxX + 7, boxY + 24);
        ctx.restore();
      };

      if (open != null) {
        drawPill(
          midY,
          "STRIKE",
          formatUsd(open),
          "rgba(255,255,255,0.1)",
          "rgba(255,255,255,0.88)",
        );
      }
      drawPill(my, "LIVE", formatUsd(last.p), "rgba(238,242,248,0.92)", "#18202d");

      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.moveTo(pad.l + w, pad.t);
      ctx.lineTo(pad.l + w, pad.t + h);
      ctx.stroke();

      const fmt = (ms: number) =>
        new Date(ms).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "500 10px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(fmt(viewStart), pad.l, cssH - 8);
      const midLabel = fmt(now);
      ctx.fillText(
        midLabel,
        nowX - ctx.measureText(midLabel).width / 2,
        cssH - 8,
      );
      const chartEndLabel = fmt(viewEnd);
      ctx.fillText(
        chartEndLabel,
        pad.l + w - ctx.measureText(chartEndLabel).width,
        cssH - 8,
      );

      if (toEnd <= 30_000) {
        const urgency = Math.max(0, 1 - toEnd / 30_000);
        const pulse = 0.5 + Math.sin(now / Math.max(75, 210 - urgency * 120)) * 0.5;
        ctx.save();
        const vignette = ctx.createRadialGradient(
          cssW / 2,
          cssH / 2,
          Math.min(cssW, cssH) * 0.2,
          cssW / 2,
          cssH / 2,
          Math.max(cssW, cssH) * 0.7,
        );
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, `rgba(246,70,93,${0.08 + urgency * 0.12 + pulse * 0.04})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.strokeStyle = `rgba(246,70,93,${0.22 + urgency * 0.42 + pulse * 0.2})`;
        ctx.lineWidth = 1 + urgency * 2;
        ctx.strokeRect(1, 1, cssW - 2, cssH - 2);
        ctx.restore();
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

  const timerLabel = bettingOpen ? "До закрытия" : "До финиша";
  const timerValue = formatMs(bettingOpen ? msToLock : msToEnd);

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${upNow ? styles.wrapUp : styles.wrapDown} ${
        mode === "price" ? styles.priceMode : ""
      } ${msToEnd <= 30_000 ? styles.finalPhase : ""}`}
    >
      <div className={styles.hud}>
        <div className={styles.hudRow}>
          <div className={styles.hudCol}>
            <span className={styles.hudLabel}>Целевая цена</span>
            <span className={styles.hudTarget}>
              {openPrice != null ? `$${formatUsd(openPrice)}` : "—"}
            </span>
          </div>

          <div className={styles.hudCenter}>
            <div className={styles.hudBrand}>
              <Image
                src="/images/btc-logo.png"
                alt=""
                width={20}
                height={20}
                className={styles.hudLogo}
                aria-hidden
              />
              <span className={styles.hudLive}>
                <i className={styles.liveDot} aria-hidden />
                LIVE
              </span>
            </div>
            <span className={styles.hudRound}>{roundLabel} · 5 мин</span>
            <div
              className={`${styles.hudTimer} ${urgent ? styles.hudTimerUrgent : ""}`}
            >
              <span>{timerLabel}</span>
              <strong>{timerValue}</strong>
            </div>
            <div className={styles.hudProgress}>
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>

          <div className={`${styles.hudCol} ${styles.hudColRight}`}>
            <span className={styles.hudLabel}>Текущая цена</span>
            <span
              className={`${upNow ? styles.hudLivePriceUp : styles.hudLivePriceDown} ${
                pricePulse === "up"
                  ? styles.priceFlashUp
                  : pricePulse === "down"
                    ? styles.priceFlashDown
                    : ""
              }`}
            >
              {livePrice != null ? `$${formatUsd(livePrice)}` : "—"}
              {changePct != null ? (
                <em>
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(3)}%
                </em>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className={styles.canvas} />
      {activePosition && positionMovePct != null ? (
        <div
          className={`${styles.positionScore} ${
            activePosition.winning ? styles.positionScoreWin : styles.positionScoreLose
          } ${nearEntry ? styles.positionScoreTense : ""}`}
        >
          <span>
            {activePosition.side === "UP" ? "↑ РОСТ" : "↓ ПАДЕНИЕ"} ·{" "}
            {activePosition.winning ? "В ПЛЮСЕ" : "В МИНУСЕ"}
          </span>
          <strong>
            {positionMovePct >= 0 ? "+" : ""}
            {positionMovePct.toFixed(3)}%
          </strong>
        </div>
      ) : null}
      {msToEnd > 0 && msToEnd <= 30_000 ? (
        <div className={styles.finalCountdown}>
          <span>{bettingOpen ? "РЕШАЮЩИЕ СЕКУНДЫ" : "ДО РЕЗУЛЬТАТА"}</span>
          <strong>{Math.ceil(msToEnd / 1000)}</strong>
        </div>
      ) : null}
      <span className={styles.zoomHint}>
        Масштаб {zoomLabel}% · колёсико · двойной клик — сброс
      </span>
    </div>
  );
}
