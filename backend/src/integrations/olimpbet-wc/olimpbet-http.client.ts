import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OLIMPBET_API_HOST = 'https://olimpbet.kz/api';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type OlimpbetJsonValidator<T> = (raw: unknown) => T | null;

type CircuitState = 'closed' | 'open' | 'half-open';

function sleep(ms: number): Promise<void> {
  const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Env defaults must be plain digits — Number('30_000') is NaN. */
function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Parse Retry-After header (seconds or HTTP-date). */
export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header?.trim()) return undefined;
  const asNum = Number(header.trim());
  if (Number.isFinite(asNum) && asNum >= 0) {
    return Math.min(asNum * 1000, 120_000);
  }
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.min(asDate - Date.now(), 120_000));
  }
  return undefined;
}

@Injectable()
export class OlimpbetHttpClient {
  private readonly logger = new Logger(OlimpbetHttpClient.name);
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private circuitState: CircuitState = 'closed';
  private probeInFlight = false;
  private lastSkipLogAt = 0;
  private skipLogCount = 0;

  private inFlight = 0;
  private readonly waitQueue: Array<() => void> = [];

  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly circuitThreshold: number;
  private readonly circuitCooldownMs: number;
  private readonly maxConcurrent: number;

  constructor(private readonly config: ConfigService) {
    this.maxRetries = parsePositiveNumber(this.config.get<string>('OLIMPBET_HTTP_MAX_RETRIES'), 1);
    this.baseDelayMs = parsePositiveNumber(this.config.get<string>('OLIMPBET_HTTP_BASE_DELAY_MS'), 700);
    this.maxDelayMs = parsePositiveNumber(this.config.get<string>('OLIMPBET_HTTP_MAX_DELAY_MS'), 20_000);
    this.circuitThreshold = parsePositiveNumber(this.config.get<string>('OLIMPBET_CIRCUIT_THRESHOLD'), 4);
    this.circuitCooldownMs = parsePositiveNumber(
      this.config.get<string>('OLIMPBET_CIRCUIT_COOLDOWN_MS'),
      120_000,
    );
    this.maxConcurrent = Math.max(
      1,
      parsePositiveNumber(this.config.get<string>('OLIMPBET_HTTP_MAX_CONCURRENT'), 3),
    );
  }

  /** True when callers must not start new Olimpbet work (open or half-open probe). */
  isCircuitOpen(): boolean {
    this.maybeTransitionToHalfOpen();
    return this.circuitState !== 'closed';
  }

