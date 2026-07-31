"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import { LogoWhiteIcon } from "~/shared/assets";

import type { BtcTick } from "../api/client";
import { formatAssetPrice } from "../lib/markets";
import { candleBucketMs, ticksToOhlc } from "../lib/ohlc";
import styles from "./BtcProChart.module.css";

/** Header brand mark (`logoWhite.png`) stamped on saved screenshots. */
const BRAND_LOGO_SRC =
  typeof LogoWhiteIcon === "string"
    ? LogoWhiteIcon
    : (LogoWhiteIcon as { src: string }).src;

export type DrawTool =
  | "cursor"
  | "hline"
  | "trend"
  | "arrowUp"
  | "arrowDown"
  | "eraser";

type TrendDraft = { t1: number; p1: number };

type ArrowMark = {
  id: string;
  dir: "up" | "down";
  time: number;
  price: number;
};

type TrendMark = {
  id: string;
  t1: number;
  p1: number;
  t2: number;
  p2: number;
};

type HLineMark = {
  id: string;
  price: number;
  line: IPriceLine;
};

type Props = {
  ticks: BtcTick[];
  livePrice: number | null;
  openPrice: number | null;
  roundMs: number;
  accentHex?: string;
  labels: {
    live: string;
    pro: string;
    cursor: string;
    hline: string;
    trend: string;
    arrowUp: string;
    arrowDown: string;
    eraser: string;
    clear: string;
    save: string;
    candles: string;
    line: string;
    strike: string;
  };
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

function drawArrowShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: "up" | "down",
  size = 16,
) {
  const up = dir === "up";
  const color = up ? "#0acf97" : "#ef473a";
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(4, 12, 20, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.72, s * 0.15);
    ctx.lineTo(s * 0.28, s * 0.15);
    ctx.lineTo(s * 0.28, s);
    ctx.lineTo(-s * 0.28, s);
    ctx.lineTo(-s * 0.28, s * 0.15);
    ctx.lineTo(-s * 0.72, s * 0.15);
  } else {
    ctx.moveTo(0, s);
    ctx.lineTo(s * 0.72, -s * 0.15);
    ctx.lineTo(s * 0.28, -s * 0.15);
    ctx.lineTo(s * 0.28, -s);
    ctx.lineTo(-s * 0.28, -s);
    ctx.lineTo(-s * 0.28, -s * 0.15);
    ctx.lineTo(-s * 0.72, -s * 0.15);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo_load_failed"));
    img.src = src;
  });
}

