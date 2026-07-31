import type { BtcTick } from "../api/client";

export type OhlcBar = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

/** Bucket ticks into OHLC candles for lightweight-charts. */
export function ticksToOhlc(
  ticks: BtcTick[],
  bucketMs: number,
  livePrice?: number | null,
): OhlcBar[] {
  if (!ticks.length && (livePrice == null || !Number.isFinite(livePrice))) {
    return [];
  }
  const sorted = [...ticks]
    .filter((t) => Number.isFinite(t.t) && Number.isFinite(t.p))
    .sort((a, b) => a.t - b.t);

  const map = new Map<number, OhlcBar>();
  for (const tick of sorted) {
    const bucket = Math.floor(tick.t / bucketMs) * bucketMs;
    const time = Math.floor(bucket / 1000);
    const cur = map.get(time);
    if (!cur) {
      map.set(time, {
        time,
        open: tick.p,
        high: tick.p,
        low: tick.p,
        close: tick.p,
      });
    } else {
      cur.high = Math.max(cur.high, tick.p);
      cur.low = Math.min(cur.low, tick.p);
      cur.close = tick.p;
    }
  }

  if (livePrice != null && Number.isFinite(livePrice)) {
    const nowBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
    const time = Math.floor(nowBucket / 1000);
    const cur = map.get(time);
    if (!cur) {
      const prev = [...map.values()].at(-1);
      const open = prev?.close ?? livePrice;
      map.set(time, {
        time,
        open,
        high: Math.max(open, livePrice),
        low: Math.min(open, livePrice),
        close: livePrice,
      });
    } else {
      cur.high = Math.max(cur.high, livePrice);
      cur.low = Math.min(cur.low, livePrice);
      cur.close = livePrice;
    }
  }

  return [...map.values()].sort((a, b) => a.time - b.time);
}

export function candleBucketMs(roundMs: number): number {
  if (roundMs <= 60_000) return 1_000;
  if (roundMs <= 300_000) return 5_000;
  if (roundMs <= 900_000) return 15_000;
  return 60_000;
}
