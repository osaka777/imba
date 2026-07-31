/**
 * In-memory sliding-window rate limiter for feed HTTP + WS.
 * Generous limits so live odds polling stays healthy for real users.
 */
type HitBucket = { count: number; resetAt: number };

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, HitBucket>();

  constructor(
    private readonly windowMs: number,
    private readonly maxHits: number,
  ) {}

  /** @returns true if allowed */
  try(key: string): boolean {
    const now = Date.now();
    const bucket = this.hits.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.maybePrune(now);
      return true;
    }

    bucket.count += 1;
    return bucket.count <= this.maxHits;
  }

  private maybePrune(now: number) {
    if (this.hits.size < 5000) return;
    for (const [key, bucket] of this.hits) {
      if (now >= bucket.resetAt) this.hits.delete(key);
    }
  }
}

/** ~120 GETs / minute / IP — enough for live + line + event pages. */
export const feedHttpRateLimiter = new SlidingWindowRateLimiter(60_000, 120);

/** Session minting — stop token farming. */
export const feedSessionRateLimiter = new SlidingWindowRateLimiter(60_000, 30);

/** New WS connections / minute / IP. */
export const feedWsConnectRateLimiter = new SlidingWindowRateLimiter(60_000, 10);
