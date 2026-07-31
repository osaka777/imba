"use client";

import { useId, useRef } from "react";

import styles from "./ChanceChart.module.css";

export type ChancePoint = { t: number; v: number };
export type ScrubSide = "yes" | "no";
export type ChanceScrub = { index: number; side: ScrubSide };

const YES = "#0acf97";
const NO = "#ef473a";

function pathFromCoords(coords: ReadonlyArray<readonly [number, number]>) {
  return coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}

function yAt(
  coords: ReadonlyArray<readonly [number, number]>,
  scrubIndex: number,
) {
  if (!coords.length) return 0;
  const i0 = Math.max(0, Math.min(coords.length - 1, Math.floor(scrubIndex)));
  const i1 = Math.min(coords.length - 1, i0 + 1);
  const f = Math.max(0, Math.min(1, scrubIndex - i0));
  const a = coords[i0]!;
  const b = coords[i1]!;
  return a[1] + (b[1] - a[1]) * f;
}

export function ChanceChart({
  points,
  scrub,
  onScrub,
  live = true,
}: {
  points: ChancePoint[];
  scrub: ChanceScrub | null;
  onScrub: (next: ChanceScrub | null) => void;
  /** Polymarket-style tip pulse + bolt markers. */
  live?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const w = 640;
  const h = 220;
  const pad = 8;

  const yesVals = points.length ? points.map((p) => p.v) : [50];
  const noVals = yesVals.map((v) => 100 - v);
  const allVals = [...yesVals, ...noVals];
  let dataMin = Math.min(...allVals);
  let dataMax = Math.max(...allVals);
  /* Keep vertical room so flat/near-flat markets don't look like two rails. */
  const MIN_SPAN = 28;
  if (dataMax - dataMin < MIN_SPAN) {
    const mid = (dataMin + dataMax) / 2;
    dataMin = mid - MIN_SPAN / 2;
    dataMax = mid + MIN_SPAN / 2;
  }
  const padY = Math.max(4, (dataMax - dataMin) * 0.14);
  const min = Math.max(0, dataMin - padY);
  const max = Math.min(100, dataMax + padY);
  const span = Math.max(1e-9, max - min);

  const xAt = (i: number, n: number) =>
    pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
  const yOf = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);

  const yesCoords: Array<readonly [number, number]> =
    points.length < 2
      ? [
          [pad, yOf(50)],
          [w - pad, yOf(50)],
        ]
      : points.map((p, i) => [xAt(i, points.length), yOf(p.v)] as const);

  const noCoords: Array<readonly [number, number]> =
    points.length < 2
      ? [
          [pad, yOf(50)],
          [w - pad, yOf(50)],
        ]
      : points.map(
          (p, i) => [xAt(i, points.length), yOf(100 - p.v)] as const,
        );

  const dYes = pathFromCoords(yesCoords);
  const dNo = pathFromCoords(noCoords);
  const lastYes = yesCoords[yesCoords.length - 1]!;
  const lastNo = noCoords[noCoords.length - 1]!;
  const fillYes = `${dYes} L${lastYes[0].toFixed(1)} ${h} L${yesCoords[0]![0].toFixed(1)} ${h} Z`;
  const fillNo = `${dNo} L${lastNo[0].toFixed(1)} ${h} L${noCoords[0]![0].toFixed(1)} ${h} Z`;

  const scrubIndex = scrub?.index ?? null;
  const side = scrub?.side ?? "yes";
  const showLive = live && scrubIndex == null;

  const scrubUi = (() => {
    if (scrubIndex == null || yesCoords.length === 0) return null;
    const i0 = Math.max(
      0,
      Math.min(yesCoords.length - 1, Math.floor(scrubIndex)),
    );
    const i1 = Math.min(yesCoords.length - 1, i0 + 1);
    const f = Math.max(0, Math.min(1, scrubIndex - i0));
    const a = yesCoords[i0]!;
    const b = yesCoords[i1]!;
    const x = a[0] + (b[0] - a[0]) * f;
    const topY =
      side === "yes"
        ? yAt(yesCoords, scrubIndex)
        : yAt(noCoords, scrubIndex);
    return {
      x,
      left: (x / w) * 100,
      top: (topY / h) * 100,
      side,
    };
  })();

  function scrubFromPointer(clientX: number, clientY: number): ChanceScrub {
    const el = wrapRef.current;
    if (!el || points.length < 2) return { index: 0, side: "yes" };
    const rect = el.getBoundingClientRect();
    const nx = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
    );
    const ny = Math.max(
      0,
      Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)),
    );
    const index = nx * (points.length - 1);
    const svgY = ny * h;
    const yesY = yAt(yesCoords, index);
    const noY = yAt(noCoords, index);
    const nextSide: ScrubSide =
      Math.abs(svgY - yesY) <= Math.abs(svgY - noY) ? "yes" : "no";
    return { index, side: nextSide };
  }

  const fillGradYes = `chanceFillYes-${uid}`;
  const fillGradNo = `chanceFillNo-${uid}`;
  const glowYes = `chanceGlowYes-${uid}`;
  const glowNo = `chanceGlowNo-${uid}`;
  const clipId = `chanceClip-${uid}`;
  const activeYes = !scrubUi || scrubUi.side === "yes";
  const activeNo = !scrubUi || scrubUi.side === "no";

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${scrubUi ? styles.scrubbing : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onScrub(scrubFromPointer(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        if (
          e.pointerType === "mouse" ||
          e.currentTarget.hasPointerCapture(e.pointerId)
        ) {
          onScrub(scrubFromPointer(e.clientX, e.clientY));
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") onScrub(null);
      }}
      onPointerLeave={() => onScrub(null)}
      onPointerCancel={() => onScrub(null)}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={fillGradYes} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(10, 207, 151, 0.28)" />
            <stop offset="100%" stopColor="rgba(10, 207, 151, 0.02)" />
          </linearGradient>
          <linearGradient id={fillGradNo} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(239, 71, 58, 0.26)" />
            <stop offset="100%" stopColor="rgba(239, 71, 58, 0.02)" />
          </linearGradient>
          <filter
            id={glowYes}
            x="-20%"
            y="-40%"
            width="140%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id={glowNo}
            x="-20%"
            y="-40%"
            width="140%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {scrubUi ? (
            <clipPath id={clipId}>
              <rect x="0" y="0" width={scrubUi.x} height={h} />
            </clipPath>
          ) : null}
        </defs>

        <g className={styles.ghost} opacity={scrubUi ? 0.18 : 1}>
          <path
            d={fillYes}
            fill={`url(#${fillGradYes})`}
            opacity={activeYes ? 1 : 0.35}
          />
          <path
            d={dNo}
            fill="none"
            stroke={NO}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={activeNo ? 1 : 0.35}
          />
          <path
            d={dYes}
            fill="none"
            stroke={YES}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={activeYes ? 1 : 0.35}
          />
        </g>

        {showLive ? (
          <>
            <path
              className={styles.streakYes}
              d={dYes}
              fill="none"
              stroke={YES}
              strokeWidth="3.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              filter={`url(#${glowYes})`}
            />
            <path
              className={styles.streakNo}
              d={dNo}
              fill="none"
              stroke={NO}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              filter={`url(#${glowNo})`}
            />
          </>
        ) : null}

        {scrubUi ? (
          <g clipPath={`url(#${clipId})`}>
            {scrubUi.side === "yes" ? (
              <>
                <path d={fillYes} fill={`url(#${fillGradYes})`} />
                <path
                  d={dYes}
                  fill="none"
                  stroke={YES}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={dNo}
                  fill="none"
                  stroke={NO}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.28}
                />
              </>
            ) : (
              <>
                <path d={fillNo} fill={`url(#${fillGradNo})`} />
                <path
                  d={dNo}
                  fill="none"
                  stroke={NO}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={dYes}
                  fill="none"
                  stroke={YES}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.28}
                />
              </>
            )}
          </g>
        ) : null}
      </svg>

      {showLive ? (
        <>
          <span
            className={`${styles.liveTip} ${styles.liveTipYes}`}
            style={{
              left: `${(lastYes[0] / w) * 100}%`,
              top: `${(lastYes[1] / h) * 100}%`,
            }}
            aria-hidden
          />
          <span
            className={`${styles.liveTip} ${styles.liveTipNo}`}
            style={{
              left: `${(lastNo[0] / w) * 100}%`,
              top: `${(lastNo[1] / h) * 100}%`,
            }}
            aria-hidden
          />
        </>
      ) : null}

      {scrubUi ? (
        <>
          <i
            className={styles.scrubLine}
            style={{ left: `${scrubUi.left}%` }}
            aria-hidden
          />
          <i
            className={`${styles.scrubDot} ${
              scrubUi.side === "yes" ? styles.scrubDotYes : styles.scrubDotNo
            }`}
            style={{
              left: `${scrubUi.left}%`,
              top: `${scrubUi.top}%`,
            }}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
}