export function BtcProChart({
  ticks,
  livePrice,
  openPrice,
  roundMs,
  accentHex = "#f7931a",
  labels,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<ISeriesApi<"Area"> | null>(null);
  const trendSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const strikeLineRef = useRef<IPriceLine | null>(null);
  const hLinesRef = useRef<HLineMark[]>([]);
  const arrowsRef = useRef<ArrowMark[]>([]);
  const trendsRef = useRef<TrendMark[]>([]);
  const [tool, setTool] = useState<DrawTool>("cursor");
  const [seriesMode, setSeriesMode] = useState<"candle" | "line">("candle");
  const [draft, setDraft] = useState<TrendDraft | null>(null);
  const [marksVersion, setMarksVersion] = useState(0);
  const toolRef = useRef(tool);
  const draftRef = useRef(draft);
  const seriesModeRef = useRef(seriesMode);
  toolRef.current = tool;
  draftRef.current = draft;
  seriesModeRef.current = seriesMode;

  const bucketMs = candleBucketMs(roundMs);
  const bars = useMemo(
    () => ticksToOhlc(ticks, bucketMs, livePrice),
    [ticks, bucketMs, livePrice],
  );

  const hostSeries = useCallback(() => {
    return seriesModeRef.current === "candle"
      ? candleRef.current
      : lineRef.current;
  }, []);

  const paintOverlay = useCallback(() => {
    const chart = chartRef.current;
    const canvas = overlayRef.current;
    const wrap = wrapRef.current;
    const series = hostSeries();
    if (!chart || !canvas || !wrap || !series) return;

    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 2 || h < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const timeScale = chart.timeScale();

    for (const tr of trendsRef.current) {
      const x1 = timeScale.timeToCoordinate(tr.t1 as Time);
      const x2 = timeScale.timeToCoordinate(tr.t2 as Time);
      const y1 = series.priceToCoordinate(tr.p1);
      const y2 = series.priceToCoordinate(tr.p2);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
      ctx.save();
      ctx.strokeStyle = "#7ec8ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    for (const a of arrowsRef.current) {
      const x = timeScale.timeToCoordinate(a.time as Time);
      const y = series.priceToCoordinate(a.price);
      if (x == null || y == null) continue;
      drawArrowShape(ctx, x, y, a.dir, 15);
    }
  }, [hostSeries]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b9bb4",
        fontSize: 11,
        fontFamily:
          '"SF Pro Display", "Open Sans", system-ui, -apple-system, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: roundMs <= 300_000,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255,255,255,0.18)",
          labelBackgroundColor: "#1a2438",
        },
        horzLine: {
          color: "rgba(255,255,255,0.18)",
          labelBackgroundColor: "#1a2438",
        },
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#0acf97",
      downColor: "#ef473a",
      borderUpColor: "#0acf97",
      borderDownColor: "#ef473a",
      wickUpColor: "#0acf97",
      wickDownColor: "#ef473a",
    });
    const area = chart.addAreaSeries({
      lineColor: accentHex,
      topColor: `${accentHex}55`,
      bottomColor: `${accentHex}00`,
      lineWidth: 2,
      visible: false,
    });
    const trend = chart.addLineSeries({
      color: "#7ec8ff",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    lineRef.current = area;
    trendSeriesRef.current = trend;

    const onClick = (param: {
      time?: Time;
      point?: { x: number; y: number } | undefined;
    }) => {
      if (!param.point) return;
      const series = hostSeries();
      if (!series) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price == null || !Number.isFinite(price)) return;
      const time =
        param.time != null
          ? Number(param.time)
          : chart.timeScale().coordinateToTime(param.point.x);
      const t = typeof time === "number" ? time : Number(time);
      if (!Number.isFinite(t)) return;

      const toolNow = toolRef.current;

      if (toolNow === "eraser") {
        const hitR = 22;
        let best: { kind: "arrow" | "trend" | "hline"; id: string; d: number } | null =
          null;
        for (const a of arrowsRef.current) {
          const x = chart.timeScale().timeToCoordinate(a.time as Time);
          const y = series.priceToCoordinate(a.price);
          if (x == null || y == null) continue;
          const d = dist(param.point.x, param.point.y, x, y);
          if (d <= hitR && (!best || d < best.d)) {
            best = { kind: "arrow", id: a.id, d };
          }
        }
        for (const tr of trendsRef.current) {
          const x1 = chart.timeScale().timeToCoordinate(tr.t1 as Time);
          const x2 = chart.timeScale().timeToCoordinate(tr.t2 as Time);
          const y1 = series.priceToCoordinate(tr.p1);
          const y2 = series.priceToCoordinate(tr.p2);
          if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const d = Math.min(
            dist(param.point.x, param.point.y, midX, midY),
            dist(param.point.x, param.point.y, x1, y1),
            dist(param.point.x, param.point.y, x2, y2),
          );
          if (d <= hitR && (!best || d < best.d)) {
            best = { kind: "trend", id: tr.id, d };
          }
        }
        for (const hl of hLinesRef.current) {
          const y = series.priceToCoordinate(hl.price);
          if (y == null) continue;
          const d = Math.abs(param.point.y - y);
          if (d <= 10 && (!best || d < best.d)) {
            best = { kind: "hline", id: hl.id, d };
          }
        }
        if (!best) return;
        if (best.kind === "arrow") {
          arrowsRef.current = arrowsRef.current.filter((a) => a.id !== best!.id);
        } else if (best.kind === "trend") {
          trendsRef.current = trendsRef.current.filter((a) => a.id !== best!.id);
          trendSeriesRef.current?.setData([]);
        } else {
          const row = hLinesRef.current.find((h) => h.id === best!.id);
          if (row) {
            try {
              series.removePriceLine(row.line);
            } catch {
              /* ignore */
            }
          }
          hLinesRef.current = hLinesRef.current.filter((h) => h.id !== best!.id);
        }
        setMarksVersion((v) => v + 1);
        return;
      }

      if (toolNow === "hline") {
        const line = series.createPriceLine({
          price,
          color: "#f0b429",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: formatAssetPrice(price),
        });
        hLinesRef.current.push({ id: uid(), price, line });
        setMarksVersion((v) => v + 1);
        return;
      }

      if (toolNow === "arrowUp" || toolNow === "arrowDown") {
        arrowsRef.current.push({
          id: uid(),
          dir: toolNow === "arrowUp" ? "up" : "down",
          time: t,
          price,
        });
        setMarksVersion((v) => v + 1);
        return;
      }

      if (toolNow === "trend") {
        const cur = draftRef.current;
        if (!cur) {
          setDraft({ t1: t, p1: price });
          trend.setData([{ time: t as Time, value: price }]);
          return;
        }
        const t2 = Math.max(t, cur.t1 + 1);
        trendsRef.current.push({
          id: uid(),
          t1: cur.t1,
          p1: cur.p1,
          t2,
          p2: price,
        });
        trend.setData([]);
        setDraft(null);
        setMarksVersion((v) => v + 1);
      }
    };

    chart.subscribeClick(onClick);
    const onRange = () => paintOverlay();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    chart.timeScale().subscribeVisibleTimeRangeChange(onRange);

    const ro = new ResizeObserver(() => paintOverlay());
    ro.observe(el);

    return () => {
      chart.unsubscribeClick(onClick);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      lineRef.current = null;
      trendSeriesRef.current = null;
      strikeLineRef.current = null;
      hLinesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentHex, roundMs, hostSeries, paintOverlay]);

  useEffect(() => {
    const candles = candleRef.current;
    const area = lineRef.current;
    const chart = chartRef.current;
    if (!candles || !area || !chart) return;

    candles.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    area.setData(
      bars.map((b) => ({
        time: b.time as Time,
        value: b.close,
      })),
    );
    candles.applyOptions({ visible: seriesMode === "candle" });
    area.applyOptions({ visible: seriesMode === "line" });

    if (openPrice != null && Number.isFinite(openPrice)) {
      const host = seriesMode === "candle" ? candles : area;
      if (strikeLineRef.current) {
        try {
          host.removePriceLine(strikeLineRef.current);
        } catch {
          /* ignore */
        }
        strikeLineRef.current = null;
      }
      strikeLineRef.current = host.createPriceLine({
        price: openPrice,
        color: "rgba(200,214,230,0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: labels.strike,
      });
    }

    chart.timeScale().scrollToRealTime();
    paintOverlay();
  }, [bars, seriesMode, openPrice, labels.strike, paintOverlay]);

  useEffect(() => {
    paintOverlay();
  }, [marksVersion, paintOverlay, draft]);

  const clearDrawings = () => {
    const series = hostSeries();
    if (series) {
      for (const row of hLinesRef.current) {
        try {
          series.removePriceLine(row.line);
        } catch {
          /* ignore */
        }
      }
    }
    hLinesRef.current = [];
    arrowsRef.current = [];
    trendsRef.current = [];
    trendSeriesRef.current?.setData([]);
    setDraft(null);
    setMarksVersion((v) => v + 1);
  };

  const saveImage = async () => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const shot = chart.takeScreenshot();
      const w = shot.width;
      const h = shot.height;
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(shot, 0, 0);

      // Overlay arrows/trends at screenshot pixel scale.
      const series = hostSeries();
      const dpr = w / (wrapRef.current?.clientWidth || w);
      if (series) {
        const timeScale = chart.timeScale();
        for (const tr of trendsRef.current) {
          const x1 = timeScale.timeToCoordinate(tr.t1 as Time);
          const x2 = timeScale.timeToCoordinate(tr.t2 as Time);
          const y1 = series.priceToCoordinate(tr.p1);
          const y2 = series.priceToCoordinate(tr.p2);
          if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
          ctx.strokeStyle = "#7ec8ff";
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          ctx.moveTo(x1 * dpr, y1 * dpr);
          ctx.lineTo(x2 * dpr, y2 * dpr);
          ctx.stroke();
        }
        for (const a of arrowsRef.current) {
          const x = timeScale.timeToCoordinate(a.time as Time);
          const y = series.priceToCoordinate(a.price);
          if (x == null || y == null) continue;
          drawArrowShape(ctx, x * dpr, y * dpr, a.dir, 15 * dpr);
        }
      }

      // Brand logo — top-left (header mark).
      try {
        const logo = await loadImage(BRAND_LOGO_SRC);
        const pad = Math.round(14 * dpr);
        const logoH = Math.round(28 * dpr);
        const logoW = Math.round((logo.width / Math.max(1, logo.height)) * logoH);
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.drawImage(logo, pad, pad, logoW, logoH);
        ctx.restore();
      } catch {
        /* logo optional */
      }

      const url = out.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `imba-pro-${Date.now()}.png`;
      a.click();
    } catch {
      /* ignore */
    }
  };

  const toolHint =
    tool === "trend" && draft
      ? `${labels.trend}…`
      : tool === "eraser"
        ? labels.eraser
        : tool === "arrowUp" || tool === "arrowDown"
          ? tool === "arrowUp"
            ? labels.arrowUp
            : labels.arrowDown
          : null;

  return (
    <div
      className={styles.wrap}
      style={{ ["--pro-accent" as string]: accentHex }}
    >
      <div className={styles.toolbar} role="toolbar">
        <div className={styles.group}>
          <button
            className={seriesMode === "candle" ? styles.btnOn : styles.btn}
            onClick={() => setSeriesMode("candle")}
            type="button"
          >
            {labels.candles}
          </button>
          <button
            className={seriesMode === "line" ? styles.btnOn : styles.btn}
            onClick={() => setSeriesMode("line")}
            type="button"
          >
            {labels.line}
          </button>
        </div>
        <div className={styles.group}>
          {(
            [
              ["cursor", labels.cursor],
              ["hline", labels.hline],
              ["trend", labels.trend],
              ["arrowUp", labels.arrowUp],
              ["arrowDown", labels.arrowDown],
              ["eraser", labels.eraser],
            ] as const
          ).map(([id, label]) => (
            <button
              className={tool === id ? styles.btnOn : styles.btn}
              key={id}
              onClick={() => {
                setTool(id);
                if (id !== "trend") setDraft(null);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
          <button className={styles.btn} onClick={clearDrawings} type="button">
            {labels.clear}
          </button>
          <button className={styles.btn} onClick={() => void saveImage()} type="button">
            {labels.save}
          </button>
        </div>
      </div>
      <div
        className={`${styles.stage} ${
          tool === "cursor" ? styles.stageCursor : styles.stageDraw
        }`}
      >
        <div className={styles.chartHost} ref={wrapRef} />
        <canvas
          aria-hidden
          className={styles.overlay}
          ref={overlayRef}
        />
      </div>
      {toolHint ? <div className={styles.hint}>{toolHint}</div> : null}
    </div>
  );
}
