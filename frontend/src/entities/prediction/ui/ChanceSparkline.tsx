"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./Prediction.module.css";

const STORE_KEY = "imba_prediction_spark_v1";
const MAX_POINTS = 24;

type SparkStore = Record<string, number[]>;

function readStore(): SparkStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SparkStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: SparkStore) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

/** Append chance sample and return recent series for sparkline. */
export function useChanceSparkline(eventId: number, chance: number): number[] {
  const [points, setPoints] = useState<number[]>(() => {
    const prev = readStore()[String(eventId)];
    return Array.isArray(prev) && prev.length ? prev : [chance];
  });
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(chance)) return;
    if (last.current === chance) return;
    last.current = chance;
    setPoints((prev) => {
      const next =
        prev.length && prev[prev.length - 1] === chance
          ? prev
          : [...prev, chance].slice(-MAX_POINTS);
      const store = readStore();
      store[String(eventId)] = next;
      writeStore(store);
      return next;
    });
  }, [chance, eventId]);

  return points;
}

export function ChanceSparkline({
  points,
  up,
}: {
  points: number[];
  up?: boolean;
}) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(1, max - min);
    const w = 64;
    const h = 22;
    return points
      .map((v, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 2) - 1;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  if (points.length < 2) {
    return <span className={styles.sparkEmpty} aria-hidden />;
  }

  return (
    <svg
      aria-hidden
      className={`${styles.spark} ${up ? styles.sparkUp : styles.sparkDown}`}
      height={22}
      viewBox="0 0 64 22"
      width={64}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}