  getCircuitState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.circuitState;
  }

  /**
   * Fetch JSON from Olimpbet public API with concurrency limit, retry, backoff,
   * and circuit breaker. Half-open uses a dedicated lightweight probe — callers
   * are blocked until the circuit is fully closed again.
   */
  async fetchJson<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined> | undefined,
    validate: OlimpbetJsonValidator<T>,
  ): Promise<T | null> {
    this.maybeTransitionToHalfOpen();

    if (this.circuitState !== 'closed') {
      this.logCircuitSkip(path);
      return null;
    }

    await this.acquireSlot();
    try {
      // Re-check after waiting for a slot — circuit may have opened meanwhile.
      if (this.circuitState !== 'closed') {
        this.logCircuitSkip(path);
        return null;
      }
      return await this.fetchJsonUnlocked(path, params, validate);
    } finally {
      this.releaseSlot();
    }
  }

  private async fetchJsonUnlocked<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined> | undefined,
    validate: OlimpbetJsonValidator<T>,
  ): Promise<T | null> {
    let lastStatus = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const outcome = await this.tryOnce(path, params);
      lastStatus = outcome.status;

      if (outcome.ok) {
        this.consecutiveFailures = 0;
        try {
          return validate(outcome.data);
        } catch (err) {
          this.logger.warn(
            `Olimpbet validate error ${path}: ${(err as Error).message}`,
          );
          return null;
        }
      }

      if (outcome.status === 403) {
        this.logger.error(`Olimpbet 403 on ${path} — possible IP/UA block`);
        this.recordFailure();
        return null;
      }

      const retryable =
        outcome.status === 429
        || outcome.status >= 500
        || outcome.status === 0;

      if (!retryable || attempt >= this.maxRetries) {
        if (retryable) this.recordFailure();
        return null;
      }

      const retryAfterMs = outcome.ok === false ? outcome.retryAfterMs : undefined;
      const exponential = Math.min(this.baseDelayMs * 2 ** attempt, this.maxDelayMs);
      const rawDelay = (retryAfterMs ?? exponential) + Math.random() * 200;
      const delay = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : this.baseDelayMs;

      this.logger.warn(
        `Olimpbet ${outcome.status || 'network'} on ${path}, retry ${attempt + 1}/${this.maxRetries} in ${Math.round(delay)}ms`,
      );
      await sleep(delay);
    }

    if (lastStatus >= 500 || lastStatus === 429 || lastStatus === 0) {
      this.recordFailure();
    }
    return null;
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.circuitState === 'open' && Date.now() >= this.circuitOpenUntil) {
      this.circuitState = 'half-open';
      this.consecutiveFailures = 0;
      this.logger.warn('Olimpbet circuit half-open — dedicated probe');
      void this.runHalfOpenProbe();
    }
  }

  /**
   * Lightweight probe; callers stay blocked until CLOSED or re-OPEN.
   * A single flaky attempt (transient network blip, GC pause, ...) must not
   * re-lock the circuit for a full cooldown — retry a couple of times in the
   * same half-open window before giving up.
   */
  private async runHalfOpenProbe(): Promise<void> {
    if (this.probeInFlight) return;
    this.probeInFlight = true;
    try {
      await this.acquireSlot();
      try {
        if (this.circuitState !== 'half-open') return;

        const probeAttempts = Math.max(1, Math.min(this.maxRetries + 1, 3));
        let lastOutcome: Awaited<ReturnType<typeof this.tryOnce>> | null = null;

        for (let attempt = 0; attempt < probeAttempts; attempt++) {
          if (attempt > 0) await sleep(500 + attempt * 500);
          lastOutcome = await this.tryOnce('/events/8356795', undefined);

          if (lastOutcome.ok) {
            this.circuitState = 'closed';
            this.circuitOpenUntil = 0;
            this.consecutiveFailures = 0;
            this.logger.log(
              `Olimpbet circuit CLOSED after successful probe (attempt ${attempt + 1}/${probeAttempts})`,
            );
            return;
          }

          if (lastOutcome.status === 400 || lastOutcome.status === 429) {
            // Reachable but rate-limited — short cooldown, do not resume full traffic yet.
            this.circuitState = 'open';
            this.circuitOpenUntil = Date.now() + 45_000;
            this.logger.warn(
              `Olimpbet circuit stays OPEN 45s after probe status=${lastOutcome.status}`,
            );
            return;
          }
        }

        // All probe attempts in this window failed for network-level reasons —
        // use a shorter cooldown than a "real" outage so we retry sooner.
        this.circuitState = 'open';
        this.circuitOpenUntil = Date.now() + Math.min(this.safeCooldownMs(), 30_000);
        this.logger.error(
          `Olimpbet circuit stays OPEN — half-open probe failed ${probeAttempts}/${probeAttempts} times`
          + (lastOutcome ? ` (last status=${lastOutcome.status})` : ''),
        );
      } finally {
        this.releaseSlot();
      }
    } finally {
      this.probeInFlight = false;
    }
  }

  private recordFailure(): void {
    // Ignore failures from in-flight requests after the circuit already opened.
    if (this.circuitState !== 'closed') return;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitThreshold) {
      this.openCircuit(`${this.consecutiveFailures} consecutive failures`);
    }
  }

  private openCircuit(reason: string): void {
    const cooldownMs = this.safeCooldownMs();
    this.circuitState = 'open';
    this.circuitOpenUntil = Date.now() + cooldownMs;
    this.consecutiveFailures = 0;
    this.logger.error(
      `Olimpbet circuit breaker OPEN for ${cooldownMs / 1000}s (${reason})`,
    );
  }

  private safeCooldownMs(): number {
    return Number.isFinite(this.circuitCooldownMs) && this.circuitCooldownMs > 0
      ? this.circuitCooldownMs
      : 120_000;
  }

  private logCircuitSkip(path: string): void {
    this.skipLogCount += 1;
    const now = Date.now();
    if (now - this.lastSkipLogAt < 5_000) return;
    this.lastSkipLogAt = now;
    this.logger.warn(
      `Olimpbet circuit ${this.circuitState} — skip ${path}`
      + (this.skipLogCount > 1 ? ` (+${this.skipLogCount - 1} more)` : ''),
    );
    this.skipLogCount = 0;
  }

  private async acquireSlot(): Promise<void> {
    if (this.inFlight < this.maxConcurrent) {
      this.inFlight += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private releaseSlot(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
      return;
    }
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${OLIMPBET_API_HOST}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async tryOnce(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<
    | { ok: true; data: unknown; status: number }
    | { ok: false; status: number; retryAfterMs?: number }
  > {
    const url = this.buildUrl(path, params);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12_000);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': DEFAULT_UA,
        },
        signal: ac.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `Olimpbet API ${res.status} ${path}: ${body.slice(0, 160)}`,
        );
        return {
          ok: false,
          status: res.status,
          retryAfterMs: res.status === 429
            ? parseRetryAfterMs(res.headers.get('retry-after'))
            : undefined,
        };
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (err) {
        this.logger.warn(
          `Olimpbet invalid JSON ${path}: ${(err as Error).message}`,
        );
        return { ok: false, status: 0 };
      }

      return { ok: true, data, status: res.status };
    } catch (err) {
      const error = err as Error & { cause?: { code?: string; message?: string } };
      const causeInfo = error.cause
        ? ` cause=${error.cause.code ?? ''} ${error.cause.message ?? ''}`.trim()
        : '';
      this.logger.debug(`Olimpbet fetch error ${path}: ${error.message}${causeInfo ? ` (${causeInfo})` : ''}`);
      return { ok: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}
